using Microsoft.EntityFrameworkCore;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services;

public sealed class DocumentosService(TutoriaDbContext db, TutoriaContext context, CatalogoFormatos catalogo)
{
    public static string IdEntrevista(AsignacionEntity a, int ciclo) => $"INST-{EtapasTutoria.FormatoEntrevistaInicial(ciclo)}-{a.SemestreId}-{a.EstudianteId}";
    public static string IdEvaluacion(SesionEntity s, string estudiante) => $"INST-{(s.Tipo == "individual" ? "F10" : "F11")}-{s.Id}-{estudiante}";
    public static InstrumentoEntity Nuevo(string id, string formato, string tutor, string escuela, string semestre, string? estudiante, DateTimeOffset ahora, string? sesion = null) => new()
    { Id = id, Formato = formato, TutorId = tutor, EscuelaId = escuela, SemestreId = semestre, EstudianteId = estudiante, SesionId = sesion, Creado = ahora, Actualizado = ahora };

    public async Task<InstrumentoDto> Crear(CrearInstrumentoDto request, CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        await using var tx = await context.Transaccion(actor, ct);
        var periodo = await context.Periodo(actor, ct);
        await context.ExigirPeriodoAbierto(actor, ct);
        var kind = catalogo.Actor(request.Formato);
        TutoriaError.Exigir(kind.Length > 0, "Formato desconocido.");
        TutoriaError.Exigir((kind == "tutor" && actor.Rol == "tutor") || (kind == "equipo-tutores" && actor.Rol == "coordinacion"), "Este formato corresponde a otro responsable.", 403);
        TutoriaError.Exigir(request.Formato is not ("F06" or "F07"), "El formato de asistencia se genera al finalizar la sesión y confirmar sus participantes.", 409);
        string? estudianteId = null;
        if (request.Formato is "F08" or "F12")
        {
            TutoriaError.Exigir(!string.IsNullOrWhiteSpace(request.EstudianteId), "Selecciona un estudiante.");
            await context.Asignacion(actor, request.EstudianteId!, periodo.SemestreId, ct);
            estudianteId = request.EstudianteId;
        }
        var id = request.Formato is "F01" or "F02" or "F09" ? $"INST-{request.Formato}-{periodo.SemestreId}-{(request.Formato == "F01" ? actor.EscuelaId : actor.Id)}" : $"INST-{request.Formato}-{Guid.NewGuid()}";
        var existente = await db.Instrumentos.FindAsync([id], ct);
        if (existente is not null) return JsonDatos.Dto(existente);
        var doc = Nuevo(id, request.Formato, actor.Id, actor.EscuelaId, periodo.SemestreId, estudianteId, context.Ahora);
        doc.RespuestasJson = JsonDatos.Serializar(await Canonizar(doc, [], ct));
        db.Instrumentos.Add(doc);
        context.Auditar(actor, "crear-formulario", id, 0);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return JsonDatos.Dto(doc);
    }

    public Task<bool> PuedeLeer(ActorTutoria actor, InstrumentoEntity d, CancellationToken ct) => PuedeConsultar(actor, d, true, ct);
    public Task<bool> PuedeLeerResumen(ActorTutoria actor, InstrumentoEntity d, CancellationToken ct) => PuedeConsultar(actor, d, false, ct);
    private async Task<bool> PuedeConsultar(ActorTutoria actor, InstrumentoEntity d, bool contenido, CancellationToken ct)
    {
        if (d.EscuelaId != actor.EscuelaId) return false;
        if (actor.Rol == "estudiante") return d.EstudianteId == actor.Id && catalogo.Actor(d.Formato) == "tutorado";
        if (contenido && catalogo.Actor(d.Formato) == "tutorado" && d.Estado is not ("enviado" or "aprobado")) return false;
        if (actor.Rol == "coordinacion") return true;
        if (d.TutorId != actor.Id) return false;
        return d.EstudianteId is null || d.Formato is "F10" or "F11" || await db.Asignaciones.AnyAsync(a => a.EstudianteId == d.EstudianteId && a.TutorId == actor.Id && a.SemestreId == d.SemestreId && a.Activa, ct);
    }
    public async Task<InstrumentoEntity> Obtener(string id, ActorTutoria actor, bool escritura, CancellationToken ct)
    {
        var doc = await db.Instrumentos.FindAsync([id], ct);
        if (doc is null && actor.Rol == "estudiante")
        {
            var sesiones = await db.Sesiones.Include(s => s.Asistentes).Where(s => s.EscuelaId == actor.EscuelaId && s.Asistentes.Any(a => a.EstudianteId == actor.Id)).ToListAsync(ct);
            var sesion = sesiones.FirstOrDefault(s => IdEvaluacion(s, actor.Id) == id);
            if (sesion is not null) doc = Nuevo(id, sesion.Tipo == "individual" ? "F10" : "F11", sesion.TutorId, sesion.EscuelaId, sesion.SemestreId, actor.Id, context.Ahora, sesion.Id);
        }
        if (doc is null || !await PuedeLeer(actor, doc, ct)) throw new TutoriaError(404, "Formulario no disponible.");
        if (escritura && db.Entry(doc).State == EntityState.Detached) db.Instrumentos.Add(doc);
        return doc;
    }
    public async Task<InstrumentoDto> Leer(string id, CancellationToken ct) => JsonDatos.Dto(await Obtener(id, await context.Actor(ct), false, ct));

