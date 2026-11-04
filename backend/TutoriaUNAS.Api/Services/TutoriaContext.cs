using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;
using TutoriaUNAS.Api.Services.Accounts;

namespace TutoriaUNAS.Api.Services;

public sealed record ActorTutoria(UsuarioEntity Usuario, PersonaEntity Persona, Dictionary<string, string[]> Permisos)
{
    public bool Puede(string recurso, string accion) => Permisos.TryGetValue(recurso, out var acciones) && acciones.Contains(accion);
    public void Exigir(string recurso, string accion) => TutoriaError.Exigir(Puede(recurso, accion), "Tu cuenta no tiene permiso para esta operación.", 403);
    public string Id => Usuario.PersonaId;
    public string Rol => Usuario.Rol;
    public string EscuelaId => Usuario.EscuelaId;
    public UsuarioDto Dto => new(Usuario.Rol == "coordinacion" ? Usuario.Id : Id, Rol,
        JsonDatos.Texto(Persona.DatosJson, "nombres") + " " + JsonDatos.Texto(Persona.DatosJson, "apellidos"),
        Usuario.Identificador, JsonDatos.Texto(Persona.DatosJson, "correo"), Id);
}
public static class JsonDatos
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    public static string Serializar<T>(T value) => JsonSerializer.Serialize(value, Options);
    public static T Leer<T>(string value) => JsonSerializer.Deserialize<T>(value, Options)!;
    public static JsonElement Elemento(string value) => Leer<JsonElement>(value);
    public static string Texto(string json, string field) => Elemento(json).TryGetProperty(field, out var v) ? v.GetString() ?? "" : "";
    public static string Fecha(DateTimeOffset value) => TimeZoneInfo.ConvertTimeBySystemTimeZoneId(value, "America/Lima").ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
    public static InstrumentoDto Dto(InstrumentoEntity d) => new(d.Id, d.Formato, d.SemestreId, d.TutorId, d.EstudianteId, d.SesionId,
        d.Estado, d.Avance, d.Version, Fecha(d.Creado), Fecha(d.Actualizado), d.Enviado is { } fecha ? Fecha(fecha) : null,
        d.RevisadoPor, Elemento(d.ObservacionesJson), false, Leer<Dictionary<string, string>>(d.RespuestasJson));
    public static SesionDto Dto(SesionEntity s, string? soloEstudiante = null) => new(s.Id, "TUT-" + s.Id, s.Tipo, s.TutorId, s.SemestreId,
        s.Fecha, s.HoraInicio, s.HoraFin, s.Modalidad, s.Lugar, s.Tema, s.Objetivo, s.Estado,
        s.Asistentes.Where(a => soloEstudiante is null || a.EstudianteId == soloEstudiante).Select(a => new AsistenteDto(a.EstudianteId, a.Estado, a.HoraRegistro, a.Observacion)).ToArray(),
        Elemento(s.AcuerdosJson), s.InstrumentoId, null, s.AsistenciaConfirmada, s.Version, s.Asistentes.Count, s.Asistentes.Count(a => a.Estado is "asistio" or "tarde"));
}
public sealed class TutoriaContext(TutoriaDbContext db, IHttpContextAccessor accessor, TimeProvider clock)
{
    private ActorTutoria? actorResuelto;
    public DateTimeOffset Ahora => clock.GetUtcNow();
    public string Hoy => JsonDatos.Fecha(Ahora);
    public async Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> Transaccion(ActorTutoria actor, CancellationToken ct)
    {
        var tx = await db.Database.BeginTransactionAsync(ct);
        try { await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({actor.EscuelaId}, 0))", ct); return tx; }
        catch { await tx.DisposeAsync(); throw; }
    }
    public async Task<ActorTutoria> Actor(CancellationToken ct)
    {
        if (actorResuelto is not null) return actorResuelto;
        var principal = accessor.HttpContext?.User;
        if (principal?.Identity?.IsAuthenticated != true) throw new TutoriaError(401, "Inicia sesión para continuar.");
        var subject = principal.FindFirstValue("sub");
        var issuer = principal.FindFirstValue("iss");
        var user = await db.Usuarios.SingleOrDefaultAsync(u => u.Subject == subject && u.Issuer == issuer && u.Activo, ct);
        if (user is null || !principal.IsInRole(user.Rol)) throw new TutoriaError(403, "La identidad no está habilitada en el padrón tutorial.");
        TutoriaError.Exigir(user.Issuer is not ("local-development" or SeguridadCuenta.Issuer) || principal.FindFirstValue("access_version") == user.Version.ToString(System.Globalization.CultureInfo.InvariantCulture), "Tu habilitación cambió. Vuelve a iniciar sesión.", 401);
        if (user.Issuer == SeguridadCuenta.Issuer)
            TutoriaError.Exigir(await db.CredencialesCuenta.AnyAsync(c => c.UsuarioId == user.Id && c.Verificada && !c.CambioObligatorio, ct), "Verifica tu cuenta y establece tu contraseña para continuar.", 401);
        var persona = await db.Personas.SingleAsync(p => p.Id == user.PersonaId, ct);
        TutoriaError.Exigir(persona.Activa && persona.EscuelaId == user.EscuelaId, "La cuenta no tiene una vinculación vigente.", 403);
        var permisos = await db.Permisos.AsNoTracking().Where(p => p.Rol == user.Rol).ToArrayAsync(ct);
        return actorResuelto = new(user, persona, permisos.ToDictionary(p => p.Recurso, p => JsonDatos.Leer<string[]>(p.AccionesJson)));
    }
    public async Task<PeriodoEntity> Periodo(ActorTutoria actor, CancellationToken ct) =>
        await db.Periodos.SingleOrDefaultAsync(p => p.EscuelaId == actor.EscuelaId && p.Activo, ct) ?? throw new TutoriaError(409, "No hay un periodo tutorial activo para tu escuela.");
    public async Task ExigirPeriodoAbierto(ActorTutoria actor, CancellationToken ct)
    {
        var periodo = await Periodo(actor, ct);
        TutoriaError.Exigir(!await db.ConfiguracionPeriodos.AnyAsync(c => c.PeriodoId == periodo.Id && c.Cerrado, ct), "El periodo está cerrado para escritura. Coordinación debe reabrirlo para registrar cambios.", 409);
    }
    public async Task<AsignacionEntity> Asignacion(ActorTutoria actor, string estudianteId, string semestre, CancellationToken ct)
    {
        var a = await db.Asignaciones.SingleOrDefaultAsync(a => a.EstudianteId == estudianteId && a.SemestreId == semestre && a.Activa, ct);
        TutoriaError.Exigir(a is not null && a.EscuelaId == actor.EscuelaId &&
            (actor.Rol == "coordinacion" || (actor.Rol == "estudiante" ? a.EstudianteId == actor.Id : a.TutorId == actor.Id)),
            "El estudiante no pertenece a tu ámbito de tutoría.", 403);
        TutoriaError.Exigir(await db.Personas.AnyAsync(p => p.Id == estudianteId && p.Tipo == "estudiante" && p.Activa && p.EscuelaId == actor.EscuelaId, ct), "El estudiante no tiene una ficha activa en tu escuela.", 403);
        return a!;
    }
    public static void Version(int expected, int actual) => TutoriaError.Exigir(expected == actual, "El registro cambió en otro cliente. Actualiza antes de volver a guardar.", 409);
    public void Auditar(ActorTutoria actor, string accion, string recurso, int version) => db.Auditoria.Add(new()
    { Fecha = Ahora, UsuarioId = actor.Usuario.Id, EscuelaId = actor.EscuelaId, Accion = accion, RecursoId = recurso, Version = version });
}
