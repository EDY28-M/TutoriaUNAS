using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TutoriaUNAS.Api.Entities;
using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Data;

public static class SemillaSistema
{
    public static async Task Cargar(TutoriaDbContext db, string path, TimeProvider clock, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(20261030)", ct);
        // El marcador evita reponer datos ficticios o permisos que un administrador retiró.
        if (await db.Catalogos.AnyAsync(c => c.Tipo == "semilla" && c.Id == "sistema-v1", ct)) { await tx.CommitAsync(ct); return; }
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(path, ct));
        var root = document.RootElement;
        foreach (var group in root.GetProperty("catalogos").EnumerateObject())
            foreach (var item in group.Value.EnumerateArray())
            {
                var id = Texto(item, "id", Texto(item, "codigo"));
                if (!await db.Catalogos.AnyAsync(c => c.Tipo == group.Name && c.Id == id, ct)) db.Catalogos.Add(new() { Tipo = group.Name, Id = id, DatosJson = item.GetRawText() });
            }
        var personas = await db.Personas.AsNoTracking().ToDictionaryAsync(p => p.Id, ct);
        var escuelas = personas.Values.Select(p => p.EscuelaId).Distinct().ToArray();
        foreach (var group in root.GetProperty("fuentes").EnumerateObject())
            foreach (var item in group.Value.EnumerateArray())
            {
                var estudiante = Texto(item, "estudianteId");
                var docente = Texto(item, "tutorId", Texto(item, "docenteId"));
                var id = Texto(item, "id", estudiante + "|" + Texto(item, "semestreId"));
                var school = personas.GetValueOrDefault(estudiante)?.EscuelaId ?? personas.GetValueOrDefault(docente)?.EscuelaId;
                foreach (var scope in group.Name == "insumos" ? escuelas : new string?[] { school })
                {
                    var key = group.Name == "insumos" ? scope + "|" + id : id;
                    if (db.Fuentes.Local.Any(f => f.Tipo == group.Name && f.Id == key) || await db.Fuentes.AnyAsync(f => f.Tipo == group.Name && f.Id == key, ct)) continue;
                    var data = item.Deserialize<Dictionary<string, object?>>(JsonDatos.Options)!;
                    data["id"] = key;
                    db.Fuentes.Add(new() { Tipo = group.Name, Id = key, EstudianteId = estudiante.Length == 0 ? null : estudiante,
                        TutorId = docente.Length == 0 ? null : docente, EscuelaId = scope, SemestreId = Texto(item, "semestreId"),
                        Fuente = "Semilla ficticia de desarrollo · " + group.Name, FechaCorte = clock.GetUtcNow(), DatosJson = JsonDatos.Serializar(data) });
                }
            }
        foreach (var p in await db.Periodos.ToArrayAsync(ct))
        {
            if (await db.ConfiguracionPeriodos.AnyAsync(c => c.PeriodoId == p.Id, ct)) continue;
            var sem = root.GetProperty("catalogos").GetProperty("semestres").EnumerateArray().First(s => Texto(s, "id") == p.SemestreId);
            db.ConfiguracionPeriodos.Add(new() { PeriodoId = p.Id, Inicio = Texto(sem, "inicio"), Fin = Texto(sem, "fin"), EntrevistasHasta = Texto(sem, "inicio"), InformesHasta = Texto(sem, "fin") });
        }
        foreach (var a in root.GetProperty("actividadesPlan").EnumerateArray())
        {
            var school = Texto(a, "escuelaId");
            var responsable = personas.Values.FirstOrDefault(p => p.Tipo == "tutor" && p.EscuelaId == school && p.Activa);
            if (responsable is null) continue;
            db.ActividadesPlan.Add(new() { Id = Texto(a, "id"), EscuelaId = school, SemestreId = Texto(a, "semestreId"), ResponsableId = responsable.Id,
                Problematica = Texto(a, "problematica"), Objetivo = Texto(a, "objetivo"), Actividad = Texto(a, "actividad"), Meta = Texto(a, "meta"),
                FechaInicio = Texto(a, "fechaInicio"), FechaFin = Texto(a, "fechaFin"), Evidencia = Texto(a, "evidencia"), Aprobacion = Texto(a, "aprobacion"),
                Avance = a.GetProperty("avance").GetInt32(), Estado = Texto(a, "estado") });
        }
        // No se convierten correos ficticios históricos en entregas reales.
        // Los nuevos mensajes y avisos nacen exclusivamente de operaciones confirmadas.
        db.Catalogos.Add(new() { Tipo = "semilla", Id = "sistema-v1", DatosJson = "{\"ficticio\":true}" });
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    private static string Texto(JsonElement item, string key, string fallback = "") => item.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? fallback : fallback;
}
