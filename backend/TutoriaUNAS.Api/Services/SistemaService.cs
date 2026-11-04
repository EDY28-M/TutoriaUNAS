using System.Globalization;
using System.Net.Mail;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services;

public sealed class SistemaService(TutoriaDbContext db, TutoriaContext context)
{
    public static JsonElement Elemento<T>(T value) => JsonSerializer.SerializeToElement(value, JsonDatos.Options);
    public static Dictionary<string, bool> AvisosPredeterminados() => new() { ["sesiones"] = true, ["formularios"] = true, ["apoyo"] = true, ["bienestar"] = false, ["resumen"] = false };
    public static Dictionary<string, bool> PantallaPredeterminada() => new() { ["sidebarMini"] = false, ["compactTables"] = false, ["fullWidth"] = false };
    public async Task<SistemaDto> Obtener(ActorTutoria actor, PeriodoEntity periodo, CancellationToken ct)
    {
        var cat = await db.Catalogos.AsNoTracking().Where(c => c.Tipo != "semilla").ToArrayAsync(ct);
        var ids = await db.Asignaciones.Where(a => a.Activa && a.EscuelaId == actor.EscuelaId && (actor.Rol == "coordinacion" || (actor.Rol == "tutor" ? a.TutorId == actor.Id : a.EstudianteId == actor.Id))).Select(a => a.EstudianteId).ToArrayAsync(ct);
        if (actor.Rol == "estudiante") ids = [actor.Id];
        if (actor.Rol == "coordinacion") ids = await db.Personas.Where(p => p.Tipo == "estudiante" && p.EscuelaId == actor.EscuelaId).Select(p => p.Id).ToArrayAsync(ct);
        var fuentes = await db.Fuentes.AsNoTracking().Where(f =>
            (f.EstudianteId != null ? ids.Contains(f.EstudianteId) : f.EscuelaId == null || f.EscuelaId == actor.EscuelaId) &&
            (f.Tipo != "insumos" || actor.Rol == "coordinacion") && (f.Tipo != "importacionesPadron" || actor.Rol == "coordinacion") &&
            (f.TutorId == null || actor.Rol == "coordinacion" || f.TutorId == actor.Id || db.Asignaciones.Any(a => a.EstudianteId == actor.Id && a.TutorId == f.TutorId && a.Activa))).ToArrayAsync(ct);
        var data = fuentes.GroupBy(f => f.Tipo).ToDictionary(g => g.Key, g => g.Select(f => Fuente(f, actor.Rol)).ToArray());
        var fichas = actor.Puede("seguimiento", "ver") ? await db.Instrumentos.AsNoTracking().Where(d => d.Formato == "F12" && d.EscuelaId == actor.EscuelaId && (d.Estado == "enviado" || d.Estado == "aprobado") &&
            (actor.Rol == "coordinacion" || (actor.Rol == "estudiante" ? d.EstudianteId == actor.Id : d.TutorId == actor.Id && ids.Contains(d.EstudianteId!)))).ToArrayAsync(ct) : [];
        var seguimientos = await db.Seguimientos.AsNoTracking().Where(s => s.EscuelaId == actor.EscuelaId).ToArrayAsync(ct);
        var areas = new Dictionary<string, string> { ["Psicología"] = "psicologia", ["Psicopedagogía"] = "psicopedagogia", ["Medicina y Salud"] = "medicina", ["Bienestar y Servicio Social"] = "bienestar-social" };
        data["derivaciones"] = fichas.Select(d => {
            var r = JsonDatos.Leer<Dictionary<string, string>>(d.RespuestasJson); var s = seguimientos.SingleOrDefault(s => s.InstrumentoId == d.Id);
            return Elemento(new { id = "DER-" + d.Id, instrumentoId = d.Id, codigo = "F12-" + d.Id, formato = "F12", d.EstudianteId, d.TutorId, d.SemestreId,
                area = areas.GetValueOrDefault(r.GetValueOrDefault("area", ""), "tutoria-academica"), motivo = r.GetValueOrDefault("motivo") == "Otro" ? r.GetValueOrDefault("motivo__otro", "Apoyo especializado") : r.GetValueOrDefault("motivo", "Apoyo especializado"),
                detalle = r.GetValueOrDefault("detalle", ""), prioridad = s?.Prioridad ?? "media", fechaDerivacion = r.GetValueOrDefault("fecha", JsonDatos.Fecha(d.Actualizado)), fechaRecepcion = (string?)null, fechaCita = s?.FechaCita, fechaAtencion = (string?)null,
                estado = s?.Estado ?? "registrada", responsableArea = s?.ResponsableArea ?? "Pendiente de recepción por el área", siguienteAccion = s?.SiguienteAccion ?? "El área debe comunicar la recepción de la solicitud.", actualizado = (s?.Actualizado ?? d.Actualizado).ToString("O"),
                recomendacionComunicable = s?.RecomendacionComunicable, vigenciaRecomendacion = s?.VigenciaRecomendacion, historial = s is null ? Elemento(new[] { new { fecha = JsonDatos.Fecha(d.Actualizado), estado = "registrada", nota = "Ficha 12 registrada por el tutor.", responsable = r.GetValueOrDefault("nombreTutor", "Tutor") } }) : JsonDatos.Elemento(s.HistorialJson), version = s?.Version ?? 0 });
        }).ToArray();
        var contacto = await db.Contactos.AsNoTracking().SingleOrDefaultAsync(c => c.PersonaId == actor.Id, ct);
        var pref = await db.Preferencias.AsNoTracking().SingleOrDefaultAsync(p => p.UsuarioId == actor.Usuario.Id, ct);
        var mensajes = actor.Puede("comunicacion", "ver") ? await db.Mensajes.AsNoTracking().Include(m => m.Destinatarios)
            .Where(m => m.EscuelaId == actor.EscuelaId && (m.EmisorId == actor.Usuario.Id || (m.Estado == "publicado" && m.Destinatarios.Any(d => d.UsuarioId == actor.Usuario.Id)))).OrderByDescending(m => m.Creado).Take(500).ToArrayAsync(ct) : [];
        var personas = await db.Personas.AsNoTracking().Where(p => p.EscuelaId == actor.EscuelaId).ToDictionaryAsync(p => p.Id, ct);
        var usuarios = await db.Usuarios.AsNoTracking().Where(u => u.EscuelaId == actor.EscuelaId).ToDictionaryAsync(u => u.Id, ct);
        var contactos = await db.Contactos.AsNoTracking().Where(c => personas.Keys.Contains(c.PersonaId)).ToDictionaryAsync(c => c.PersonaId, ct);
        JsonElement Mensaje(MensajeEntity m) => Elemento(new { m.Id, m.Asunto, m.Cuerpo, m.Canal, emisorId = m.EmisorId,
            destinatarioIds = m.Destinatarios.Select(d => d.UsuarioId).ToArray(), m.ProgramadoPara,
            estado = m.Estado == "publicado" ? "enviado" : m.Estado, enviado = (m.Publicado ?? m.ProgramadoPara ?? m.Creado).ToString("O"),
            destinatarios = m.Destinatarios.Select(d => usuarios.TryGetValue(d.UsuarioId, out var u) && personas.TryGetValue(u.PersonaId, out var p) ? contactos.GetValueOrDefault(p.Id)?.Correo ?? JsonDatos.Texto(p.DatosJson, "correo") : "").ToArray(),
            m.Plantilla, m.RelacionadoCon, m.Version, editable = m.EmisorId == actor.Usuario.Id && m.Estado != "publicado" });
        var notificaciones = actor.Puede("comunicacion", "ver") ? await db.Notificaciones.AsNoTracking().Where(n => n.UsuarioId == actor.Usuario.Id).OrderByDescending(n => n.Fecha).Take(500).ToArrayAsync(ct) : [];
        var solicitudes = actor.Puede("solicitudes", "ver") ? await db.SolicitudesCambio.AsNoTracking().Where(s => s.EscuelaId == actor.EscuelaId && (actor.Rol == "coordinacion" || s.EstudianteId == actor.Id)).OrderByDescending(s => s.Creado).ToArrayAsync(ct) : [];
        var actividades = actor.Puede("planes", "ver") ? await db.ActividadesPlan.AsNoTracking().Where(a => a.EscuelaId == actor.EscuelaId).ToArrayAsync(ct) : [];
        var permisos = await db.Permisos.AsNoTracking().Where(p => actor.Rol == "coordinacion" || p.Rol == actor.Rol).ToArrayAsync(ct);
        var config = await db.ConfiguracionPeriodos.AsNoTracking().SingleOrDefaultAsync(c => c.PeriodoId == periodo.Id, ct);
        var catalogos = cat.GroupBy(c => c.Tipo).ToDictionary(g => g.Key, g => g.Select(c => JsonDatos.Elemento(c.DatosJson)).ToArray());
        if (config is not null && catalogos.TryGetValue("semestres", out var periodos))
            catalogos["semestres"] = periodos.Select(s => { var d = s.Deserialize<Dictionary<string, object?>>(JsonDatos.Options)!; if (s.GetProperty("id").GetString() == periodo.SemestreId) { d["inicio"] = config.Inicio; d["fin"] = config.Fin; d["estado"] = config.Cerrado ? "cerrado" : "en-curso"; } return Elemento(d); }).ToArray();
        var actividad = await db.Auditoria.AsNoTracking().Where(a => a.UsuarioId == actor.Usuario.Id).OrderByDescending(a => a.Id).Take(15).ToArrayAsync(ct);
        var campanas = await db.Inscripciones.AsNoTracking().Where(i => i.EstudianteId == actor.Id).Select(i => i.CampanaId).ToArrayAsync(ct);
        var totalesCampanas = await db.Inscripciones.AsNoTracking().GroupBy(i => i.CampanaId).Select(g => new { Id = g.Key, Total = g.Count() }).ToDictionaryAsync(g => g.Id, g => g.Total, ct);
        if (data.TryGetValue("campanasSalud", out var eventos)) data["campanasSalud"] = eventos.Where(e => e.GetProperty("escuelas").EnumerateArray().Any(s => s.GetString() == actor.EscuelaId)).Select(e => { var d = e.Deserialize<Dictionary<string, object?>>(JsonDatos.Options)!; var id = e.GetProperty("id").GetString()!; d["inscrito"] = campanas.Contains(id); d["inscritos"] = e.GetProperty("inscritos").GetInt32() + totalesCampanas.GetValueOrDefault(id); return Elemento(d); }).ToArray();
        return new(catalogos, data,
            new(contacto?.Correo ?? JsonDatos.Texto(actor.Persona.DatosJson, "correo"), contacto?.Telefono ?? JsonDatos.Texto(actor.Persona.DatosJson, "telefono"), contacto?.Version ?? 0),
            new(pref is null ? AvisosPredeterminados() : JsonDatos.Leer<Dictionary<string, bool>>(pref.AvisosJson), pref is null ? PantallaPredeterminada() : JsonDatos.Leer<Dictionary<string, bool>>(pref.PantallaJson), pref?.Version ?? 0),
            mensajes.Select(Mensaje).ToArray(), notificaciones.Select(n => Elemento(new { n.Id, n.Titulo, n.Detalle, fecha = n.Fecha.ToString("O"), leida = n.Leida != null, n.Tipo, n.Enlace,
                canal = n.MensajeId is null ? "sistema" : mensajes.FirstOrDefault(m => m.Id == n.MensajeId)?.Canal ?? "sistema", aviso = n.MensajeId is null ? (JsonElement?)null : mensajes.Where(m => m.Id == n.MensajeId).Select(Mensaje).Cast<JsonElement?>().FirstOrDefault() })).ToArray(),
            solicitudes.Select(s => Elemento(s)).ToArray(), actividades.Select(a => Elemento(new { a.Id, a.SemestreId, a.EscuelaId, a.Problematica, a.Objetivo, a.Actividad, a.Meta, a.FechaInicio, a.FechaFin,
                a.ResponsableId, responsable = personas.TryGetValue(a.ResponsableId, out var p) ? DocumentosService.Nombre(p) : "Por confirmar", a.Evidencia, a.Avance, a.Estado, a.Aprobacion, a.Version })).ToArray(),
            actor.Puede("cuentas", "ver") ? usuarios.Values.Where(u => u.Rol != "coordinacion").Select(u => Elemento(new { u.Id, u.PersonaId, rol = u.Rol, identifier = u.Identificador, nombre = personas.TryGetValue(u.PersonaId, out var p) ? DocumentosService.Nombre(p) : u.Identificador, u.Activo, u.Version })).ToArray() : [],
            permisos.Select(p => Elemento(new { id = p.Rol + "|" + p.Recurso, rol = p.Rol, recurso = p.Nombre, codigoRecurso = p.Recurso, acciones = JsonDatos.Leer<string[]>(p.AccionesJson) })).ToArray(), config is null ? null : Elemento(config),
            actividad.Select(a => Elemento(new { titulo = a.Accion, descripcion = a.RecursoId, fecha = a.Fecha.ToString("O") })).ToArray(), actor.Usuario.Issuer == "local-development",
            actor.Puede("comunicacion", "crear") ? usuarios.Values.Where(u => u.Activo && (actor.Rol == "coordinacion" || u.Rol == "coordinacion" || (u.Rol == "estudiante" && ids.Contains(u.PersonaId)))).Select(u => Elemento(new { u.Id, u.PersonaId, rol = u.Rol, nombre = personas.TryGetValue(u.PersonaId, out var p) ? DocumentosService.Nombre(p) : u.Identificador })).ToArray() : []);
    }
    private static JsonElement Fuente(RegistroFuenteEntity f, string rol)
    {
        var d = JsonDatos.Leer<Dictionary<string, object?>>(f.DatosJson); d["version"] = f.Version;
        d["fuenteRegistro"] = f.Fuente; d["fechaImportacion"] = f.FechaCorte.ToString("O");
        if (f.Tipo == "atencionesSalud" && rol != "estudiante")
        {
            var permitidos = new[] { "id", "estudianteId", "servicio", "fecha", "hora", "tipo", "estado", "recomendacionAcademica", "vigenciaRecomendacion", "confidencial", "version", "fuenteRegistro", "fechaImportacion" };
            d = d.Where(p => permitidos.Contains(p.Key)).ToDictionary(p => p.Key, p => p.Value);
            d["motivo"] = "Información reservada al estudiante y al área de salud"; d["profesional"] = "Área de salud";
        }
        return Elemento(d);
    }
    public async Task<PerfilContactoDto> Contacto(ContactoInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct); await using var tx = await context.Transaccion(actor, ct);
        TutoriaError.Exigir(r.Correo.Length <= 254 && MailAddress.TryCreate(r.Correo.Trim(), out var correo) && correo.Address == r.Correo.Trim() && r.Telefono.Length <= 40, "Revisa el correo y el teléfono de contacto.");
        var data = await db.Contactos.FindAsync([actor.Id], ct); TutoriaContext.Version(r.Version, data?.Version ?? 0);
        if (data is null) { data = new() { PersonaId = actor.Id, Version = 0 }; db.Contactos.Add(data); }
        data.Correo = r.Correo.Trim(); data.Telefono = r.Telefono.Trim(); data.Actualizado = context.Ahora; data.Version++;
        context.Auditar(actor, "actualizar-contacto", actor.Id, data.Version); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new(data.Correo, data.Telefono, data.Version);
    }
    public async Task Preferencias(PreferenciasInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct); await using var tx = await context.Transaccion(actor, ct);
        TutoriaError.Exigir(r.Avisos is not null && r.Pantalla is not null && r.Avisos.Keys.All(AvisosPredeterminados().ContainsKey) && r.Pantalla.Keys.All(PantallaPredeterminada().ContainsKey), "Preferencias desconocidas.");
        var p = await db.Preferencias.FindAsync([actor.Usuario.Id], ct); TutoriaContext.Version(r.Version, p?.Version ?? 0);
        if (p is null) { p = new() { UsuarioId = actor.Usuario.Id, Version = 0 }; db.Preferencias.Add(p); }
        var avisos = AvisosPredeterminados(); var pantalla = PantallaPredeterminada();
        foreach (var v in r.Avisos!) avisos[v.Key] = v.Value; foreach (var v in r.Pantalla!) pantalla[v.Key] = v.Value;
        p.AvisosJson = JsonDatos.Serializar(avisos); p.PantallaJson = JsonDatos.Serializar(pantalla); p.Version++;
        context.Auditar(actor, "actualizar-preferencias", actor.Usuario.Id, p.Version); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public async Task Lectura(LecturaInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct); await using var tx = await context.Transaccion(actor, ct);
        TutoriaError.Exigir(r.Ids is { Length: > 0 and <= 500 } && r.Ids.Distinct().Count() == r.Ids.Length, "Selecciona avisos propios sin duplicados.");
        var rows = await db.Notificaciones.Where(n => n.UsuarioId == actor.Usuario.Id && r.Ids!.Contains(n.Id)).ToArrayAsync(ct);
        TutoriaError.Exigir(rows.Length == r.Ids!.Length, "Uno de los avisos no pertenece a tu cuenta.", 404);
        foreach (var n in rows) n.Leida = r.Leida ? context.Ahora : null;
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public async Task Acceso(string id, AccesoInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct); await using var tx = await context.Transaccion(actor, ct);
        TutoriaError.Exigir(actor.Rol == "coordinacion", "Solo coordinación administra habilitaciones.", 403);
        var u = await db.Usuarios.SingleOrDefaultAsync(u => u.Id == id && u.EscuelaId == actor.EscuelaId && u.Rol != "coordinacion", ct) ?? throw new TutoriaError(404, "Cuenta no disponible.");
        TutoriaContext.Version(r.Version, u.Version); u.Activo = r.Activo; u.Version++;
        context.Auditar(actor, r.Activo ? "habilitar-cuenta" : "deshabilitar-cuenta", u.Id, u.Version); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public async Task Periodo(PeriodoInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct); await using var tx = await context.Transaccion(actor, ct);
        TutoriaError.Exigir(actor.Rol == "coordinacion", "Solo coordinación configura el periodo.", 403);
        var p = await context.Periodo(actor, ct); var config = await db.ConfiguracionPeriodos.FindAsync([p.Id], ct);
        TutoriaContext.Version(r.Version, config?.Version ?? 0);
        TutoriaError.Exigir(new[] { r.Inicio, r.Fin, r.EntrevistasHasta, r.InformesHasta }.All(FechaValida) && string.CompareOrdinal(r.Inicio, r.Fin) <= 0 &&
            string.CompareOrdinal(r.EntrevistasHasta, r.Inicio) >= 0 && string.CompareOrdinal(r.EntrevistasHasta, r.Fin) <= 0 && string.CompareOrdinal(r.InformesHasta, r.Fin) >= 0, "Revisa las fechas del periodo y sus plazos.");
        if (config is null) { config = new() { PeriodoId = p.Id, Version = 0 }; db.ConfiguracionPeriodos.Add(config); }
        config.Inicio = r.Inicio; config.Fin = r.Fin; config.EntrevistasHasta = r.EntrevistasHasta; config.InformesHasta = r.InformesHasta; config.Cerrado = r.Cerrado; config.Version++;
        context.Auditar(actor, "configurar-periodo", p.Id, config.Version); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public static bool FechaValida(string fecha) => DateOnly.TryParseExact(fecha, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    public async Task Insumo(string id, InsumoInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct); await using var tx = await context.Transaccion(actor, ct);
        TutoriaError.Exigir(actor.Rol == "coordinacion", "Solo coordinación registra las respuestas de las áreas.", 403);
        var f = await db.Fuentes.SingleOrDefaultAsync(f => f.Tipo == "insumos" && f.Id == id && f.EscuelaId == actor.EscuelaId, ct) ?? throw new TutoriaError(404, "Solicitud de datos no disponible.");
        TutoriaContext.Version(r.Version, f.Version);
        TutoriaError.Exigir(r.Estado is "entregado" or "parcial" or "pendiente" or "no-autorizado" && !string.IsNullOrWhiteSpace(r.Responsable) && r.Responsable.Length <= 200 && r.Observacion.Length <= 2000 &&
            (r.FechaRespuesta is null || (FechaValida(r.FechaRespuesta) && string.CompareOrdinal(r.FechaRespuesta, context.Hoy) <= 0)), "Revisa el estado, responsable y fecha de respuesta.");
        var data = JsonDatos.Leer<Dictionary<string, object?>>(f.DatosJson); data["estado"] = r.Estado; data["responsable"] = r.Responsable.Trim(); data["observacion"] = r.Observacion.Trim(); data["fechaRespuesta"] = r.FechaRespuesta;
        f.DatosJson = JsonDatos.Serializar(data); f.Version++; context.Auditar(actor, "actualizar-solicitud-datos", f.Id, f.Version); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
}
