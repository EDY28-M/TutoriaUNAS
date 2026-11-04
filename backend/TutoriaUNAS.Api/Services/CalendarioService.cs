using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services;

public sealed class CalendarioService(TutoriaDbContext db, TutoriaContext context)
{
    public static JsonElement Dto(CalendarioDocenteEntity e)
    {
        var d = JsonDatos.Leer<Dictionary<string, object?>>(e.DatosJson);
        d["id"] = e.Id; d["tutorId"] = e.TutorId; d["version"] = e.Version; d["createdAt"] = e.Creado.ToString("O"); return SistemaService.Elemento(d);
    }
    public async Task<JsonElement[]> Listar(CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        var tutores = await db.Asignaciones.Where(a => a.EstudianteId == actor.Id && a.Activa).Select(a => a.TutorId).ToArrayAsync(ct);
        return (await db.CalendarioDocente.AsNoTracking().Where(c => c.EscuelaId == actor.EscuelaId && (actor.Rol == "coordinacion" || (actor.Rol == "tutor" ? c.TutorId == actor.Id : tutores.Contains(c.TutorId)))).ToArrayAsync(ct)).Select(Dto).ToArray();
    }
    public static string[] Fechas(CalendarioInput r)
    {
        if (!DateOnly.TryParseExact(r.DateFrom, "yyyy-MM-dd", out var inicio) || !DateOnly.TryParseExact(r.DateTo, "yyyy-MM-dd", out var fin)) return [];
        var fechas = new List<string>();
        for (var d = inicio; d <= fin && fechas.Count <= 367; d = d.AddDays(1))
        { var dia = (int)d.DayOfWeek; if (r.Days.Contains(dia == 0 ? 7 : dia)) fechas.Add(d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)); }
        return fechas.ToArray();
    }
    public static bool Cruza(CalendarioInput a, CalendarioInput b) => string.CompareOrdinal(a.StartTime, b.EndTime) < 0 && string.CompareOrdinal(b.StartTime, a.EndTime) < 0 && Fechas(a).Intersect(Fechas(b)).Any();
    public async Task<JsonElement> Guardar(string? id, CalendarioInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct); TutoriaError.Exigir(actor.Rol == "tutor", "Solo el tutor puede editar su disponibilidad.", 403);
        await using var tx = await context.Transaccion(actor, ct); var p = await context.Periodo(actor, ct);
        await context.ExigirPeriodoAbierto(actor, ct);
        TutoriaError.Exigir(r.Kind is "curso" or "tutoria" && r.Title.Trim().Length is >= 3 and <= 100 && r.Location.Trim().Length is >= 2 and <= 180 && r.Modality is "presencial" or "virtual" or "mixta" && r.SemesterId == p.SemestreId &&
            r.Days is { Length: > 0 and <= 7 } && r.Days.Distinct().Count() == r.Days.Length && r.Days.All(d => d is >= 1 and <= 7) && SistemaService.FechaValida(r.DateFrom) && SistemaService.FechaValida(r.DateTo) &&
            string.CompareOrdinal(r.DateFrom, r.DateTo) <= 0 && DateOnly.Parse(r.DateTo, CultureInfo.InvariantCulture).DayNumber - DateOnly.Parse(r.DateFrom, CultureInfo.InvariantCulture).DayNumber <= 366 &&
            TimeOnly.TryParseExact(r.StartTime, "HH:mm", out _) && TimeOnly.TryParseExact(r.EndTime, "HH:mm", out _) && string.CompareOrdinal(r.StartTime, r.EndTime) < 0 && r.Capacity is null or >= 1 and <= 200, "Revisa los datos y fechas del horario.");
        var config = await db.ConfiguracionPeriodos.FindAsync([p.Id], ct);
        TutoriaError.Exigir(config is null || (string.CompareOrdinal(r.DateFrom, config.Inicio) >= 0 && string.CompareOrdinal(r.DateTo, config.Fin) <= 0), "El horario debe estar dentro de las fechas del semestre.");
        var fechas = Fechas(r); TutoriaError.Exigir(fechas.Length > 0, "Los días seleccionados no ocurren en ese rango de fechas.");
        var horarios = await db.CalendarioDocente.Where(c => c.TutorId == actor.Id && c.Id != id).ToArrayAsync(ct);
        TutoriaError.Exigir(!horarios.Any(h => Cruza(JsonDatos.Leer<CalendarioInput>(h.DatosJson), r)), "El horario coincide con otro bloque del docente.", 409);
        if (r.Kind == "curso")
        {
            var sesiones = await db.Sesiones.Where(s => s.TutorId == actor.Id && s.Estado != "cancelada" && s.Estado != "reprogramada" && fechas.Contains(s.Fecha)).ToArrayAsync(ct);
            TutoriaError.Exigir(!sesiones.Any(s => string.CompareOrdinal(s.HoraInicio, r.EndTime) < 0 && string.CompareOrdinal(r.StartTime, s.HoraFin) < 0), "El curso coincide con una sesión de tutoría.", 409);
        }
        var item = id is null ? new CalendarioDocenteEntity { Id = "CAL-" + Guid.NewGuid(), TutorId = actor.Id, EscuelaId = actor.EscuelaId, SemestreId = p.SemestreId, Creado = context.Ahora, Version = 0 } : await db.CalendarioDocente.SingleOrDefaultAsync(c => c.Id == id && c.TutorId == actor.Id, ct) ?? throw new TutoriaError(404, "Horario no disponible.");
        TutoriaContext.Version(r.Version ?? 0, item.Version); if (id is null) db.CalendarioDocente.Add(item);
        item.DatosJson = JsonDatos.Serializar(r); item.Version++; context.Auditar(actor, "guardar-horario-docente", item.Id, item.Version); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Dto(item);
    }
    public async Task Eliminar(string id, int version, CancellationToken ct)
    {
        var actor = await context.Actor(ct); await using var tx = await context.Transaccion(actor, ct);
        await context.ExigirPeriodoAbierto(actor, ct);
        var c = await db.CalendarioDocente.SingleOrDefaultAsync(c => c.Id == id && c.TutorId == actor.Id, ct) ?? throw new TutoriaError(404, "Horario no disponible.");
        TutoriaContext.Version(version, c.Version); db.CalendarioDocente.Remove(c); context.Auditar(actor, "eliminar-horario-docente", c.Id, c.Version); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
}
