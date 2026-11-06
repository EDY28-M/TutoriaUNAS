using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services;

public sealed class GestionSistemaService(TutoriaDbContext db, TutoriaContext context, EstadoTutoriaService estado)
{
    public async Task SolicitarCambio(SolicitudCambioInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct); TutoriaError.Exigir(actor.Rol == "estudiante", "Solo el estudiante puede presentar su solicitud.", 403);
        await using var tx = await context.Transaccion(actor, ct); var p = await context.Periodo(actor, ct);
        var a = await context.Asignacion(actor, actor.Id, p.SemestreId, ct);
        TutoriaError.Exigir(r.Motivo.Trim().Length is >= 10 and <= 2000, "Explica el motivo con entre 10 y 2000 caracteres.");
        TutoriaError.Exigir(!await db.SolicitudesCambio.AnyAsync(s => s.EstudianteId == actor.Id && s.SemestreId == p.SemestreId && s.Estado == "pendiente", ct), "Ya tienes una solicitud pendiente de respuesta.", 409);
        var solicitud = new SolicitudCambioEntity { Id = "CAM-" + Guid.NewGuid(), EstudianteId = actor.Id, TutorActualId = a.TutorId, EscuelaId = actor.EscuelaId, SemestreId = p.SemestreId, Motivo = r.Motivo.Trim(), Creado = context.Ahora };
        db.SolicitudesCambio.Add(solicitud); context.Auditar(actor, "solicitar-cambio-tutor", solicitud.Id, 1);
        await ComunicacionService.Notificar(db, context, actor.EscuelaId, [], "coordinacion", "cambio:" + solicitud.Id, "sistema", "Solicitud de cambio de tutor", "Hay una solicitud pendiente de revisión.", "/coordinacion/asignaciones", ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public async Task ResolverCambio(string id, ResolverSolicitudInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct); TutoriaError.Exigir(actor.Rol == "coordinacion", "Solo coordinación resuelve solicitudes.", 403);
        TutoriaError.Exigir(r.Respuesta.Trim().Length is >= 3 and <= 1000 && r.Decision is "aprobada" or "rechazada", "Indica la decisión y su respuesta.");
        var solicitud = await db.SolicitudesCambio.AsNoTracking().SingleOrDefaultAsync(s => s.Id == id && (actor.ConsultaInstitucional || s.EscuelaId == actor.EscuelaId), ct) ?? throw new TutoriaError(404, "Solicitud no disponible.");
        actor = actor.ParaEscuela(solicitud.EscuelaId);
        if (r.Decision == "aprobada")
        {
            TutoriaError.Exigir(!string.IsNullOrWhiteSpace(r.TutorId), "Selecciona el nuevo tutor.");
            var a = await db.Asignaciones.AsNoTracking().SingleAsync(a => a.EstudianteId == solicitud.EstudianteId && a.SemestreId == solicitud.SemestreId && a.Activa, ct);
            await estado.Asignar(new(solicitud.EstudianteId, r.TutorId!, a.Grupo, r.Respuesta.Trim(), r.AsignacionVersion, solicitud.Id, r.Version), ct);
            return;
        }
        await using var tx = await context.Transaccion(actor, ct);
        var s = await db.SolicitudesCambio.SingleAsync(s => s.Id == id, ct); TutoriaContext.Version(r.Version, s.Version);
        TutoriaError.Exigir(s.Estado == "pendiente", "La solicitud ya fue resuelta.", 409);
        s.Estado = "rechazada"; s.Respuesta = r.Respuesta.Trim(); s.ResueltoPor = actor.Usuario.Id; s.Resuelto = context.Ahora; s.Version++;
        context.Auditar(actor, "resolver-cambio-tutor", s.Id, s.Version);
        await ComunicacionService.Notificar(db, context, actor.EscuelaId, [s.EstudianteId], "estudiante", "cambio-resuelto:" + s.Id, "sistema", "Respuesta a tu solicitud de tutor", s.Respuesta, "/estudiante/tutor", ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public async Task<string> Actividad(string? id, ActividadInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        if (actor.ConsultaInstitucional)
            actor = actor.ParaEscuela(id is null
                ? await db.Personas.AsNoTracking().Where(p => p.Id == r.ResponsableId && p.Tipo == "tutor").Select(p => p.EscuelaId).SingleOrDefaultAsync(ct)
                : await db.ActividadesPlan.AsNoTracking().Where(a => a.Id == id).Select(a => a.EscuelaId).SingleOrDefaultAsync(ct));
        actor.ExigirEscuelaParaGestion();
        await using var tx = await context.Transaccion(actor, ct); var p = await context.Periodo(actor, ct);
        await context.ExigirPeriodoAbierto(actor, ct);
        TutoriaError.Exigir(actor.Rol == "coordinacion", "Solo coordinación administra el plan de la escuela.", 403);
        TutoriaError.Exigir(new[] { r.Problematica, r.Objetivo, r.Actividad, r.Meta }.All(s => !string.IsNullOrWhiteSpace(s) && s.Length <= 1000) && r.Evidencia.Length <= 2000 && r.Aprobacion.Length <= 500 &&
            SistemaService.FechaValida(r.FechaInicio) && SistemaService.FechaValida(r.FechaFin) && string.CompareOrdinal(r.FechaInicio, r.FechaFin) <= 0 && r.Avance is >= 0 and <= 100 && r.Estado is "planificada" or "en-ejecucion" or "culminada" or "reprogramada", "Revisa los datos, fechas y avance de la actividad.");
        TutoriaError.Exigir(r.Estado != "culminada" || (r.Avance == 100 && !string.IsNullOrWhiteSpace(r.Evidencia)), "Registra la evidencia y el avance completo de una actividad culminada.");
        TutoriaError.Exigir(await db.Personas.AnyAsync(p => p.Id == r.ResponsableId && p.Tipo == "tutor" && p.EscuelaId == actor.EscuelaId && p.Activa, ct), "El responsable debe ser un docente activo de tu escuela.", 403);
        var a = id is null ? new ActividadPlanEntity { Id = "PLAN-" + Guid.NewGuid(), EscuelaId = actor.EscuelaId, SemestreId = p.SemestreId, Version = 0 } : await db.ActividadesPlan.SingleOrDefaultAsync(a => a.Id == id && a.EscuelaId == actor.EscuelaId && a.SemestreId == p.SemestreId, ct) ?? throw new TutoriaError(404, "Actividad no disponible.");
        TutoriaContext.Version(r.Version, a.Version); if (id is null) db.ActividadesPlan.Add(a);
        a.Problematica = r.Problematica.Trim(); a.Objetivo = r.Objetivo.Trim(); a.Actividad = r.Actividad.Trim(); a.Meta = r.Meta.Trim(); a.FechaInicio = r.FechaInicio; a.FechaFin = r.FechaFin;
        a.ResponsableId = r.ResponsableId; a.Evidencia = r.Evidencia.Trim(); a.Aprobacion = r.Aprobacion.Trim(); a.Avance = r.Avance; a.Estado = r.Estado; a.Version++;
        context.Auditar(actor, "guardar-actividad-plan", a.Id, a.Version); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return a.Id;
    }
    public async Task Seguimiento(string id, SeguimientoInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        if (actor.ConsultaInstitucional)
            actor = actor.ParaEscuela(await db.Instrumentos.AsNoTracking().Where(d => d.Id == id && d.Formato == "F12").Select(d => d.EscuelaId).SingleOrDefaultAsync(ct));
        await using var tx = await context.Transaccion(actor, ct);
        TutoriaError.Exigir(actor.Rol == "coordinacion", "Coordinación registra la comunicación administrativa del área.", 403);
        await context.ExigirPeriodoAbierto(actor, ct);
        var d = await db.Instrumentos.SingleOrDefaultAsync(d => d.Id == id && d.Formato == "F12" && d.EscuelaId == actor.EscuelaId && (d.Estado == "enviado" || d.Estado == "aprobado"), ct) ?? throw new TutoriaError(404, "Derivación no disponible.");
        var s = await db.Seguimientos.SingleOrDefaultAsync(s => s.InstrumentoId == id, ct);
        TutoriaContext.Version(r.Version, s?.Version ?? 0);
        var transiciones = new Dictionary<string, string[]> { ["registrada"] = ["recibida", "cerrada"], ["recibida"] = ["citada", "en-atencion", "cerrada"], ["citada"] = ["en-atencion", "no-presentado", "cerrada"], ["en-atencion"] = ["atendida", "seguimiento"], ["atendida"] = ["seguimiento", "cerrada"], ["seguimiento"] = ["citada", "atendida", "cerrada"], ["no-presentado"] = ["citada", "cerrada"], ["cerrada"] = [] };
        var actual = s?.Estado ?? "registrada";
        TutoriaError.Exigir(transiciones.GetValueOrDefault(actual, []).Contains(r.Estado), "La transición no corresponde al estado actual.", 409);
        TutoriaError.Exigir(r.Nota.Trim().Length is >= 3 and <= 1000 && r.ResponsableArea.Trim().Length is >= 3 and <= 200 && r.SiguienteAccion.Length <= 1000 && (r.RecomendacionComunicable?.Length ?? 0) <= 1000 &&
            (r.FechaCita is null || (SistemaService.FechaValida(r.FechaCita) && string.CompareOrdinal(r.FechaCita, context.Hoy) >= 0)) &&
            (r.VigenciaRecomendacion is null || SistemaService.FechaValida(r.VigenciaRecomendacion)) && (r.Estado != "citada" || r.FechaCita is not null), "Registra la comunicación administrativa y sus fechas. No incluyas información clínica.");
        if (s is null) { s = new() { Id = "SEG-" + id, InstrumentoId = id, EstudianteId = d.EstudianteId!, TutorId = d.TutorId, EscuelaId = d.EscuelaId, SemestreId = d.SemestreId, Area = JsonDatos.Leer<Dictionary<string, string>>(d.RespuestasJson).GetValueOrDefault("area", ""), Version = 0 }; db.Seguimientos.Add(s); }
        s.Estado = r.Estado; s.ResponsableArea = r.ResponsableArea.Trim(); s.SiguienteAccion = r.SiguienteAccion.Trim(); s.FechaCita = r.FechaCita; s.RecomendacionComunicable = r.RecomendacionComunicable?.Trim(); s.VigenciaRecomendacion = r.VigenciaRecomendacion; s.Actualizado = context.Ahora; s.Version++;
        var history = JsonDatos.Leer<List<object>>(s.HistorialJson); history.Add(new { fecha = context.Ahora.ToString("O"), estado = s.Estado, nota = r.Nota.Trim(), responsable = actor.Dto.Name }); s.HistorialJson = JsonDatos.Serializar(history);
        context.Auditar(actor, "registrar-seguimiento-comunicable", s.Id, s.Version);
        await ComunicacionService.Notificar(db, context, actor.EscuelaId, [s.EstudianteId], "estudiante", $"seguimiento:{s.Id}:{s.Version}", "derivacion", "Actualización de tu solicitud de apoyo", "El área comunicó un nuevo estado administrativo.", "/estudiante/derivaciones", ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public async Task Inscribir(string id, bool inscribir, CancellationToken ct)
    {
        var actor = await context.Actor(ct); TutoriaError.Exigir(actor.Rol == "estudiante", "La inscripción corresponde al estudiante.", 403);
        await using var tx = await context.Transaccion(actor, ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"campana:" + id}, 0))", ct);
        var f = await db.Fuentes.SingleOrDefaultAsync(f => f.Tipo == "campanasSalud" && f.Id == id, ct) ?? throw new TutoriaError(404, "Actividad no disponible.");
        var data = JsonDatos.Elemento(f.DatosJson);
        TutoriaError.Exigir(data.GetProperty("escuelas").EnumerateArray().Any(e => e.GetString() == actor.EscuelaId), "La actividad no está dirigida a tu escuela.", 403);
        TutoriaError.Exigir(string.CompareOrdinal(data.GetProperty("fecha").GetString(), context.Hoy) >= 0, "La actividad ya finalizó.", 409);
        var item = await db.Inscripciones.FindAsync([id, actor.Id], ct);
        if (inscribir && item is null)
        {
            TutoriaError.Exigir(await db.Inscripciones.CountAsync(i => i.CampanaId == id, ct) + data.GetProperty("inscritos").GetInt32() < data.GetProperty("cupos").GetInt32(), "Ya no quedan cupos disponibles.", 409);
            db.Inscripciones.Add(new() { CampanaId = id, EstudianteId = actor.Id, Fecha = context.Ahora });
        }
        else if (!inscribir && item is not null) db.Inscripciones.Remove(item);
        context.Auditar(actor, inscribir ? "inscribir-actividad" : "cancelar-inscripcion", id, 0); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }

    public async Task EliminarActividad(string id, int version, CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        if (actor.ConsultaInstitucional)
            actor = actor.ParaEscuela(await db.ActividadesPlan.AsNoTracking().Where(a => a.Id == id).Select(a => a.EscuelaId).SingleOrDefaultAsync(ct));
        await using var tx = await context.Transaccion(actor, ct);
        TutoriaError.Exigir(actor.Rol == "coordinacion", "Solo coordinación administra el plan.", 403);
        await context.ExigirPeriodoAbierto(actor, ct);
        var p = await context.Periodo(actor, ct);
        var a = await db.ActividadesPlan.SingleOrDefaultAsync(a => a.Id == id && a.EscuelaId == actor.EscuelaId && a.SemestreId == p.SemestreId, ct) ?? throw new TutoriaError(404, "Actividad no disponible.");
        TutoriaContext.Version(version, a.Version);
        TutoriaError.Exigir(a.Estado == "planificada" && a.Avance == 0 && !await db.Instrumentos.AnyAsync(d => d.EscuelaId == a.EscuelaId && d.SemestreId == a.SemestreId && d.Formato == "F01" && (d.Estado == "enviado" || d.Estado == "aprobado"), ct), "Solo se elimina una actividad sin ejecución ni informe enviado.", 409);
        db.ActividadesPlan.Remove(a); context.Auditar(actor, "eliminar-actividad-plan", id, a.Version); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
}
