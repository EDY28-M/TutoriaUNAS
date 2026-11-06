using Microsoft.EntityFrameworkCore;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services;

public sealed class ComunicacionService(TutoriaDbContext db, TutoriaContext context)
{
    public async Task Eliminar(string id, int version, CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        if (actor.ConsultaInstitucional)
            actor = actor.ParaEscuela(await db.Mensajes.AsNoTracking().Where(m => m.Id == id && m.EmisorId == actor.Usuario.Id).Select(m => m.EscuelaId).SingleOrDefaultAsync(ct));
        await using var tx = await context.Transaccion(actor, ct);
        var m = await db.Mensajes.Include(m => m.Destinatarios).SingleOrDefaultAsync(m => m.Id == id && m.EmisorId == actor.Usuario.Id && m.EscuelaId == actor.EscuelaId, ct) ?? throw new TutoriaError(404, "Aviso no disponible.");
        TutoriaContext.Version(version, m.Version);
        TutoriaError.Exigir(m.Estado is "borrador" or "programado" or "fallido", "Un aviso publicado se conserva en el historial.", 409);
        db.Mensajes.Remove(m); context.Auditar(actor, "eliminar-borrador-aviso", id, m.Version);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public async Task<string> Guardar(string? id, MensajeInput r, CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        if (actor.ConsultaInstitucional && id is not null)
            actor = actor.ParaEscuela(await db.Mensajes.AsNoTracking().Where(m => m.Id == id && m.EmisorId == actor.Usuario.Id).Select(m => m.EscuelaId).SingleOrDefaultAsync(ct));
        actor.ExigirEscuelaParaGestion();
        await using var tx = await context.Transaccion(actor, ct);
        TutoriaError.Exigir(actor.Rol is "tutor" or "coordinacion", "Solo tutoría y coordinación pueden redactar avisos.", 403);
        TutoriaError.Exigir(r.Asunto.Trim().Length is >= 3 and <= 200 && r.Cuerpo.Trim().Length is >= 3 and <= 10000 && r.Plantilla.Length <= 100 && r.Canal is "sistema" or "correo" && r.Estado is "borrador" or "enviado" or "programado", "Revisa el asunto, contenido, canal y estado del aviso.");
        TutoriaError.Exigir(r.Estado == "borrador" || r.Canal == "sistema", "El envío de correo externo no está configurado. Guarda un borrador o publica por el sistema.", 409);
        TutoriaError.Exigir(r.Estado != "programado" || (r.ProgramadoPara > context.Ahora && r.ProgramadoPara < context.Ahora.AddYears(1)), "Selecciona una fecha y hora futuras para publicar.");
        TutoriaError.Exigir(r.Destinatarios is { Length: > 0 and <= 200 } && r.Destinatarios.All(d => !string.IsNullOrWhiteSpace(d) && d.Length <= 254) && r.Destinatarios.Distinct(StringComparer.OrdinalIgnoreCase).Count() == r.Destinatarios.Length, "Selecciona destinatarios sin duplicados.");
        var users = await db.Usuarios.Where(u => u.EscuelaId == actor.EscuelaId && u.Activo && db.Personas.Any(p => p.Id == u.PersonaId && p.Activa) &&
            (actor.Rol == "coordinacion" || (u.Rol == "estudiante" && db.Asignaciones.Any(a => a.EstudianteId == u.PersonaId && a.TutorId == actor.Id && a.Activa)) || u.Rol == "coordinacion")).ToArrayAsync(ct);
        var personas = await db.Personas.Where(p => p.EscuelaId == actor.EscuelaId).ToDictionaryAsync(p => p.Id, ct);
        var contactos = await db.Contactos.Where(c => personas.Keys.Contains(c.PersonaId)).ToDictionaryAsync(c => c.PersonaId, ct);
        var destinatarios = r.Destinatarios!.Select(d => users.FirstOrDefault(u => u.Id == d || u.PersonaId == d ||
            string.Equals(JsonDatos.Texto(personas[u.PersonaId].DatosJson, "correo"), d.Trim(), StringComparison.OrdinalIgnoreCase) ||
            string.Equals(contactos.GetValueOrDefault(u.PersonaId)?.Correo, d.Trim(), StringComparison.OrdinalIgnoreCase))?.Id).ToArray();
        TutoriaError.Exigir(destinatarios.All(d => d is not null) && destinatarios.Distinct().Count() == destinatarios.Length, "Uno de los destinatarios no está habilitado en tu ámbito.", 403);
        var m = id is null ? new MensajeEntity { Id = "MSG-" + Guid.NewGuid(), EmisorId = actor.Usuario.Id, EscuelaId = actor.EscuelaId, Creado = context.Ahora, Version = 0 } :
            await db.Mensajes.Include(m => m.Destinatarios).SingleOrDefaultAsync(m => m.Id == id && m.EmisorId == actor.Usuario.Id && m.EscuelaId == actor.EscuelaId, ct) ?? throw new TutoriaError(404, "Aviso no disponible.");
        TutoriaContext.Version(r.Version, m.Version); TutoriaError.Exigir(m.Estado != "publicado", "Los mensajes publicados no pueden modificarse.", 409);
        if (id is null) db.Mensajes.Add(m);
        foreach (var old in m.Destinatarios.Where(d => !destinatarios.Contains(d.UsuarioId)).ToArray()) { db.Destinatarios.Remove(old); m.Destinatarios.Remove(old); }
        foreach (var dest in destinatarios.Where(d => !m.Destinatarios.Any(old => old.UsuarioId == d))) m.Destinatarios.Add(new() { MensajeId = m.Id, UsuarioId = dest! });
        m.Asunto = r.Asunto.Trim(); m.Cuerpo = r.Cuerpo.Trim(); m.Canal = r.Canal; m.Plantilla = r.Plantilla;
        m.ProgramadoPara = r.Estado == "programado" ? r.ProgramadoPara!.Value.ToUniversalTime() : null; m.Version++;
        m.Estado = r.Estado == "enviado" ? "publicado" : r.Estado;
        if (m.Estado == "publicado") Publicar(db, m, context.Ahora);
        context.Auditar(actor, "guardar-aviso-" + m.Estado, m.Id, m.Version); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return m.Id;
    }
    public static void Publicar(TutoriaDbContext db, MensajeEntity m, DateTimeOffset fecha)
    {
        m.Estado = "publicado"; m.Publicado = fecha;
        foreach (var d in m.Destinatarios) db.Notificaciones.Add(new() { Id = "NOT-" + Guid.NewGuid(), UsuarioId = d.UsuarioId, Evento = "mensaje:" + m.Id, Titulo = m.Asunto, Detalle = m.Cuerpo,
            Fecha = fecha, MensajeId = m.Id, Tipo = "sistema" });
    }
    public static async Task Notificar(TutoriaDbContext db, TutoriaContext context, string escuela, string[] personas, string rol, string evento, string tipo, string titulo, string detalle, string enlace, CancellationToken ct)
    {
        foreach (var u in await db.Usuarios.Where(u => (u.EscuelaId == escuela || (rol == "coordinacion" && u.AdminInstitucional && u.Activo)) && u.Rol == rol && (personas.Length == 0 || personas.Contains(u.PersonaId))).ToArrayAsync(ct))
        {
            if (db.Notificaciones.Local.Any(n => n.UsuarioId == u.Id && n.Evento == evento) || await db.Notificaciones.AnyAsync(n => n.UsuarioId == u.Id && n.Evento == evento, ct)) continue;
            db.Notificaciones.Add(new() { Id = "NOT-" + Guid.NewGuid(), UsuarioId = u.Id, Evento = evento, Tipo = tipo, Titulo = titulo, Detalle = detalle, Enlace = enlace, Fecha = context.Ahora });
        }
    }
}

public sealed class PublicadorAvisos(IServiceScopeFactory scopes, ILogger<PublicadorAvisos> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
                var clock = scope.ServiceProvider.GetRequiredService<TimeProvider>();
                await Procesar(db, clock.GetUtcNow(), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception e) { logger.LogWarning("No se pudieron publicar los avisos programados ({Tipo}). Se reintentará en el siguiente ciclo.", e.GetType().Name); }
        }
    }
    public static async Task<int> Procesar(TutoriaDbContext db, DateTimeOffset ahora, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(20261031)", ct);
        var pendientes = await db.Mensajes.AsNoTracking().Where(m => m.Estado == "programado" && m.ProgramadoPara <= ahora).OrderBy(m => m.EscuelaId).Take(100).Select(m => new { m.Id, m.EscuelaId }).ToArrayAsync(ct);
        var publicados = 0;
        foreach (var pendiente in pendientes)
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({pendiente.EscuelaId}, 0))", ct);
            var m = await db.Mensajes.Include(m => m.Destinatarios).SingleAsync(m => m.Id == pendiente.Id, ct);
            if (m.Estado != "programado" || m.ProgramadoPara > ahora) continue;
            var emisor = await db.Usuarios.SingleAsync(u => u.Id == m.EmisorId, ct);
            var permiso = await db.Permisos.FindAsync([emisor.Rol, "comunicacion"], ct);
            var permitido = emisor.Activo &&
                (emisor.EscuelaId == m.EscuelaId || (emisor.Rol == "coordinacion" && emisor.AdminInstitucional)) &&
                permiso is not null && JsonDatos.Leer<string[]>(permiso.AccionesJson).Contains("crear");
            foreach (var d in m.Destinatarios)
            {
                var usuario = await db.Usuarios.SingleAsync(u => u.Id == d.UsuarioId, ct);
                permitido &= usuario.Activo && usuario.EscuelaId == m.EscuelaId && (emisor.Rol == "coordinacion" || usuario.Rol == "coordinacion" || await db.Asignaciones.AnyAsync(a => a.EstudianteId == usuario.PersonaId && a.TutorId == emisor.PersonaId && a.Activa, ct));
            }
            m.Version++;
            if (!permitido || m.Canal != "sistema") m.Estado = "fallido";
            else { ComunicacionService.Publicar(db, m, ahora); publicados++; }
            db.Auditoria.Add(new() { Fecha = ahora, UsuarioId = emisor.Id, EscuelaId = m.EscuelaId, Accion = "publicar-aviso-" + m.Estado, RecursoId = m.Id, Version = m.Version });
        }
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return publicados;
    }
}
