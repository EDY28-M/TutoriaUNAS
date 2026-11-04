using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services.Accounts;

public interface ICorreoCuentaSender
{
    Task Enviar(string destinatario, string asunto, string contenido, CancellationToken ct);
}

/// <summary>Adaptador SMTP aislado: STARTTLS obligatorio, validación TLS del sistema y secreto protegido.</summary>
public sealed class SmtpCuentaSender(IOptions<SmtpCuentaOptions> options, IDataProtectionProvider protection) : ICorreoCuentaSender
{
    public const string SecretPurpose = "TutoriaUNAS.Smtp.Password.v1";
    public async Task Enviar(string destinatario, string asunto, string contenido, CancellationToken ct)
    {
        var smtp = options.Value;
        if (smtp.Host.Length == 0 || smtp.Port != 587 || smtp.Usuario.Length == 0 || smtp.Remitente.Length == 0 || smtp.PasswordFile.Length == 0)
            throw new InvalidOperationException("SMTP de cuentas no configurado.");
        var protectedValue = System.Text.Json.JsonSerializer.Deserialize<string>(await File.ReadAllTextAsync(smtp.PasswordFile, ct)) ?? throw new InvalidOperationException("Secreto SMTP no configurado.");
        var password = protection.CreateProtector(SecretPurpose).Unprotect(protectedValue);
        using var message = new MailMessage { From = new MailAddress(smtp.Remitente, smtp.Nombre, Encoding.UTF8),
            Subject = asunto, Body = contenido, BodyEncoding = Encoding.UTF8, SubjectEncoding = Encoding.UTF8, IsBodyHtml = false };
        message.To.Add(new MailAddress(destinatario));
        using var client = new SmtpClient(smtp.Host, smtp.Port) { EnableSsl = true, UseDefaultCredentials = false,
            Credentials = new NetworkCredential(smtp.Usuario, password), DeliveryMethod = SmtpDeliveryMethod.Network };
        await client.SendMailAsync(message, ct);
    }
}

public sealed class ColaCorreoCuenta(TutoriaDbContext db, IDataProtectionProvider protection, TimeProvider clock)
{
    public const string Purpose = "TutoriaUNAS.AccountMail.v1";
    public void Agregar(string destinatario, string asunto, string cuerpo, DateTimeOffset caduca, string? usuario = null, string? reto = null)
    {
        var ahora = clock.GetUtcNow();
        db.CorreosCuenta.Add(new() { Id = "MAIL-" + Guid.NewGuid().ToString("N"), UsuarioId = usuario, RetoId = reto,
            Destinatario = destinatario, Asunto = asunto, ContenidoProtegido = protection.CreateProtector(Purpose).Protect(cuerpo),
            Creado = ahora, Caduca = caduca, ProximoIntento = ahora });
    }
    public async Task CancelarRetos(string correo, string proposito, DateTimeOffset ahora, CancellationToken ct)
    {
        var anteriores = await db.RetosCorreo.Where(r => r.Correo == correo && r.Proposito == proposito && r.Consumido == null).ToArrayAsync(ct);
        var ids = anteriores.Select(r => r.Id).ToArray();
        foreach (var reto in anteriores) { reto.Consumido = ahora; reto.TicketHash = null; }
        foreach (var pendiente in await db.CorreosCuenta.Where(m => ids.Contains(m.RetoId!) && m.Enviado == null && m.Cancelado == null).ToArrayAsync(ct))
        { pendiente.Cancelado = ahora; pendiente.ContenidoProtegido = ""; }
    }
}

/// <summary>Outbox con arrendamiento recuperable, reintentos y exclusión entre procesos PostgreSQL.</summary>
public sealed class DespachadorCorreoCuenta(IServiceScopeFactory scopes, ILogger<DespachadorCorreoCuenta> logger) : BackgroundService
{
    public static async Task<bool> Procesar(IServiceProvider services, CancellationToken ct = default)
    {
        var db = services.GetRequiredService<TutoriaDbContext>();
        var clock = services.GetRequiredService<TimeProvider>();
        var ahora = clock.GetUtcNow();
        CorreoCuentaEntity? mail;
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            var pendientes = await db.CorreosCuenta.FromSqlInterpolated($"""
                SELECT * FROM "CorreosCuenta" WHERE "Enviado" IS NULL AND "Cancelado" IS NULL
                AND "Intentos" < 5 AND "ProximoIntento" <= {ahora}
                AND ("BloqueoHasta" IS NULL OR "BloqueoHasta" <= {ahora})
                ORDER BY "ProximoIntento", "Id" LIMIT 1 FOR UPDATE SKIP LOCKED
                """).ToArrayAsync(ct);
            mail = pendientes.SingleOrDefault();
            if (mail is null) { await tx.CommitAsync(ct); return false; }
            if (mail.Caduca <= ahora) { mail.Cancelado = ahora; mail.ContenidoProtegido = ""; await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return true; }
            mail.BloqueoHasta = ahora.AddMinutes(2); mail.Intentos++;
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        }
        try
        {
            var content = services.GetRequiredService<IDataProtectionProvider>().CreateProtector(ColaCorreoCuenta.Purpose).Unprotect(mail.ContenidoProtegido);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(45));
            await services.GetRequiredService<ICorreoCuentaSender>().Enviar(mail.Destinatario, mail.Asunto, content, timeout.Token);
            mail.Enviado = clock.GetUtcNow(); mail.Error = null; mail.ContenidoProtegido = "";
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex) when (ex is SmtpException or IOException or UnauthorizedAccessException or FormatException or InvalidOperationException or System.Security.Cryptography.CryptographicException or OperationCanceledException)
        {
            // No guardar errores del proveedor: pueden contener correos, códigos o credenciales.
            mail.Error = "No se pudo entregar al servidor de correo.";
            mail.ProximoIntento = clock.GetUtcNow().AddSeconds(Math.Min(120, 10 * Math.Pow(2, mail.Intentos)));
            if (mail.Intentos >= 5) { mail.Cancelado = clock.GetUtcNow(); mail.ContenidoProtegido = ""; }
        }
        mail.BloqueoHasta = null;
        await db.SaveChangesAsync(ct);
        return true;
    }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                if (await Procesar(scope.ServiceProvider, stoppingToken)) continue;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) when (ex is System.Data.Common.DbException or DbUpdateException)
            { logger.LogWarning("La cola de correo espera a PostgreSQL; se reintentará sin perder los mensajes."); }
            try { await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
