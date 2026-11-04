using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services.Accounts;

public sealed record DecisionAcceso(UsuarioEntity? Usuario = null, ActivacionRequeridaDto? Activacion = null, bool PendienteVinculacion = false);

public sealed class CredencialesCuentaService(TutoriaDbContext db, IPasswordHasher<CredencialCuentaEntity> hasher,
    TimeProvider clock, IOptions<CuentasOptions> options, ColaCorreoCuenta cola)
{
    private static readonly Lazy<string> DummyHash = new(() => new PasswordHasher<CredencialCuentaEntity>(Options.Create(new PasswordHasherOptions { IterationCount = 210000 })).HashPassword(new(), SeguridadCuenta.Aleatorio()));
    public void ExigirDisponible() => TutoriaError.Exigir(options.Value.Enabled, "El servicio de cuentas institucionales no está habilitado.", 503);
    public async Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> Bloquear(string correo, CancellationToken ct)
    {
        var tx = await db.Database.BeginTransactionAsync(ct);
        try { await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"cuenta:" + correo}, 0))", ct); return tx; }
        catch { await tx.DisposeAsync(); throw; }
    }
    public bool PasswordValida(CredencialCuentaEntity c, string password) => hasher.VerifyHashedPassword(c, c.PasswordHash, password) != PasswordVerificationResult.Failed;
    public void CambiarPassword(CredencialCuentaEntity c, string password) => c.PasswordHash = hasher.HashPassword(c, password);
    public UsuarioEntity Crear(PersonaEntity persona, string correo, string rol, string password, bool temporal)
    {
        var id = "CTA-" + Guid.NewGuid().ToString("N");
        var usuario = new UsuarioEntity { Id = id, Subject = id, Issuer = SeguridadCuenta.Issuer, Rol = rol, PersonaId = persona.Id,
            EscuelaId = persona.EscuelaId, Identificador = correo, Activo = persona.EscuelaId.Length > 0 };
        var credencial = new CredencialCuentaEntity { UsuarioId = id, CorreoNormalizado = correo, Rol = rol, CambioObligatorio = temporal,
            Verificada = !temporal, TemporalHasta = temporal ? clock.GetUtcNow().AddHours(48) : null, Creada = clock.GetUtcNow() };
        CambiarPassword(credencial, password); db.Usuarios.Add(usuario); db.CredencialesCuenta.Add(credencial);
        return usuario;
    }
    public async Task<DecisionAcceso?> IntentarLogin(LoginLocalDto input, CancellationToken ct)
    {
        if (!options.Value.Enabled) return null;
        TutoriaError.Exigir(input.Identifier.Length <= 254 && input.Password.Length <= 128 && input.Role is "estudiante" or "tutor" or "coordinacion", "Datos de acceso incorrectos.", 401);
        var identifier = input.Identifier.Trim().ToLowerInvariant();
        var email = await (from c in db.CredencialesCuenta.AsNoTracking() join u in db.Usuarios on c.UsuarioId equals u.Id
            where c.Rol == input.Role && (c.CorreoNormalizado == identifier || u.Identificador == identifier)
            select c.CorreoNormalizado).SingleOrDefaultAsync(ct);
        if (email is null) { _ = hasher.VerifyHashedPassword(new(), DummyHash.Value, input.Password); return null; }
        await using var tx = await Bloquear(email, ct);
        var cred = await db.CredencialesCuenta.SingleAsync(c => c.CorreoNormalizado == email && c.Rol == input.Role, ct);
        var user = await db.Usuarios.SingleAsync(u => u.Id == cred.UsuarioId, ct);
        var persona = await db.Personas.SingleAsync(p => p.Id == user.PersonaId, ct);
        var ahora = clock.GetUtcNow();
        if (cred.BloqueadaHasta > ahora) throw new TutoriaError(401, "Datos de acceso incorrectos o acceso temporalmente limitado.");
        if (!PasswordValida(cred, input.Password))
        {
            cred.IntentosFallidos++;
            if (cred.IntentosFallidos >= 5) { cred.BloqueadaHasta = ahora.AddMinutes(15); cred.IntentosFallidos = 0; }
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
            throw new TutoriaError(401, "Datos de acceso incorrectos.");
        }
        TutoriaError.Exigir(persona.Activa && (user.Activo || (user.EscuelaId == "" && cred.Verificada)), "La cuenta no está habilitada.", 403);
        cred.IntentosFallidos = 0; cred.BloqueadaHasta = null;
        DecisionAcceso decision;
        if (cred.CambioObligatorio || !cred.Verificada)
        {
            TutoriaError.Exigir(cred.TemporalHasta > ahora, "La contraseña temporal venció. Solicita una nueva a coordinación.", 409);
            await cola.CancelarRetos(email, "activacion", ahora, ct);
            var prueba = SeguridadCuenta.Aleatorio();
            db.RetosCorreo.Add(new() { Id = SeguridadCuenta.Aleatorio(), Correo = email, Rol = user.Rol, Proposito = "activacion",
                UsuarioId = user.Id, PersonaId = user.PersonaId, VersionUsuario = user.Version, PruebaHash = SeguridadCuenta.Hash(prueba), Creado = ahora, Expira = ahora.AddMinutes(15) });
            decision = new(Activacion: new(true, prueba, email, 900));
        }
        else if (user.EscuelaId.Length == 0) decision = new(PendienteVinculacion: true);
        else decision = new(Usuario: user);
        db.Auditoria.Add(new() { Fecha = ahora, UsuarioId = user.Id, EscuelaId = user.EscuelaId, Accion = decision.Activacion is null ? "iniciar-sesion" : "iniciar-activacion", RecursoId = user.Id, Version = user.Version });
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return decision;
    }
}
