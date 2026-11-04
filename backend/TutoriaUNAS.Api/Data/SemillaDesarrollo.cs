using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TutoriaUNAS.Api.Entities;
using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Data;

public static class SemillaDesarrollo
{
    public static async Task Cargar(TutoriaDbContext db, string path, TimeProvider clock, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(20261029)", ct);
        if (await db.Usuarios.AnyAsync(ct)) { await tx.CommitAsync(ct); await SemillaSistema.Cargar(db, Path.Combine(Path.GetDirectoryName(path)!, "semilla-sistema.json"), clock, ct); return; }
        using var json = JsonDocument.Parse(await File.ReadAllTextAsync(path, ct));
        var seed = json.RootElement;
        var semestre = seed.GetProperty("semestreId").GetString()!;
        var personas = new List<PersonaEntity>();
        foreach (var (key, tipo) in new[] { ("estudiantes", "estudiante"), ("docentes", "tutor") })
            foreach (var p in seed.GetProperty(key).EnumerateArray())
                personas.Add(new() { Id = p.GetProperty("id").GetString()!, Tipo = tipo, EscuelaId = p.GetProperty("escuelaId").GetString()!, Ciclo = tipo == "estudiante" ? p.GetProperty("ciclo").GetInt32() : null, Activa = tipo == "estudiante" || p.GetProperty("activo").GetBoolean(), DatosJson = p.GetRawText() });
        db.Personas.AddRange(personas);
        foreach (var e in seed.GetProperty("escuelas").EnumerateArray())
        { var school = e.GetProperty("id").GetString()!; db.Periodos.Add(new() { Id = semestre + "|" + school, EscuelaId = school, SemestreId = semestre }); }
        var hasher = new PasswordHasher<UsuarioEntity>();
        foreach (var p in personas.Where(p => p.Activa))
        {
            var user = new UsuarioEntity { Id = p.Id, Issuer = "local-development", Subject = p.Id, Rol = p.Tipo, PersonaId = p.Id, EscuelaId = p.EscuelaId, Identificador = p.Tipo == "estudiante" ? JsonDatos.Texto(p.DatosJson, "codigo") : p.Id };
            user.PasswordHashDesarrollo = hasher.HashPassword(user, "tutoria2026"); db.Usuarios.Add(user);
        }
        var coord = new UsuarioEntity { Id = "COM-01", Issuer = "local-development", Subject = "COM-01", Rol = "coordinacion", PersonaId = "DOC-0422", EscuelaId = "E-IIS", Identificador = "coordinacion.tutoria" };
        coord.PasswordHashDesarrollo = hasher.HashPassword(coord, "tutoria2026"); db.Usuarios.Add(coord);
        var ahora = clock.GetUtcNow();
        foreach (var a in seed.GetProperty("asignaciones").EnumerateArray())
        {
            var asignacion = new AsignacionEntity { Id = a.GetProperty("id").GetString()!, EstudianteId = a.GetProperty("estudianteId").GetString()!, TutorId = a.GetProperty("tutorId").GetString()!, EscuelaId = a.GetProperty("escuelaId").GetString()!, SemestreId = a.GetProperty("semestreId").GetString()!, Grupo = a.GetProperty("grupo").GetString(), DatosJson = a.GetRawText() };
            db.Asignaciones.Add(asignacion);
            var p = personas.Single(p => p.Id == asignacion.EstudianteId);
            var d = DocumentosService.Nuevo(DocumentosService.IdEntrevista(asignacion, p.Ciclo!.Value), Domain.EtapasTutoria.FormatoEntrevistaInicial(p.Ciclo.Value), asignacion.TutorId, asignacion.EscuelaId, semestre, p.Id, ahora);
            d.RespuestasJson = JsonDatos.Serializar(new Dictionary<string, string> { ["nombreEstudiante"] = DocumentosService.Nombre(p), ["grupo"] = asignacion.Grupo ?? "", ["correo"] = JsonDatos.Texto(p.DatosJson, "correo"), ["telefono"] = JsonDatos.Texto(p.DatosJson, "telefono") });
            db.Instrumentos.Add(d);
        }
        foreach (var p in personas.Where(p => p.Tipo == "tutor" && p.Activa))
            foreach (var formato in new[] { "F02", "F09" }) db.Instrumentos.Add(DocumentosService.Nuevo($"INST-{formato}-{semestre}-{p.Id}", formato, p.Id, p.EscuelaId, semestre, null, ahora));
        foreach (var m in seed.GetProperty("matriculas").EnumerateArray())
        { var id = m.GetProperty("estudianteId").GetString()!; var sem = m.GetProperty("semestreId").GetString()!; db.Matriculas.Add(new() { Id = id + "|" + sem, EstudianteId = id, SemestreId = sem, DatosJson = m.GetRawText() }); }
        foreach (var h in seed.GetProperty("horarios").EnumerateArray())
            db.Horarios.Add(new() { Id = h.GetProperty("id").GetString()!, EstudianteId = h.GetProperty("estudianteId").GetString()!, SemestreId = semestre, Dia = h.GetProperty("dia").GetInt32(), HoraInicio = h.GetProperty("horaInicio").GetString()!, HoraFin = h.GetProperty("horaFin").GetString()!, DatosJson = h.GetRawText() });
        // Sesiones ficticias ya finalizadas: permiten comprobar el registro sin falsear el reloj del servidor.
        foreach (var tipo in new[] { "individual", "grupal" })
        {
            var ids = personas.Where(p => p.Tipo == "estudiante" && p.EscuelaId == "E-IIS").Take(tipo == "individual" ? 1 : 3).Select(p => p.Id).ToArray();
            var fecha = JsonDatos.Fecha(ahora.AddDays(-1)); var hour = tipo == "individual" ? "02" : "04";
            db.Sesiones.Add(new() { Id = "SES-PRUEBA-" + tipo, Tipo = tipo, TutorId = "DOC-0421", EscuelaId = "E-IIS", SemestreId = semestre, Fecha = fecha, HoraInicio = hour + ":00", HoraFin = hour + ":30", FinUtc = DateTimeOffset.Parse($"{fecha}T{hour}:30:00-05:00", CultureInfo.InvariantCulture).ToUniversalTime(), Lugar = "Sala ficticia de verificación", Tema = "Sesión ficticia para verificar asistencia", Objetivo = "Probar el flujo persistente sin datos reales.", Asistentes = ids.Select(id => new AsistenciaEntity { EstudianteId = id }).ToList() });
        }
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        await SemillaSistema.Cargar(db, Path.Combine(Path.GetDirectoryName(path)!, "semilla-sistema.json"), clock, ct);
    }
}
