using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services.Accounts;

public sealed class VerificacionCuentaService(TutoriaDbContext db, CredencialesCuentaService credenciales,
    SeguridadCuenta seguridad, ColaCorreoCuenta cola, TimeProvider clock, IOptions<CuentasOptions> options)
{
    public async Task<CodigoEnCaminoDto> Solicitar(SolicitarCodigoInput input, CancellationToken ct)
    {
        credenciales.ExigirDisponible();
        TutoriaError.Exigir(input.Proposito is "registro" or "activacion" or "recuperacion" && input.Rol is "estudiante" or "tutor" or "coordinacion", "Solicitud de verificación inválida.");
        TutoriaError.Exigir(input.Proposito != "registro" || input.Rol != "coordinacion", "Coordinación crea las cuentas de este perfil.", 403);
        RetoCorreoEntity? activacion = null;
        if (input.Proposito == "activacion") activacion = await Activacion(input.TokenActivacion, ct);
        var email = activacion?.Correo ?? seguridad.Correo(input.Correo);
        await using var tx = await credenciales.Bloquear(email, ct);
        var ahora = clock.GetUtcNow();
        var ultimo = await db.RetosCorreo.Where(r => r.Correo == email && r.UltimoEnvio != null).MaxAsync(r => r.UltimoEnvio, ct);
        TutoriaError.Exigir(ultimo is null || ultimo <= ahora.AddSeconds(-60), "Espera un minuto antes de solicitar otro código.", 429);
        var envios = await db.RetosCorreo.Where(r => r.Correo == email && r.Creado > ahora.AddHours(-1)).SumAsync(r => r.Envios, ct);
        TutoriaError.Exigir(envios < 5, "Se alcanzó el límite de códigos. Inténtalo nuevamente en una hora.", 429);
        RetoCorreoEntity reto;
        if (activacion is not null)
        {
            // Releer tras obtener la exclusión; nunca reutilizar una prueba invalidada concurrentemente.
            await db.Entry(activacion).ReloadAsync(ct);
            ExigirActivacion(activacion, input.TokenActivacion, ahora);
            var user = await db.Usuarios.SingleAsync(u => u.Id == activacion.UsuarioId, ct);
            var cred = await db.CredencialesCuenta.SingleAsync(c => c.UsuarioId == user.Id, ct);
            TutoriaError.Exigir(user.Activo && user.Version == activacion.VersionUsuario && cred.TemporalHasta > ahora, "Vuelve a ingresar con tu contraseña temporal.", 409);
            reto = activacion;
            foreach (var pendiente in await db.CorreosCuenta.Where(m => m.RetoId == reto.Id && m.Enviado == null && m.Cancelado == null).ToArrayAsync(ct)) { pendiente.Cancelado = ahora; pendiente.ContenidoProtegido = ""; }
        }
        else
        {
            await cola.CancelarRetos(email, input.Proposito, ahora, ct);
            reto = new() { Id = SeguridadCuenta.Aleatorio(), Correo = email, Rol = input.Rol, Proposito = input.Proposito, Creado = ahora };
            if (input.Proposito == "registro")
            {
                var tipo = input.Rol == "estudiante" ? "estudiante" : "tutor";
                var candidatas = await db.Personas.AsNoTracking().Where(p => p.Tipo == tipo && p.Activa).ToArrayAsync(ct);
                var personas = candidatas.Where(p => JsonDatos.Texto(p.DatosJson, "correo").Trim().Equals(email, StringComparison.OrdinalIgnoreCase)).ToArray();
                if (personas.Length == 1 && !await db.CredencialesCuenta.AnyAsync(c => c.CorreoNormalizado == email && c.Rol == input.Rol, ct)) reto.PersonaId = personas[0].Id;
            }
            else
            {
                var usuario = await (from c in db.CredencialesCuenta join u in db.Usuarios on c.UsuarioId equals u.Id
                    where c.CorreoNormalizado == email && c.Rol == input.Rol && c.Verificada && u.Activo select u).SingleOrDefaultAsync(ct);
                if (usuario is not null) { reto.UsuarioId = usuario.Id; reto.PersonaId = usuario.PersonaId; reto.VersionUsuario = usuario.Version; }
            }
            db.RetosCorreo.Add(reto);
        }
        var codigo = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture);
        reto.CodigoHash = seguridad.HashCodigo(reto.Id, codigo); reto.Expira = ahora.AddMinutes(10); reto.UltimoEnvio = ahora;
        reto.Verificado = null; reto.TicketHash = null; reto.Intentos = 0; reto.Envios++;
        if (reto.PersonaId is not null)
            cola.Agregar(email, "Verifica tu cuenta · Tutoría UNAS",
                $"Tu código de verificación es: {codigo}\n\nVence en 10 minutos y solo puede utilizarse una vez. No lo compartas.\nSi no solicitaste esta operación, ignora este correo.\n\nTutoría UNAS", reto.Expira, reto.UsuarioId, reto.Id);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new(reto.Id, 600, 60, "Si el correo corresponde a una cuenta o persona habilitada en el padrón, recibirás un código. Revisa también Spam, No deseados y Papelera.");
    }

    private async Task<RetoCorreoEntity> Activacion(string? prueba, CancellationToken ct)
    {
        TutoriaError.Exigir(prueba is { Length: 64 }, "Vuelve a ingresar con tu contraseña temporal.", 401);
        var hash = SeguridadCuenta.Hash(prueba!);
        var reto = await db.RetosCorreo.SingleOrDefaultAsync(r => r.PruebaHash == hash && r.Proposito == "activacion", ct)
            ?? throw new TutoriaError(401, "Vuelve a ingresar con tu contraseña temporal.");
        ExigirActivacion(reto, prueba, clock.GetUtcNow()); return reto;
    }
    private static void ExigirActivacion(RetoCorreoEntity r, string? prueba, DateTimeOffset ahora) =>
        TutoriaError.Exigir(r.Consumido is null && r.Creado.AddMinutes(15) > ahora && prueba is { Length: 64 } && SeguridadCuenta.Iguales(r.PruebaHash, SeguridadCuenta.Hash(prueba)), "Vuelve a ingresar con tu contraseña temporal.", 401);

    public async Task<CodigoValidadoDto> Confirmar(ConfirmarCodigoInput input, CancellationToken ct)
    {
        credenciales.ExigirDisponible();
        var existente = await db.RetosCorreo.AsNoTracking().SingleOrDefaultAsync(r => r.Id == input.RetoId, ct)
            ?? throw new TutoriaError(400, SeguridadCuenta.CodigoInvalido);
        await using var tx = await credenciales.Bloquear(existente.Correo, ct);
        var reto = await db.RetosCorreo.SingleAsync(r => r.Id == input.RetoId, ct);
        var ahora = clock.GetUtcNow();
        if (reto.Proposito == "activacion") ExigirActivacion(reto, input.TokenActivacion, ahora);
        TutoriaError.Exigir(reto.Consumido is null && reto.Verificado is null && reto.Expira > ahora && reto.Intentos < 5 && reto.UltimoEnvio is not null, SeguridadCuenta.CodigoInvalido);
        reto.Intentos++;
        var valido = input.Codigo.Length == 6 && SeguridadCuenta.Iguales(reto.CodigoHash, seguridad.HashCodigo(reto.Id, input.Codigo)) && reto.PersonaId is not null;
        if (!valido) { await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); throw new TutoriaError(400, SeguridadCuenta.CodigoInvalido); }
        var ticket = SeguridadCuenta.Aleatorio(); reto.TicketHash = SeguridadCuenta.Hash(ticket); reto.Verificado = ahora; reto.Expira = ahora.AddMinutes(5);
        // El código ya no permite emitir otro ticket, incluso si aún no se cambió la contraseña.
        reto.CodigoHash = "";
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new(ticket, 300);
    }

    public async Task<CuentaCompletadaDto> Completar(CompletarCuentaInput input, CancellationToken ct)
    {
        credenciales.ExigirDisponible(); SeguridadCuenta.Password(input.Password, input.Confirmacion);
        var existente = await db.RetosCorreo.AsNoTracking().SingleOrDefaultAsync(r => r.Id == input.RetoId, ct)
            ?? throw new TutoriaError(400, "La verificación venció. Solicita un nuevo código.");
        await using var tx = await credenciales.Bloquear(existente.Correo, ct);
        var reto = await db.RetosCorreo.SingleAsync(r => r.Id == input.RetoId, ct);
        var ahora = clock.GetUtcNow();
        TutoriaError.Exigir(reto.Verificado is not null && reto.Consumido is null && reto.Expira > ahora && input.Ticket.Length == 64 && SeguridadCuenta.Iguales(reto.TicketHash, SeguridadCuenta.Hash(input.Ticket)), "La verificación venció. Solicita un nuevo código.");
        var persona = await db.Personas.SingleAsync(p => p.Id == reto.PersonaId, ct);
        TutoriaError.Exigir(persona.Activa && JsonDatos.Texto(persona.DatosJson, "correo").Trim().Equals(reto.Correo, StringComparison.OrdinalIgnoreCase), "La vinculación institucional cambió. Consulta a coordinación.", 409);
        UsuarioEntity user;
        if (reto.Proposito == "registro")
        {
            TutoriaError.Exigir(reto.Rol is "estudiante" or "tutor" && persona.Tipo == reto.Rol, "El perfil no corresponde al padrón.", 403);
            TutoriaError.Exigir(!await db.CredencialesCuenta.AnyAsync(c => c.CorreoNormalizado == reto.Correo && c.Rol == reto.Rol, ct) &&
                !await db.Usuarios.AnyAsync(u => u.PersonaId == persona.Id && u.Rol == reto.Rol && u.Issuer == SeguridadCuenta.Issuer, ct), "Ya existe una cuenta para este correo y perfil. Inicia sesión o recupera tu contraseña.", 409);
            user = credenciales.Crear(persona, reto.Correo, reto.Rol, input.Password, false);
        }
        else
        {
            user = await db.Usuarios.SingleAsync(u => u.Id == reto.UsuarioId, ct);
            var cred = await db.CredencialesCuenta.SingleAsync(c => c.UsuarioId == user.Id, ct);
            TutoriaError.Exigir(user.Activo && user.Version == reto.VersionUsuario && (reto.Proposito != "activacion" || cred.TemporalHasta > ahora), "La cuenta cambió. Vuelve a iniciar la verificación.", 409);
            TutoriaError.Exigir(!credenciales.PasswordValida(cred, input.Password), "Elige una contraseña diferente de la anterior.");
            credenciales.CambiarPassword(cred, input.Password); cred.Verificada = true; cred.CambioObligatorio = false; cred.TemporalHasta = null;
            cred.IntentosFallidos = 0; cred.BloqueadaHasta = null; user.Version++;
        }
        reto.Consumido = ahora; reto.TicketHash = null; reto.PruebaHash = null;
        db.Auditoria.Add(new() { Fecha = ahora, UsuarioId = user.Id, EscuelaId = user.EscuelaId, Accion = "completar-" + reto.Proposito, RecursoId = user.Id, Version = user.Version });
        cola.Agregar(reto.Correo, "Cuenta verificada · Tutoría UNAS", $"Tu cuenta institucional de Tutoría UNAS se verificó y su contraseña quedó establecida.\n\nAcceso: {options.Value.UrlAcceso}\nNo respondas este correo con tu contraseña. Si no realizaste la operación, comunícate con coordinación.", ahora.AddDays(1), user.Id);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new(user.Identificador, user.Rol, !user.Activo || user.EscuelaId.Length == 0);
    }
}