    public async Task<InstrumentoDto> Guardar(string id, GuardarInstrumentoDto request, CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        await using var tx = await context.Transaccion(actor, ct);
        var d = await Obtener(id, actor, true, ct);
        var kind = catalogo.Actor(d.Formato);
        await context.ExigirPeriodoAbierto(actor, ct);
        TutoriaError.Exigir(kind == "tutorado" ? actor.Rol == "estudiante" && d.EstudianteId == actor.Id : kind == "tutor" ? actor.Rol == "tutor" && d.TutorId == actor.Id : actor.Rol == "coordinacion", "Solo el responsable puede escribir este formulario.", 403);
        TutoriaContext.Version(request.Version, d.Version);
        TutoriaError.Exigir(d.Estado is not ("enviado" or "aprobado"), "El formulario ya fue enviado. Solo se vuelve a habilitar si es observado.", 409);
        TutoriaError.Exigir(d.Formato is not ("F06" or "F07"), "Corrige la asistencia desde la sesión asociada.", 409);
        var periodo = await context.Periodo(actor, ct);
        TutoriaError.Exigir(d.SemestreId == periodo.SemestreId, "El periodo del documento ya no está activo.", 409);
        if (d.EstudianteId is { } estudiante)
        {
            await context.Asignacion(actor, estudiante, d.SemestreId, ct);
            if (d.Formato is "F03" or "F04" or "F05")
            {
                if ((await db.Personas.FindAsync([estudiante], ct))!.Ciclo is not { } ciclo)
                    throw new TutoriaError(409, "Confirma el ciclo del estudiante antes de habilitar su entrevista.");
                TutoriaError.Exigir(d.Formato == EtapasTutoria.FormatoEntrevistaInicial(ciclo), "La entrevista no corresponde al ciclo del estudiante.");
            }
        }
        if (d.Formato is "F10" or "F11")
        {
            var s = await db.Sesiones.Include(s => s.Asistentes).SingleAsync(s => s.Id == d.SesionId, ct);
            var presente = s.Asistentes.SingleOrDefault(a => a.EstudianteId == actor.Id);
            TutoriaError.Exigir(s.Estado == "realizada" && s.AsistenciaConfirmada && s.FinUtc <= context.Ahora && presente?.Estado is "asistio" or "tarde", "Debes asistir a una sesión finalizada y contar con la confirmación de tu tutor antes de responder.", 409);
            TutoriaError.Exigir(d.Id == IdEvaluacion(s, actor.Id) && d.Formato == (s.Tipo == "individual" ? "F10" : "F11") && d.TutorId == s.TutorId, "La evaluación no corresponde a esta sesión.");
        }
        if (request.Enviar)
        {
            var requerido = d.Formato is "F01" or "F02" or "F09" ? "cierre" : null;
            TutoriaError.Exigir(requerido is null || periodo.Momento == requerido, "El envío no está habilitado en el momento actual del semestre.", 409);
        }
        TutoriaError.Exigir(request.Respuestas is not null && request.Respuestas.All(kv => kv.Value is not null && kv.Value.Length <= 100000), "Respuestas inválidas.");
        var values = await Canonizar(d, request.Respuestas!, ct);
        values = catalogo.Limpiar(d.Formato, values);
        var cursos = await Cursos(d.EstudianteId, d.SemestreId, ct);
        var errors = catalogo.Validar(d.Formato, values, context.Hoy, cursos);
        if (request.Enviar && errors.Count > 0) throw new TutoriaError(400, "Revisa las respuestas señaladas.", errors);
        d.RespuestasJson = JsonDatos.Serializar(values);
        d.Estado = request.Enviar ? "enviado" : d.Estado == "observado" ? "observado" : "borrador";
        d.Avance = catalogo.Avance(d.Formato, values, context.Hoy, cursos);
        d.Version++;
        d.Actualizado = context.Ahora;
        if (request.Enviar) d.Enviado = context.Ahora;
        if (request.Enviar && d.Formato == "F08") await ContinuarCaso(d, values, actor, ct);
        if (d.Formato is "F03" or "F04" or "F05") await Recordar(d, values, ct);
        context.Auditar(actor, request.Enviar ? "enviar-formulario" : "guardar-borrador", d.Id, d.Version);
        if (request.Enviar)
            await ComunicacionService.Notificar(db, context, actor.EscuelaId, actor.Rol == "estudiante" ? [d.TutorId] : [], actor.Rol == "estudiante" ? "tutor" : "coordinacion", $"formulario-enviado:{d.Id}:{d.Version}", "instrumento", "Formulario enviado", "Hay un formulario enviado disponible para tu revisión.", actor.Rol == "estudiante" ? "/tutor/instrumentos?bandeja=estudiantes" : "/coordinacion/revisiones", ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return JsonDatos.Dto(d);
    }

    public async Task Eliminar(string id, int version, CancellationToken ct)
    {
        var actor = await context.Actor(ct); await using var tx = await context.Transaccion(actor, ct);
        await context.ExigirPeriodoAbierto(actor, ct);
        var d = await Obtener(id, actor, true, ct); var p = await context.Periodo(actor, ct);
        TutoriaContext.Version(version, d.Version);
        TutoriaError.Exigir(actor.Rol == "tutor" && d.TutorId == actor.Id, "Solo el tutor responsable puede descartar el borrador.", 403);
        TutoriaError.Exigir(d.Formato is "F08" or "F12" && d.Estado is "no-iniciado" or "borrador" && d.Enviado is null && d.SemestreId == p.SemestreId, "Solo se descartan borradores de atención o derivación sin envío previo.", 409);
        await context.Asignacion(actor, d.EstudianteId!, d.SemestreId, ct);
        db.Instrumentos.Remove(d); context.Auditar(actor, "descartar-borrador", id, d.Version);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public async Task<InstrumentoDto> Revisar(string id, RevisarInstrumentoDto request, CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        await using var tx = await context.Transaccion(actor, ct);
        var d = await Obtener(id, actor, false, ct);
        TutoriaError.Exigir(d.Formato is "F03" or "F04" or "F05" ? actor.Rol == "tutor" && d.TutorId == actor.Id : actor.Rol == "coordinacion" && d.Formato is not ("F10" or "F11"), "La revisión corresponde a otro responsable.", 403);
        TutoriaContext.Version(request.Version, d.Version);
        TutoriaError.Exigir(d.Estado == "enviado", "Solo se revisan formularios enviados.", 409);
        TutoriaError.Exigir(request.Decision is "aprobado" or "observado", "Decisión inválida.");
        TutoriaError.Exigir(request.Comentario.Length <= 1000 && (request.Decision != "observado" || !string.IsNullOrWhiteSpace(request.Comentario)), "Explica qué debe corregirse.");
        var observaciones = JsonDatos.Leer<List<Dictionary<string, string>>>(d.ObservacionesJson);
        if (request.Decision == "observado") observaciones.Add(new() { ["id"] = Guid.NewGuid().ToString(), ["autor"] = actor.Dto.Name, ["fecha"] = context.Hoy, ["texto"] = request.Comentario.Trim(), ["estado"] = "abierta" });
        else foreach (var o in observaciones) o["estado"] = "subsanada";
        d.ObservacionesJson = JsonDatos.Serializar(observaciones);
        d.Estado = request.Decision;
        d.RevisadoPor = actor.Dto.Name;
        d.Actualizado = context.Ahora;
        d.Version++;
        context.Auditar(actor, "revisar-formulario", id, d.Version);
        var responsable = catalogo.Actor(d.Formato) == "tutorado" ? "estudiante" : d.Formato == "F01" ? "coordinacion" : "tutor";
        await ComunicacionService.Notificar(db, context, actor.EscuelaId, [responsable == "estudiante" ? d.EstudianteId! : d.TutorId], responsable, $"formulario-revisado:{id}:{d.Version}", "instrumento", request.Decision == "observado" ? "Formulario con observaciones" : "Formulario aprobado", request.Decision == "observado" ? "Revisa las correcciones solicitadas en tu formulario." : "La revisión de tu formulario fue aprobada.", responsable == "estudiante" ? "/estudiante/instrumentos" : responsable == "coordinacion" ? "/coordinacion/plan" : "/tutor/instrumentos", ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return JsonDatos.Dto(d);
    }

    public async Task<Dictionary<string, string>> Canonizar(InstrumentoEntity d, Dictionary<string, string> input, CancellationToken ct)
    {
        var values = new Dictionary<string, string>(input);
        var tutor = await db.Personas.FindAsync([d.TutorId], ct);
        var contactoTutor = tutor is null ? null : await db.Contactos.FindAsync([tutor.Id], ct);
        var asignacion = d.EstudianteId is null ? null : await db.Asignaciones.SingleOrDefaultAsync(a => a.EstudianteId == d.EstudianteId && a.SemestreId == d.SemestreId && a.Activa, ct);
        values["nombreTutor"] = tutor is null ? "" : Nombre(tutor);
        values["telefonoTutor"] = contactoTutor?.Telefono ?? (tutor is null ? "" : JsonDatos.Texto(tutor.DatosJson, "telefono"));
        values["semestre"] = d.SemestreId;
        values["escuela"] = d.EscuelaId;
        values.TryAdd("fecha", context.Hoy);
        if (d.EstudianteId is { } id)
        {
            var contacto = await db.Contactos.FindAsync([id], ct);
            if (contacto is not null) { values.TryAdd("correo", contacto.Correo); values.TryAdd("telefono", contacto.Telefono); }
            var propio = catalogo.Actor(d.Formato) == "tutorado";
            var expediente = await db.Expediente.Where(e => e.EstudianteId == id &&
                (propio || db.Instrumentos.Any(origen => origen.Id == e.DocumentoId && (origen.Estado == "enviado" || origen.Estado == "aprobado")))).ToArrayAsync(ct);
            foreach (var (campo, valor) in Precargar(DatosParaPeriodo(expediente, d.SemestreId), d.Formato)) values.TryAdd(campo, valor);
            var e = (await db.Personas.FindAsync([id], ct))!;
            values["nombreEstudiante"] = Nombre(e);
            values["codigo"] = JsonDatos.Texto(e.DatosJson, "codigo");
            values["ciclo"] = e.Ciclo?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "";
            values["escuela"] = e.EscuelaId;
            values["grupo"] = asignacion?.Grupo ?? "";
            values.TryAdd("correo", JsonDatos.Texto(e.DatosJson, "correo"));
            values.TryAdd("telefono", JsonDatos.Texto(e.DatosJson, "telefono"));
        }
        if (d.SesionId is { } sid)
        {
            var s = (await db.Sesiones.FindAsync([sid], ct))!;
            values["fecha"] = s.Fecha;
            values["turno"] = string.CompareOrdinal(s.HoraInicio, "12:00") < 0 ? "Mañana" : string.CompareOrdinal(s.HoraInicio, "18:00") < 0 ? "Tarde" : "Noche";
        }
        if (d.Formato is "F02" or "F09")
        {
            var asignadas = await db.Asignaciones.Where(a => a.TutorId == d.TutorId && a.SemestreId == d.SemestreId && a.Activa).ToListAsync(ct);
            values["gruposAsignados"] = asignadas.Select(a => a.Grupo).Where(g => !string.IsNullOrWhiteSpace(g)).Distinct().Count().ToString(System.Globalization.CultureInfo.InvariantCulture);
            values["estudiantesAsignados"] = asignadas.Count.ToString(System.Globalization.CultureInfo.InvariantCulture);
            var realizadas = await db.Sesiones.Include(s => s.Asistentes).Where(s => s.TutorId == d.TutorId && s.SemestreId == d.SemestreId && s.AsistenciaConfirmada).ToListAsync(ct);
            foreach (var (tipo, sufijo) in new[] { ("individual", "Individual"), ("grupal", "Grupal") })
            {
                var ids = realizadas.Where(s => s.Tipo == tipo).SelectMany(s => s.Asistentes).Where(a => a.Estado is "asistio" or "tarde").Select(a => a.EstudianteId).Distinct().ToArray();
                values[tipo == "individual" ? "individuales" : "grupales"] = realizadas.Count(s => s.Tipo == tipo).ToString(System.Globalization.CultureInfo.InvariantCulture);
                values["atendidos" + sufijo] = ids.Length.ToString(System.Globalization.CultureInfo.InvariantCulture);
                var ciclos = await db.Personas.Where(p => ids.Contains(p.Id)).Select(p => p.Ciclo).Distinct().Order().ToArrayAsync(ct);
                values["ciclos" + sufijo] = ciclos.Length == 0 ? "Sin atenciones" : string.Join(", ", ciclos);
            }
        }
        await CompletarInformes(d, values, ct);
        return values;
    }
    private async Task CompletarInformes(InstrumentoEntity d, Dictionary<string, string> values, CancellationToken ct)
    {
        if (d.Formato is not ("F01" or "F02")) return;
        var previos = JsonDatos.Leer<Dictionary<string, string>>(d.RespuestasJson);
        void Sugerir(string campo, object[] filas)
        {
            if (filas.Length > 0 && string.IsNullOrWhiteSpace(previos.GetValueOrDefault(campo)) && string.IsNullOrWhiteSpace(values.GetValueOrDefault(campo))) values[campo] = JsonDatos.Serializar(filas);
        }
        if (d.Formato == "F01")
        {
            var escuela = await db.Catalogos.FindAsync(["escuelas", d.EscuelaId], ct);
            if (escuela is not null)
            {
                var facultad = await db.Catalogos.FindAsync(["facultades", JsonDatos.Texto(escuela.DatosJson, "facultadId")], ct);
                values["facultad"] = (facultad is null ? "" : JsonDatos.Texto(facultad.DatosJson, "nombre") + " · ") + JsonDatos.Texto(escuela.DatosJson, "nombre");
            }
            var actividades = await db.ActividadesPlan.AsNoTracking().Where(a => a.EscuelaId == d.EscuelaId && a.SemestreId == d.SemestreId).OrderBy(a => a.FechaInicio).ThenBy(a => a.Id).ToArrayAsync(ct);
            Sugerir("actividades", actividades.Select(a => (object)new { a.Problematica, a.Meta, fecha = "", justificacion = a.Actividad + ". " + a.Objetivo, evidencia = a.Estado == "culminada" ? a.Evidencia : "" }).ToArray());
        }
        else
        {
            var atenciones = await db.Instrumentos.AsNoTracking().Where(i => i.Formato == "F08" && i.TutorId == d.TutorId && i.EscuelaId == d.EscuelaId && i.SemestreId == d.SemestreId && (i.Estado == "enviado" || i.Estado == "aprobado")).Select(i => i.RespuestasJson).ToArrayAsync(ct);
            var grupos = atenciones.Select(JsonDatos.Leer<Dictionary<string, string>>).GroupBy(r => r.GetValueOrDefault("motivo", ""));
            var academicas = new List<object>(); var personales = new List<object>();
            foreach (var g in grupos)
            {
                // El informe agrega categorías y resultados; no copia identidades ni relatos personales.
                var resueltas = g.Count(r => r.GetValueOrDefault("resultado") == "Se resuelve con la asesoría");
                var seguimiento = g.Count(r => r.GetValueOrDefault("resultado") == "Se programa nueva cita para seguimiento");
                var derivadas = g.Count(r => r.GetValueOrDefault("resultado") == "Se deriva a:");
                var resultado = $"{resueltas} con asesoría; {seguimiento} con seguimiento; {derivadas} derivadas.";
                var dificultad = $"{g.Key}: {g.Count()} atenciones";
                if (g.Key is "Dificultades de estudio" or "Organización del tiempo" or "Riesgo académico") academicas.Add(new { dificultad, actividad = "Tutoría personalizada y orientación académica", resultado });
                else if (g.Key is "Situación personal" or "Situación familiar") personales.Add(new { dificultad, atencion = "Acompañamiento y orientación a servicios de apoyo", resultado });
            }
            Sugerir("dificultadesAcademicas", academicas.ToArray()); Sugerir("dificultadesPersonales", personales.ToArray());
        }
    }
    public static string Nombre(PersonaEntity p) => JsonDatos.Texto(p.DatosJson, "nombres") + " " + JsonDatos.Texto(p.DatosJson, "apellidos");
    public static IEnumerable<ExpedienteDatoEntity> DatosParaPeriodo(IEnumerable<ExpedienteDatoEntity> expediente, string semestre) =>
        expediente.Where(e => e.Periodo == "permanente" || e.Periodo == semestre ||
            (string.CompareOrdinal(e.Periodo, semestre) < 0 && CatalogoFormatos.CamposEstables.Contains(e.Campo.Replace("__otro", "", StringComparison.Ordinal))))
        .OrderBy(e => e.Periodo == semestre ? 1 : 0).ThenBy(e => e.Actualizado);
    public static Dictionary<string, string> Precargar(IEnumerable<ExpedienteDatoEntity> expediente, string formato)
    {
        var values = new Dictionary<string, string>();
        foreach (var e in expediente)
        {
            var suffix = e.Campo.EndsWith("__otro", StringComparison.Ordinal) ? "__otro" : "";
            var campo = suffix.Length == 0 ? e.Campo : e.Campo[..^6];
            if (campo is "motivacionEstudio" or "motivacionCarrera")
            { if (campo == (formato == "F04" ? "motivacionEstudio" : "motivacionCarrera")) values["motivacion" + suffix] = e.Valor; }
            else if (campo == "expectativasIngreso") { if (formato == "F03") values["expectativas" + suffix] = e.Valor; }
            else if (campo != "expectativas" || formato != "F03") values[e.Campo] = e.Valor;
        }
        return values;
    }
    private async Task<string[]> Cursos(string? id, string semestre, CancellationToken ct)
    {
        var m = await db.Matriculas.SingleOrDefaultAsync(m => m.EstudianteId == id && m.SemestreId == semestre, ct);
        return m is null ? [] : JsonDatos.Elemento(m.DatosJson).GetProperty("cursos").EnumerateArray().Select(c => catalogo.NombreCurso(c.GetProperty("cursoId").GetString()!)).ToArray();
    }
    private async Task Recordar(InstrumentoEntity d, Dictionary<string, string> values, CancellationToken ct)
    {
        foreach (var field in catalogo.Reutilizables.Where(values.ContainsKey))
        {
            var campo = field == "motivacion" ? d.Formato == "F04" ? "motivacionEstudio" : "motivacionCarrera" : field == "expectativas" && d.Formato == "F03" ? "expectativasIngreso" : field;
            var periodo = CatalogoFormatos.CamposEstables.Contains(field) ? "permanente" : d.SemestreId;
            foreach (var suffix in new[] { "", "__otro" })
            {
                var dato = await db.Expediente.FindAsync([d.EstudianteId!, periodo, campo + suffix], ct);
                if (dato is null) { dato = new() { EstudianteId = d.EstudianteId!, Periodo = periodo, Campo = campo + suffix }; db.Expediente.Add(dato); }
                dato.Valor = values.GetValueOrDefault(field + suffix, ""); dato.DocumentoId = d.Id; dato.Actualizado = context.Ahora;
            }
        }
    }
    private async Task ContinuarCaso(InstrumentoEntity d, Dictionary<string, string> values, ActorTutoria actor, CancellationToken ct)
    {
        if (values.GetValueOrDefault("resultado") == "Se deriva a:")
        {
            var id = "INST-F12-desde-" + d.Id;
            if (await db.Instrumentos.AnyAsync(i => i.Id == id, ct)) return;
            var f = Nuevo(id, "F12", d.TutorId, d.EscuelaId, d.SemestreId, d.EstudianteId, context.Ahora);
            var motivos = new Dictionary<string, string> { ["Dificultades de estudio"] = "Dificultades de aprendizaje", ["Organización del tiempo"] = "Dificultades de aprendizaje", ["Riesgo académico"] = "Dificultades de aprendizaje", ["Situación personal"] = "Apoyo emocional", ["Situación familiar"] = "Situación económica o familiar" };
            var motivo = motivos.GetValueOrDefault(values.GetValueOrDefault("motivo", ""), "Otro");
            var respuestas = await Canonizar(f, new() { ["fecha"] = values["fecha"], ["area"] = values.GetValueOrDefault("areaDerivacion", ""), ["motivo"] = motivo, ["motivo__otro"] = motivo == "Otro" ? values.GetValueOrDefault("motivo__otro", values.GetValueOrDefault("motivo", "")) : "", ["detalle"] = values.GetValueOrDefault("detalleMotivo", "") }, ct);
            f.RespuestasJson = JsonDatos.Serializar(respuestas); db.Instrumentos.Add(f);
        }
        if (values.GetValueOrDefault("resultado") == "Se programa nueva cita para seguimiento")
        {
            await AgendaService.ProgramarInterno(db, context, actor, new("individual", values["proximaCita"], values["horaCita"], values["horaFinCita"], "presencial", "Por confirmar con el tutor", "Seguimiento de atención personalizada", "Dar continuidad a los acuerdos registrados.", [d.EstudianteId!]), d.SemestreId, ct);
        }
    }
}
