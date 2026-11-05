using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Nodes;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services;

public sealed class EstadoTutoriaService(TutoriaDbContext db, TutoriaContext context, DocumentosService documentos, SistemaService sistema)
{
    public async Task<EstadoTutoriaDto> Obtener(CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        var periodo = await context.Periodo(actor, ct);
        var asignaciones = await db.Asignaciones.AsNoTracking().Where(a => a.EscuelaId == actor.EscuelaId && a.Activa &&
            (actor.Rol == "coordinacion" || (actor.Rol == "tutor" ? a.TutorId == actor.Id : a.EstudianteId == actor.Id))).ToArrayAsync(ct);
        var ids = asignaciones.Select(a => a.EstudianteId).Append(actor.Id).Distinct().ToArray();
        var tutores = asignaciones.Select(a => a.TutorId).Append(actor.Id).Distinct().ToArray();
        var personas = await db.Personas.AsNoTracking().Where(p => p.EscuelaId == actor.EscuelaId &&
            (actor.Rol == "coordinacion" || (p.Tipo == "estudiante" ? ids.Contains(p.Id) : tutores.Contains(p.Id)))).ToArrayAsync(ct);
        var sesiones = await db.Sesiones.AsNoTracking().Include(s => s.Asistentes).Where(s => s.EscuelaId == actor.EscuelaId &&
            (actor.Rol == "coordinacion" || (actor.Rol == "tutor" ? s.TutorId == actor.Id : s.Asistentes.Any(a => a.EstudianteId == actor.Id)))).ToArrayAsync(ct);
        var candidatas = await db.Instrumentos.AsNoTracking().Where(d => d.EscuelaId == actor.EscuelaId &&
            (actor.Rol == "coordinacion" || (actor.Rol == "estudiante" ? d.EstudianteId == actor.Id : d.TutorId == actor.Id))).ToArrayAsync(ct);
        var registros = new List<InstrumentoDto>();
        var historial = new List<InstrumentoDto>();
        if (actor.Rol == "estudiante" && actor.Puede("formularios", "ver"))
            foreach (var d in candidatas.Where(d => d.Estado is "enviado" or "aprobado"))
                if (await documentos.PuedeLeer(actor, d, ct)) historial.Add(JsonDatos.Dto(d));
        foreach (var d in candidatas.Where(_ => actor.Puede("formularios", "ver")))
        {
            // El historial se conserva; la bandeja solo presenta la entrevista vigente.
            if (actor.Rol == "estudiante" && d.Formato is "F03" or "F04" or "F05")
            {
                var estudiante = personas.Single(p => p.Id == actor.Id);
                if (estudiante.Ciclo is null || d.SemestreId != periodo.SemestreId || d.Formato != EtapasTutoria.FormatoEntrevistaInicial(estudiante.Ciclo.Value)) continue;
            }
            if (await documentos.PuedeLeerResumen(actor, d, ct))
                registros.Add(await documentos.PuedeLeer(actor, d, ct) ? JsonDatos.Dto(d) : JsonDatos.Dto(d) with { Respuestas = [] });
        }
        if (actor.Rol == "estudiante" && actor.Puede("formularios", "ver"))
            foreach (var s in sesiones)
            {
                var id = DocumentosService.IdEvaluacion(s, actor.Id);
                if (registros.Any(r => r.Id == id)) continue;
                var d = DocumentosService.Nuevo(id, s.Tipo == "individual" ? "F10" : "F11", s.TutorId, s.EscuelaId, s.SemestreId, actor.Id, context.Ahora, s.Id);
                d.RespuestasJson = JsonDatos.Serializar(await documentos.Canonizar(d, [], ct));
                registros.Add(JsonDatos.Dto(d));
            }
        var expediente = await db.Expediente.AsNoTracking().Where(e => actor.Puede("formularios", "ver") && ids.Contains(e.EstudianteId) &&
            (actor.Rol == "estudiante" || db.Instrumentos.Any(origen => origen.Id == e.DocumentoId && (origen.Estado == "enviado" || origen.Estado == "aprobado")))).ToArrayAsync(ct);
        var precargas = new Dictionary<string, Dictionary<string, string>>();
        foreach (var estudiante in personas.Where(p => p.Tipo == "estudiante"))
            foreach (var formato in Enumerable.Range(1, 12).Select(n => $"F{n:00}"))
            {
                precargas[$"{estudiante.Id}|{periodo.SemestreId}|{formato}"] = DocumentosService.Precargar(DocumentosService.DatosParaPeriodo(expediente.Where(e => e.EstudianteId == estudiante.Id), periodo.SemestreId), formato);
            }
        // Coordinación consulta la matrícula de todo el padrón de su escuela, no solo de quienes ya tienen
        // tutor asignado; tutor y estudiante conservan su alcance.
        var idsMatricula = actor.Rol == "coordinacion" ? personas.Where(p => p.Tipo == "estudiante").Select(p => p.Id).ToArray() : ids;
        var matriculas = await db.Matriculas.AsNoTracking().Where(m => idsMatricula.Contains(m.EstudianteId)).ToArrayAsync(ct);
        foreach (var d in candidatas.Where(d => d.SemestreId == periodo.SemestreId && ((actor.Rol == "tutor" && d.TutorId == actor.Id && d.Formato == "F02") || (actor.Rol == "coordinacion" && d.Formato == "F01"))))
            precargas[$"{d.TutorId}|{d.SemestreId}|{d.Formato}"] = await documentos.Canonizar(d, [], ct);
        var horarios = await db.Horarios.AsNoTracking().Where(h => ids.Contains(h.EstudianteId)).ToArrayAsync(ct);
        var personasIds = personas.Select(p => p.Id).ToArray();
        var contactos = await db.Contactos.AsNoTracking().Where(c => personasIds.Contains(c.PersonaId)).ToDictionaryAsync(c => c.PersonaId, ct);
        JsonElement Persona(PersonaEntity p)
        {
            var data = JsonDatos.Leer<Dictionary<string, object?>>(p.DatosJson);
            if (p.Tipo == "estudiante") data["ciclo"] = p.Ciclo;
            if (p.Tipo == "tutor") data["activo"] = p.Activa;
            if (contactos.TryGetValue(p.Id, out var contacto)) { data["correo"] = contacto.Correo; data["telefono"] = contacto.Telefono; }
            return SistemaService.Elemento(data);
        }
        return new(actor.Dto, periodo.SemestreId, periodo.Momento, periodo.Version,
            personas.Where(p => p.Tipo == "estudiante").Select(Persona).ToArray(),
            personas.Where(p => p.Tipo == "tutor").Select(Persona).ToArray(),
            asignaciones.Select(a => { var datos = JsonDatos.Leer<Dictionary<string, object?>>(a.DatosJson); datos["version"] = a.Version; return JsonDatos.Elemento(JsonDatos.Serializar(datos)); }).ToArray(), matriculas.Select(m => JsonDatos.Elemento(SinHorariosOriginales(m.DatosJson))).ToArray(),
            horarios.Select(h => JsonDatos.Elemento(h.DatosJson)).ToArray(), registros.ToArray(),
            actor.Puede("sesiones", "ver") ? sesiones.Select(s => JsonDatos.Dto(s, actor.Rol == "estudiante" ? actor.Id : null)).ToArray() : [], precargas,
            await sistema.Obtener(actor, periodo, ct), historial.ToArray());
    }
    /// <summary>El detalle de aulas por curso solo lo consulta el padrón; el estado lleva el resumen del horario.</summary>
    public static string SinHorariosOriginales(string json)
    {
        if (JsonNode.Parse(json) is not JsonObject matricula) return json;
        if (matricula["cursos"] is JsonArray cursos)
            foreach (var curso in cursos.OfType<JsonObject>()) curso.Remove("horariosOriginales");
        return matricula.ToJsonString();
    }
    public async Task CambiarMomento(CambiarMomentoDto request, CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        TutoriaError.Exigir(actor.Rol == "coordinacion", "Solo coordinación puede cambiar el momento del semestre.", 403);
        await using var tx = await context.Transaccion(actor, ct);
        var periodo = await context.Periodo(actor, ct);
        TutoriaContext.Version(request.Version, periodo.Version);
        TutoriaError.Exigir(request.Momento is "inicio" or "durante" or "cierre", "Momento inválido.");
        periodo.Momento = request.Momento; periodo.Version++;
        context.Auditar(actor, "cambiar-momento", periodo.Id, periodo.Version);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public async Task Asignar(AsignarTutorDto request, CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        TutoriaError.Exigir(actor.Rol == "coordinacion", "Solo coordinación puede asignar tutores.", 403);
        await using var tx = await context.Transaccion(actor, ct);
        var periodo = await context.Periodo(actor, ct);
        await context.ExigirPeriodoAbierto(actor, ct);
        var e = await db.Personas.FindAsync([request.EstudianteId], ct);
        var tutor = await db.Personas.FindAsync([request.TutorId], ct);
        TutoriaError.Exigir(e?.Tipo == "estudiante" && e.Activa && tutor?.Tipo == "tutor" && e.EscuelaId == actor.EscuelaId && tutor.EscuelaId == actor.EscuelaId && tutor.Activa, "El estudiante y el tutor deben estar activos y pertenecer a tu escuela.", 403);
        TutoriaError.Exigir(!string.IsNullOrWhiteSpace(request.Referencia) && request.Referencia.Length <= 200 && (request.Grupo?.Length ?? 0) <= 100, "Registra la referencia de aprobación y un grupo válido.");
        var a = await db.Asignaciones.SingleOrDefaultAsync(a => a.EstudianteId == request.EstudianteId && a.SemestreId == periodo.SemestreId && a.Activa, ct);
        if (a is null) { TutoriaError.Exigir(request.Version is null or 0, "La asignación cambió.", 409); a = new() { Id = "ASG-" + Guid.NewGuid(), EstudianteId = request.EstudianteId, TutorId = request.TutorId, EscuelaId = actor.EscuelaId, SemestreId = periodo.SemestreId }; db.Asignaciones.Add(a); }
        else TutoriaContext.Version(request.Version ?? -1, a.Version);
        var anterior = a.TutorId;
        if (request.SolicitudId is { } sid)
        {
            var s = await db.SolicitudesCambio.SingleOrDefaultAsync(s => s.Id == sid && s.EscuelaId == actor.EscuelaId && s.EstudianteId == a.EstudianteId && s.SemestreId == a.SemestreId, ct) ?? throw new TutoriaError(404, "Solicitud no disponible.");
            TutoriaContext.Version(request.SolicitudVersion ?? -1, s.Version);
            TutoriaError.Exigir(s.Estado == "pendiente" && s.TutorActualId == anterior && request.TutorId != anterior, "La solicitud o su asignación ya cambió.", 409);
            s.Estado = "aprobada"; s.Respuesta = request.Referencia.Trim(); s.ResueltoPor = actor.Usuario.Id; s.Resuelto = context.Ahora; s.Version++;
            context.Auditar(actor, "aprobar-cambio-tutor", s.Id, s.Version);
        }
        a.TutorId = request.TutorId; a.Grupo = request.Grupo; a.Version++;
        var datos = JsonDatos.Leer<Dictionary<string, object?>>(a.DatosJson);
        datos["id"] = a.Id; datos["estudianteId"] = a.EstudianteId; datos["tutorId"] = a.TutorId;
        datos["semestreId"] = a.SemestreId; datos["escuelaId"] = a.EscuelaId; datos["grupo"] = a.Grupo;
        datos["estado"] = "activa"; datos["fechaInicio"] = datos.GetValueOrDefault("fechaInicio") ?? context.Hoy;
        datos["fechaFin"] = null; datos["criterio"] = "asignación directiva"; datos["referenciaAprobacion"] = request.Referencia.Trim(); datos["version"] = a.Version;
        var historia = JsonDatos.Elemento(a.DatosJson).TryGetProperty("historial", out var h) ? h.Deserialize<List<object>>()! : [];
        historia.Add(new { fecha = context.Hoy, tutorAnteriorId = anterior, tutorNuevoId = a.TutorId, motivo = request.Referencia.Trim(), responsable = actor.Dto.Name }); datos["historial"] = historia;
        a.DatosJson = JsonDatos.Serializar(datos);
        foreach (var d in await db.Instrumentos.Where(d => d.EstudianteId == a.EstudianteId && d.SemestreId == a.SemestreId && (d.Formato == "F03" || d.Formato == "F04" || d.Formato == "F05")).ToListAsync(ct)) { d.TutorId = a.TutorId; d.Version++; }
        if (e!.Ciclo is { } ciclo)
        {
            var iid = DocumentosService.IdEntrevista(a, ciclo);
            if (!await db.Instrumentos.AnyAsync(d => d.Id == iid, ct)) db.Instrumentos.Add(DocumentosService.Nuevo(iid, EtapasTutoria.FormatoEntrevistaInicial(ciclo), a.TutorId, a.EscuelaId, a.SemestreId, a.EstudianteId, context.Ahora));
        }
        context.Auditar(actor, "asignar-tutor", a.Id, a.Version);
        await ComunicacionService.Notificar(db, context, actor.EscuelaId, [a.EstudianteId], "estudiante", $"asignacion:{a.Id}:{a.Version}", "sistema", "Actualización de tu docente tutor", "Se actualizó tu asignación de tutoría.", "/estudiante/tutor", ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
}
