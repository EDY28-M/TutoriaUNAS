using System.Globalization;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services.Accounts;

public sealed class CuentasAdminService(TutoriaDbContext db, TutoriaContext context, CredencialesCuentaService credenciales,
    SeguridadCuenta seguridad, ColaCorreoCuenta cola, TimeProvider clock, IOptions<CuentasOptions> options)
{
    private async Task<ActorTutoria> Actor(string accion, CancellationToken ct)
    {
        credenciales.ExigirDisponible(); var actor = await context.Actor(ct);
        TutoriaError.Exigir(actor.Rol == "coordinacion", "Solo coordinación administra cuentas.", 403);
        actor.Exigir("cuentas", accion); return actor;
    }
    public async Task<object[]> Listar(CancellationToken ct)
    {
        var actor = await Actor("ver", ct);
        var users = await db.Usuarios.AsNoTracking().Where(u => u.EscuelaId == actor.EscuelaId || (u.EscuelaId == "" && u.Issuer == SeguridadCuenta.Issuer)).ToArrayAsync(ct);
        var ids = users.Select(u => u.Id).ToArray(); var pids = users.Select(u => u.PersonaId).ToArray();
        var personas = await db.Personas.AsNoTracking().Where(p => pids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        var cred = await db.CredencialesCuenta.AsNoTracking().Where(c => ids.Contains(c.UsuarioId)).ToDictionaryAsync(c => c.UsuarioId, ct);
        var mails = await db.CorreosCuenta.AsNoTracking().Where(m => ids.Contains(m.UsuarioId!)).OrderByDescending(m => m.Creado).ToArrayAsync(ct);
        return users.Select(u => {
            var c = cred.GetValueOrDefault(u.Id); var mail = mails.FirstOrDefault(m => m.UsuarioId == u.Id);
            return (object)new { u.Id, u.PersonaId, rol = u.Rol, identifier = u.Identificador, nombre = DocumentosService.Nombre(personas[u.PersonaId]), u.Activo, u.Version,
                verificada = c?.Verificada, cambioObligatorio = c?.CambioObligatorio ?? false, pendienteVinculacion = u.EscuelaId == "", propia = u.Id == actor.Usuario.Id,
                correo = c?.CorreoNormalizado ?? JsonDatos.Texto(personas[u.PersonaId].DatosJson, "correo"),
                correoEstado = mail is null ? "sin-envio" : mail.Enviado is not null ? "enviado" : mail.Cancelado is not null ? "no-entregado" : "pendiente" };
        }).ToArray();
    }
    public async Task<object[]> Candidatos(string rol, string buscar, CancellationToken ct)
    {
        var actor = await Actor("crear", ct);
        TutoriaError.Exigir(rol is "estudiante" or "tutor" or "coordinacion" && buscar.Length <= 150, "Filtros inválidos.");
        if (buscar.Trim().Length < 2) return [];
        var tipo = rol == "estudiante" ? "estudiante" : "tutor";
        var personas = await db.Personas.AsNoTracking().Where(p => p.Activa && p.Tipo == tipo && (p.EscuelaId == actor.EscuelaId || (tipo == "tutor" && p.EscuelaId == ""))).ToArrayAsync(ct);
        var existentes = await db.Usuarios.Where(u => u.Issuer == SeguridadCuenta.Issuer && u.Rol == rol).Select(u => u.PersonaId).ToArrayAsync(ct);
        return personas.Where(p => !existentes.Contains(p.Id) && CultureInfo.GetCultureInfo("es-PE").CompareInfo.IndexOf(p.DatosJson, buscar.Trim(), CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace) >= 0)
            .Take(20).Select(p => (object)new { p.Id, nombre = DocumentosService.Nombre(p), nombres = JsonDatos.Texto(p.DatosJson, "nombres"), apellidos = JsonDatos.Texto(p.DatosJson, "apellidos"), correo = JsonDatos.Texto(p.DatosJson, "correo"), p.EscuelaId, p.Ciclo }).ToArray();
    }
    public async Task<CuentaCreadaDto> Crear(CrearCuentaInput input, CancellationToken ct)
    {
        var actor = await Actor("crear", ct); var email = seguridad.Correo(input.Correo);
        TutoriaError.Exigir(input.Rol is "estudiante" or "tutor" or "coordinacion", "Elige un perfil válido.");
        TutoriaError.Exigir(input.Ciclo is null or >= 1 and <= 10 && (input.Codigo?.Length ?? 0) <= 40, "Revisa el código y ciclo del alumno.");
        await using var tx = await credenciales.Bloquear(email, ct);
        TutoriaError.Exigir(!await db.CredencialesCuenta.AnyAsync(c => c.CorreoNormalizado == email && c.Rol == input.Rol, ct), "Ya existe una cuenta con este correo y perfil.", 409);
        var tipo = input.Rol == "estudiante" ? "estudiante" : "tutor";
        var candidatos = await db.Personas.Where(p => p.Tipo == tipo).ToArrayAsync(ct);
        var porCorreo = candidatos.Where(p => JsonDatos.Texto(p.DatosJson, "correo").Trim().Equals(email, StringComparison.OrdinalIgnoreCase)).ToArray();
        PersonaEntity persona;
        if (input.PersonaId is not null)
            persona = candidatos.SingleOrDefault(p => p.Id == input.PersonaId && JsonDatos.Texto(p.DatosJson, "correo").Trim().Equals(email, StringComparison.OrdinalIgnoreCase)) ?? throw new TutoriaError(400, "El correo no corresponde a la persona seleccionada.");
        else if (porCorreo.Length == 1) persona = porCorreo[0];
        else
        {
            TutoriaError.Exigir(porCorreo.Length == 0, "El correo coincide con varias fichas. Selecciona la persona del padrón.", 409);
            TutoriaError.Exigir(input.Nombres.Trim().Length is >= 2 and <= 150 && input.Apellidos.Trim().Length is >= 2 and <= 150, "Completa los nombres y apellidos.");
            persona = new() { Id = "PER-" + Guid.NewGuid().ToString("N"), Tipo = tipo, EscuelaId = actor.EscuelaId, Ciclo = tipo == "estudiante" ? input.Ciclo : null };
            var datos = new Dictionary<string, object?> { ["id"] = persona.Id, ["nombres"] = input.Nombres.Trim(), ["apellidos"] = input.Apellidos.Trim(), ["correo"] = email,
                ["codigo"] = input.Codigo?.Trim() ?? "", ["telefono"] = "", ["escuelaId"] = actor.EscuelaId };
            if (tipo == "estudiante") { datos["ciclo"] = input.Ciclo; datos["etapa"] = input.Ciclo is null ? "sin-informar" : input.Ciclo <= 3 ? "ingresante" : input.Ciclo <= 7 ? "intermedio" : "final";
                datos["estado"] = "regular"; datos["ingreso"] = ""; datos["promedioPonderado"] = null; datos["creditosAprobados"] = null; datos["creditosTotales"] = null; datos["alertas"] = Array.Empty<object>(); }
            else { datos["departamento"] = ""; datos["categoria"] = null; datos["dedicacion"] = null; datos["activo"] = true; datos["aforoMaximo"] = null; datos["cursosAsignados"] = Array.Empty<string>(); }
            persona.DatosJson = JsonDatos.Serializar(datos); db.Personas.Add(persona);
        }
        TutoriaError.Exigir(persona.Activa && (persona.EscuelaId == actor.EscuelaId || (tipo == "tutor" && persona.EscuelaId == "")), "La persona no pertenece al ámbito de tu escuela.", 403);
        if (persona.EscuelaId.Length == 0)
        { persona.EscuelaId = actor.EscuelaId; var datos = JsonDatos.Leer<Dictionary<string, object?>>(persona.DatosJson); datos["escuelaId"] = actor.EscuelaId; persona.DatosJson = JsonDatos.Serializar(datos); }
        TutoriaError.Exigir(!await db.Usuarios.AnyAsync(u => u.PersonaId == persona.Id && u.Rol == input.Rol && u.Issuer == SeguridadCuenta.Issuer, ct), "La persona ya tiene una cuenta de este perfil.", 409);
        var password = "UNAS-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12));
        var user = credenciales.Crear(persona, email, input.Rol, password, true);
        var ahora = clock.GetUtcNow();
        EncolarInvitacion(user, email, password, ahora);
        context.Auditar(actor, "crear-cuenta-" + input.Rol, user.Id, user.Version);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new(user.Id, user.Identificador, password, 172800, "pendiente");
    }
    private void EncolarInvitacion(UsuarioEntity user, string email, string password, DateTimeOffset ahora) =>
        cola.Agregar(email, "Tu acceso temporal · Tutoría UNAS", $"Coordinación preparó tu acceso a Tutoría UNAS.\n\nPerfil: {user.Rol}\nUsuario: {email}\nContraseña temporal: {password}\nVence en 48 horas.\n\nIngresa en {options.Value.UrlAcceso}, pulsa Verificar cuenta, confirma el código recibido en este correo y establece tu contraseña personal. No compartas tus credenciales.", ahora.AddHours(48), user.Id);

    public async Task<CuentaCreadaDto> RenovarTemporal(string id, int version, CancellationToken ct)
    {
        var actor = await Actor("editar", ct);
        var email = await db.CredencialesCuenta.Where(c => c.UsuarioId == id).Select(c => c.CorreoNormalizado).SingleOrDefaultAsync(ct) ?? throw new TutoriaError(404, "Cuenta no disponible.");
        await using var tx = await credenciales.Bloquear(email, ct);
        var user = await db.Usuarios.SingleAsync(u => u.Id == id, ct); var cred = await db.CredencialesCuenta.SingleAsync(c => c.UsuarioId == id, ct);
        TutoriaError.Exigir(user.Id != actor.Usuario.Id && user.EscuelaId == actor.EscuelaId && user.Activo && !cred.Verificada && cred.CambioObligatorio, "Solo se renuevan accesos temporales pendientes de tu escuela.", 403);
        TutoriaContext.Version(version, user.Version);
        var ahora = clock.GetUtcNow(); var password = "UNAS-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12));
        credenciales.CambiarPassword(cred, password); cred.TemporalHasta = ahora.AddHours(48); cred.IntentosFallidos = 0; cred.BloqueadaHasta = null; user.Version++;
        await cola.CancelarRetos(email, "activacion", ahora, ct);
        foreach (var pendiente in await db.CorreosCuenta.Where(m => m.UsuarioId == id && m.Enviado == null && m.Cancelado == null).ToArrayAsync(ct)) { pendiente.Cancelado = ahora; pendiente.ContenidoProtegido = ""; }
        EncolarInvitacion(user, email, password, ahora); context.Auditar(actor, "renovar-acceso-temporal", id, user.Version);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new(user.Id, user.Identificador, password, 172800, "pendiente");
    }
    public async Task Vincular(string id, int version, CancellationToken ct)
    {
        var actor = await Actor("editar", ct);
        var email = await db.CredencialesCuenta.Where(c => c.UsuarioId == id).Select(c => c.CorreoNormalizado).SingleOrDefaultAsync(ct) ?? throw new TutoriaError(404, "Cuenta no disponible.");
        await using var tx = await credenciales.Bloquear(email, ct);
        var u = await db.Usuarios.SingleAsync(u => u.Id == id, ct); var p = await db.Personas.SingleAsync(p => p.Id == u.PersonaId, ct);
        TutoriaError.Exigir(u.EscuelaId == "" && u.Rol == "tutor" && (p.EscuelaId == "" || p.EscuelaId == actor.EscuelaId), "La cuenta ya está vinculada o pertenece a otra escuela.", 409);
        TutoriaContext.Version(version, u.Version); u.EscuelaId = actor.EscuelaId; u.Activo = true; u.Version++; p.EscuelaId = actor.EscuelaId;
        var datos = JsonDatos.Leer<Dictionary<string, object?>>(p.DatosJson); datos["escuelaId"] = actor.EscuelaId; p.DatosJson = JsonDatos.Serializar(datos);
        context.Auditar(actor, "vincular-cuenta-a-escuela", id, u.Version); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public async Task Estado(string id, int version, bool activo, CancellationToken ct)
    {
        var actor = await Actor("editar", ct); await using var tx = await context.Transaccion(actor, ct);
        var u = await db.Usuarios.SingleOrDefaultAsync(u => u.Id == id && u.EscuelaId == actor.EscuelaId, ct) ?? throw new TutoriaError(404, "Cuenta no disponible.");
        TutoriaError.Exigir(u.Id != actor.Usuario.Id, "No puedes deshabilitar tu propia cuenta.", 409);
        TutoriaContext.Version(version, u.Version); u.Activo = activo; u.Version++;
        context.Auditar(actor, activo ? "habilitar-cuenta" : "deshabilitar-cuenta", id, u.Version); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
}
