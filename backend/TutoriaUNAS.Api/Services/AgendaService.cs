using System.Globalization;
using Microsoft.EntityFrameworkCore;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services;

public sealed class AgendaService(TutoriaDbContext db, TutoriaContext context)
{
    public async Task<SesionDto> Programar(ProgramarSesionDto request, CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        var periodo = await context.Periodo(actor, ct);
        await using var tx = await context.Transaccion(actor, ct);
        var s = await ProgramarInterno(db, context, actor, request, periodo.SemestreId, ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return JsonDatos.Dto(s);
    }
    public static async Task<SesionEntity> ProgramarInterno(TutoriaDbContext db, TutoriaContext context, ActorTutoria actor, ProgramarSesionDto r, string semestre, CancellationToken ct, string? reemplazaId = null)
    {
        TutoriaError.Exigir(actor.Rol == "tutor", "Solo el docente tutor puede programar sesiones.", 403);
        await context.ExigirPeriodoAbierto(actor, ct);
        TutoriaError.Exigir(r.Tipo is "individual" or "grupal" && r.Modalidad is "presencial" or "virtual" or "mixta", "Tipo o modalidad inválidos.");
        TutoriaError.Exigir(DateOnly.TryParseExact(r.Fecha, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fecha) &&
            TimeOnly.TryParseExact(r.HoraInicio, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _) &&
            TimeOnly.TryParseExact(r.HoraFin, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _) && string.CompareOrdinal(r.HoraFin, r.HoraInicio) > 0, "Fecha u horario inválidos.");
        var inicio = DateTimeOffset.ParseExact($"{r.Fecha}T{r.HoraInicio}:00-05:00", "yyyy-MM-dd'T'HH:mm:sszzz", CultureInfo.InvariantCulture);
        TutoriaError.Exigir(inicio > context.Ahora, "Programa una fecha y hora futuras.");
        TutoriaError.Exigir(!string.IsNullOrWhiteSpace(r.Lugar) && r.Lugar.Length <= 300 && !string.IsNullOrWhiteSpace(r.Tema) && r.Tema.Length <= 200 && !string.IsNullOrWhiteSpace(r.Objetivo) && r.Objetivo.Length <= 2000, "Completa el lugar, tema y objetivo de la sesión.");
        TutoriaError.Exigir(r.Estudiantes is { Length: > 0 and <= 100 } && r.Estudiantes.Distinct().Count() == r.Estudiantes.Length && (r.Tipo == "individual" ? r.Estudiantes.Length == 1 : r.Estudiantes.Length >= 2), "Selecciona los participantes sin duplicados.");
        // Serializa las convocatorias del mismo tutor, incluso desde dos procesos de la API.
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({actor.Id}, 0))", ct);
        foreach (var id in r.Estudiantes!) await context.Asignacion(actor, id, semestre, ct);
        var dia = (int)fecha.DayOfWeek; if (dia == 0) dia = 7;
        var horarios = await db.Horarios.Where(h => r.Estudiantes.Contains(h.EstudianteId) && h.SemestreId == semestre && h.Dia == dia).ToListAsync(ct);
        TutoriaError.Exigir(!horarios.Any(h => string.CompareOrdinal(h.HoraInicio, r.HoraFin) < 0 && string.CompareOrdinal(r.HoraInicio, h.HoraFin) < 0), "El horario coincide con una clase de los estudiantes.", 409);
        var agenda = await db.CalendarioDocente.Where(c => c.TutorId == actor.Id && c.SemestreId == semestre).ToArrayAsync(ct);
        TutoriaError.Exigir(!agenda.Select(c => JsonDatos.Leer<CalendarioInput>(c.DatosJson)).Any(c => c.Kind == "curso" && CalendarioService.Fechas(c).Contains(r.Fecha) && string.CompareOrdinal(c.StartTime, r.HoraFin) < 0 && string.CompareOrdinal(r.HoraInicio, c.EndTime) < 0), "El horario coincide con un curso en la agenda del tutor.", 409);
        var oficiales = await db.Fuentes.Where(f => f.Tipo == "horariosDocentes" && f.TutorId == actor.Id).ToArrayAsync(ct);
        TutoriaError.Exigir(!oficiales.Select(f => JsonDatos.Elemento(f.DatosJson)).Any(h => h.GetProperty("dia").GetInt32() == dia && string.CompareOrdinal(h.GetProperty("horaInicio").GetString(), r.HoraFin) < 0 && string.CompareOrdinal(r.HoraInicio, h.GetProperty("horaFin").GetString()) < 0), "El horario coincide con una clase oficial del tutor.", 409);
        var ocupadas = await db.Sesiones.Include(s => s.Asistentes).Where(s => s.Id != reemplazaId && s.Fecha == r.Fecha && s.Estado != "cancelada" && s.Estado != "reprogramada" && (s.TutorId == actor.Id || s.Asistentes.Any(a => r.Estudiantes.Contains(a.EstudianteId)))).ToListAsync(ct);
        TutoriaError.Exigir(!ocupadas.Any(s => string.CompareOrdinal(s.HoraInicio, r.HoraFin) < 0 && string.CompareOrdinal(r.HoraInicio, s.HoraFin) < 0), "El tutor o un estudiante ya tiene otra sesión en ese horario.", 409);
        var nueva = new SesionEntity { Id = "SES-" + Guid.NewGuid(), TutorId = actor.Id, EscuelaId = actor.EscuelaId, SemestreId = semestre, Tipo = r.Tipo, Fecha = r.Fecha, HoraInicio = r.HoraInicio, HoraFin = r.HoraFin, FinUtc = DateTimeOffset.Parse($"{r.Fecha}T{r.HoraFin}:00-05:00", CultureInfo.InvariantCulture).ToUniversalTime(), Modalidad = r.Modalidad, Lugar = r.Lugar.Trim(), Tema = r.Tema.Trim(), Objetivo = r.Objetivo.Trim(), Asistentes = r.Estudiantes.Select(id => new AsistenciaEntity { EstudianteId = id, Observacion = "Asistencia pendiente de registro" }).ToList() };
        db.Sesiones.Add(nueva); context.Auditar(actor, "programar-sesion", nueva.Id, nueva.Version);
        await ComunicacionService.Notificar(db, context, actor.EscuelaId, r.Estudiantes!, "estudiante", "sesion-programada:" + nueva.Id, "sesion", "Nueva sesión de tutoría", $"{nueva.Tema} · {nueva.Fecha} {nueva.HoraInicio}", "/estudiante/sesiones", ct);
        return nueva;
    }
    public async Task<SesionDto> Asistencia(string id, RegistrarAsistenciaDto request, CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        TutoriaError.Exigir(actor.Rol == "tutor", "Solo el tutor confirma la asistencia.", 403);
        await context.ExigirPeriodoAbierto(actor, ct);
        await using var tx = await context.Transaccion(actor, ct);
        var s = await db.Sesiones.Include(s => s.Asistentes).SingleOrDefaultAsync(s => s.Id == id && s.TutorId == actor.Id && s.EscuelaId == actor.EscuelaId, ct) ?? throw new TutoriaError(404, "Sesión no disponible.");
        TutoriaContext.Version(request.Version, s.Version);
        TutoriaError.Exigir(s.Estado is "programada" or "realizada" && s.FinUtc <= context.Ahora, "Registra la asistencia después de finalizar la sesión.", 409);
        TutoriaError.Exigir(request.Mensaje.Length <= 2000 && request.TipoTutoria is "Académica" or "Personal" or "Social", "Acuerdo o tipo de tutoría inválido.");
        TutoriaError.Exigir(request.Asistentes is not null && request.Asistentes.Length == s.Asistentes.Count && request.Asistentes.All(a => a is not null) && request.Asistentes.Select(a => a.EstudianteId).Distinct().Count() == s.Asistentes.Count && request.Asistentes.All(a => s.Asistentes.Any(original => original.EstudianteId == a.EstudianteId) && a.Estado is "asistio" or "tarde" or "falto" or "justificado" && (a.HoraRegistro is null || TimeOnly.TryParseExact(a.HoraRegistro, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)) && (a.Observacion?.Length ?? 0) <= 1000), "La lista debe incluir una sola vez a cada participante convocado.");
        foreach (var a in request.Asistentes!)
        {
            await context.Asignacion(actor, a.EstudianteId, s.SemestreId, ct);
            if (a.Estado is "falto" or "justificado")
                TutoriaError.Exigir(!await db.Instrumentos.AnyAsync(d => d.SesionId == id && d.EstudianteId == a.EstudianteId && (d.Formato == "F10" || d.Formato == "F11") && (d.Estado == "enviado" || d.Estado == "aprobado"), ct), "Hay una evaluación enviada; su asistencia requiere una revisión institucional antes de modificarla.", 409);
            var actual = s.Asistentes.Single(original => original.EstudianteId == a.EstudianteId);
            actual.Estado = a.Estado; actual.HoraRegistro = a.HoraRegistro; actual.Observacion = a.Observacion;
        }
        s.AsistenciaConfirmada = true; s.Estado = "realizada"; s.Version++;
        if (!string.IsNullOrWhiteSpace(request.Mensaje))
        {
            var acuerdos = JsonDatos.Leer<List<Dictionary<string, object?>>>(s.AcuerdosJson);
            acuerdos.Add(new() { ["id"] = Guid.NewGuid().ToString(), ["descripcion"] = request.Mensaje.Trim(), ["responsable"] = "ambos", ["fechaCompromiso"] = null, ["estado"] = "pendiente" });
            s.AcuerdosJson = JsonDatos.Serializar(acuerdos);
        }
        var fid = "INST-ASISTENCIA-" + s.Id;
        var f = await db.Instrumentos.FindAsync([fid], ct);
        TutoriaError.Exigir(f?.Estado != "aprobado", "El formato de asistencia ya fue aprobado. Solicita su revisión antes de modificarlo.", 409);
        if (f is null) { f = DocumentosService.Nuevo(fid, s.Tipo == "individual" ? "F06" : "F07", s.TutorId, s.EscuelaId, s.SemestreId, null, context.Ahora, s.Id); db.Instrumentos.Add(f); }
        var filas = new List<Dictionary<string, string>>();
        foreach (var a in s.Asistentes.Where(a => a.Estado is "asistio" or "tarde"))
        {
            var e = (await db.Personas.FindAsync([a.EstudianteId], ct))!;
            var asignacion = await context.Asignacion(actor, a.EstudianteId, s.SemestreId, ct);
            filas.Add(new() { ["estudianteId"] = e.Id, ["nombre"] = DocumentosService.Nombre(e), ["ciclo"] = e.Ciclo!.Value.ToString(CultureInfo.InvariantCulture), ["grupo"] = asignacion.Grupo ?? "", ["tipo"] = request.TipoTutoria });
        }
        f.RespuestasJson = JsonDatos.Serializar(new Dictionary<string, string> { ["nombreTutor"] = actor.Dto.Name, ["fecha"] = s.Fecha, ["horaInicio"] = s.HoraInicio, ["horaFin"] = s.HoraFin, ["tema"] = s.Tema, ["grupo"] = string.Join(", ", filas.Select(f => f["grupo"]).Distinct()), ["asistentes"] = JsonDatos.Serializar(filas) });
        f.Estado = "enviado"; f.Enviado = context.Ahora; f.Actualizado = context.Ahora; f.Avance = 100; f.Version++;
        s.InstrumentoId = fid;
        context.Auditar(actor, "confirmar-asistencia", s.Id, s.Version);
        context.Auditar(actor, "generar-formato-asistencia", fid, f.Version);
        await ComunicacionService.Notificar(db, context, actor.EscuelaId, s.Asistentes.Select(a => a.EstudianteId).ToArray(), "estudiante", $"asistencia:{s.Id}:{s.Version}", "sesion", "Asistencia registrada", "Tu tutor confirmó la asistencia. Consulta el registro y la evaluación de esta sesión.", "/estudiante/instrumentos?sesion=" + s.Id, ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return JsonDatos.Dto(s);
    }
    public async Task<object> CambiarEstado(string id, EstadoSesionInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct); await using var tx = await context.Transaccion(actor, ct);
        await context.ExigirPeriodoAbierto(actor, ct);
        var s = await db.Sesiones.Include(s => s.Asistentes).SingleOrDefaultAsync(s => s.Id == id && s.TutorId == actor.Id && s.EscuelaId == actor.EscuelaId, ct) ?? throw new TutoriaError(404, "Sesión no disponible.");
        TutoriaError.Exigir(s.SemestreId == (await context.Periodo(actor, ct)).SemestreId, "La convocatoria pertenece a un semestre anterior.", 409);
        TutoriaContext.Version(r.Version, s.Version);
        TutoriaError.Exigir(s.Estado == "programada" && !s.AsistenciaConfirmada, "Solo puedes cancelar o reprogramar una sesión sin asistencia confirmada.", 409);
        TutoriaError.Exigir(r.Accion is "cancelar" or "reprogramar" && r.Motivo.Trim().Length is >= 3 and <= 1000, "Indica la acción y su motivo.");
        s.Estado = r.Accion == "cancelar" ? "cancelada" : "reprogramada"; s.Version++;
        SesionEntity? nueva = null;
        if (r.Accion == "reprogramar") nueva = await ProgramarInterno(db, context, actor, new(s.Tipo, r.Fecha ?? "", r.HoraInicio ?? "", r.HoraFin ?? "", s.Modalidad, s.Lugar, s.Tema, s.Objetivo, s.Asistentes.Select(a => a.EstudianteId).ToArray()), s.SemestreId, ct, s.Id);
        var acuerdos = JsonDatos.Leer<List<object>>(s.AcuerdosJson); acuerdos.Add(new { id = Guid.NewGuid().ToString(), descripcion = r.Motivo.Trim(), responsable = "tutor", fechaCompromiso = (string?)null, estado = "cumplido" }); s.AcuerdosJson = JsonDatos.Serializar(acuerdos);
        context.Auditar(actor, "sesion-" + s.Estado, s.Id, s.Version);
        await ComunicacionService.Notificar(db, context, actor.EscuelaId, s.Asistentes.Select(a => a.EstudianteId).ToArray(), "estudiante", $"estado-sesion:{s.Id}:{s.Version}", "sesion", "Sesión " + s.Estado, "Se actualizó la convocatoria de tutoría. Consulta los acuerdos.", "/estudiante/sesiones", ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { sesion = JsonDatos.Dto(s), nueva = nueva is null ? null : JsonDatos.Dto(nueva) };
    }
}
