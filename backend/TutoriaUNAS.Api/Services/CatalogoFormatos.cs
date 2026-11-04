using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace TutoriaUNAS.Api.Services;

public sealed class CatalogoFormatos
{
    private readonly JsonElement datos;
    public static IReadOnlyList<string> CamposEstables { get; } = Array.AsReadOnly(LeerCamposEstables());
    private static string[] LeerCamposEstables()
    {
        using var stream = typeof(CatalogoFormatos).Assembly.GetManifestResourceStream("TutoriaUNAS.Api.Data.formatos.json")!;
        using var json = JsonDocument.Parse(stream);
        return json.RootElement.GetProperty("estables").Deserialize<string[]>()!;
    }
    public CatalogoFormatos()
    {
        using var stream = typeof(CatalogoFormatos).Assembly.GetManifestResourceStream("TutoriaUNAS.Api.Data.formatos.json")!;
        datos = JsonDocument.Parse(stream).RootElement.Clone();
    }
    public CatalogoFormatos(TutoriaDbContext db) : this()
    {
        var catalogos = db.Catalogos.AsNoTracking().Where(c => c.Tipo == "formatos" || c.Tipo == "cursos").ToArray();
        var formatos = catalogos.Where(c => c.Tipo == "formatos").OrderBy(c => c.Id).Select(c => JsonDatos.Elemento(c.DatosJson)).ToArray();
        if (formatos.Length != 12) throw new TutoriaError(503, "El catálogo de formatos no está inicializado. Aplica las migraciones pendientes.");
        datos = JsonSerializer.SerializeToElement(new { formatos, reutilizables = datos.GetProperty("reutilizables"), cursos = catalogos.Where(c => c.Tipo == "cursos").Select(c => JsonDatos.Elemento(c.DatosJson)).ToArray() });
    }
    public JsonElement Definicion(string codigo) => datos.GetProperty("formatos").EnumerateArray().FirstOrDefault(f => f.GetProperty("codigo").GetString() == codigo);
    public JsonElement[] Campos(string codigo) => Definicion(codigo).GetProperty("secciones").EnumerateArray().SelectMany(s => s.GetProperty("campos").EnumerateArray()).ToArray();
    public string Actor(string codigo) => Definicion(codigo).ValueKind == JsonValueKind.Undefined ? "" : Definicion(codigo).GetProperty("actor").GetString()!;
    public string[] Reutilizables => datos.GetProperty("reutilizables").Deserialize<string[]>()!;
    public string NombreCurso(string id)
    {
        var curso = datos.GetProperty("cursos").EnumerateArray().FirstOrDefault(c => c.GetProperty("id").GetString() == id);
        return curso.ValueKind == JsonValueKind.Object && curso.TryGetProperty("nombre", out var name) ? name.GetString()! : "";
    }
    public static bool Visible(JsonElement campo, Dictionary<string, string> respuestas) =>
        !campo.TryGetProperty("visibleSi", out var when) || when.GetProperty("valores").EnumerateArray().Any(v => v.GetString() == respuestas.GetValueOrDefault(when.GetProperty("campo").GetString()!));
    public Dictionary<string, string> Limpiar(string formato, Dictionary<string, string> respuestas)
    {
        var result = new Dictionary<string, string>();
        foreach (var campo in Campos(formato).Where(c => Visible(c, respuestas)))
        {
            var key = campo.GetProperty("codigo").GetString()!;
            result[key] = respuestas.GetValueOrDefault(key, "");
            if (result[key] == "Otro" || Lista(result[key]).Contains("Otro")) result[key + "__otro"] = respuestas.GetValueOrDefault(key + "__otro", "");
        }
        return result;
    }
    public static string[] Lista(string text)
    {
        try { return JsonSerializer.Deserialize<string[]>(text) ?? []; } catch (JsonException) { return string.IsNullOrEmpty(text) ? [] : [text]; }
    }
    public static Dictionary<string, string>[] Filas(string text)
    {
        try { var filas = JsonSerializer.Deserialize<Dictionary<string, string>[]>(text) ?? []; return filas.Any(f => f is null || f.Values.Any(v => v is null)) ? [] : filas; } catch (JsonException) { return []; }
    }
    public Dictionary<string, string[]> Validar(string formato, Dictionary<string, string> respuestas, string hoy, string[] cursos)
    {
        var errors = new Dictionary<string, string[]>();
        void Error(string key, string text) => errors.TryAdd(key, [text]);
        foreach (var c in Campos(formato).Where(c => Visible(c, respuestas)))
        {
            var key = c.GetProperty("codigo").GetString()!;
            var type = c.GetProperty("tipo").GetString();
            var value = respuestas.GetValueOrDefault(key, "").Trim();
            var required = c.GetProperty("obligatorio").GetBoolean();
            if (value.Length == 0) { if (required) Error(key, "Completa esta respuesta para enviar."); continue; }
            var list = type == "multiple" ? Lista(value) : [];
            var rows = type == "tabla" ? Filas(value) : [];
            if ((type == "multiple" && list.Length == 0) || (type == "tabla" && rows.Length == 0))
                { if (required || (value != "[]")) Error(key, "Revisa los registros o las opciones de esta respuesta."); }
            if (type == "numero" && (!decimal.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number) || number < 0)) Error(key, "Ingresa un número válido, igual o mayor que cero.");
            if (key is "horasEstudio" or "promedioSecundaria" && decimal.TryParse(value, CultureInfo.InvariantCulture, out var max) && max > (key == "horasEstudio" ? 24 : 20)) Error(key, "Revisa el rango de esta respuesta.");
            if (type == "fecha" && !DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)) Error(key, "Selecciona una fecha válida.");
            if (type == "hora" && !Regex.IsMatch(value, "^([01][0-9]|2[0-3]):[0-5][0-9]$")) Error(key, "Selecciona una hora válida.");
            if (key == "correo" && !Regex.IsMatch(value, @"^[^\s@]+@[^\s@]+\.[^\s@]+$")) Error(key, "Revisa el correo electrónico.");
            if (value.Length > (type == "texto-largo" ? 1000 : type is "tabla" or "multiple" ? 100000 : 200)) Error(key, "La respuesta supera la longitud permitida.");
            string[] options = key is "cursosDificiles" or "materiasFaciles" ? [.. cursos, "Ninguno", "Otro"] :
                type == "booleano" ? ["Sí", "No"] : c.TryGetProperty("opciones", out var opts) ? opts.Deserialize<string[]>() ?? [] : [];
            if (options.Length > 0 && (type == "multiple" ? list.Any(v => !options.Contains(v)) : !options.Contains(value))) Error(key, "Selecciona una opción válida de la lista.");
            if (type == "multiple" && list.Distinct().Count() != list.Length) Error(key, "No repitas opciones.");
            if (type == "multiple" && list.Length > 1 && list.Any(v => v is "Ninguno" or "Ninguna" or "Solo estudio" or "Aún ninguno" or "No he tenido" or "No" or "Prefiero conversarlo con mi tutor")) Error(key, "Selecciona las opciones excluyentes por separado.");
            if (options.Contains("Otro") && (value == "Otro" || list.Contains("Otro")) && string.IsNullOrWhiteSpace(respuestas.GetValueOrDefault(key + "__otro"))) Error(key + "__otro", "Indica brevemente tu otra respuesta.");
            if ((respuestas.GetValueOrDefault(key + "__otro")?.Length ?? 0) > 200) Error(key + "__otro", "Usa como máximo 200 caracteres.");
            if (type == "tabla" && c.TryGetProperty("columnas", out var columns))
            {
                foreach (var row in rows)
                    foreach (var col in columns.EnumerateArray())
                    {
                        var cell = row.GetValueOrDefault(col.GetProperty("codigo").GetString()!, "").Trim();
                        if (cell.Length == 0 || (col.TryGetProperty("tipo", out var t) && t.GetString() == "numero" && (!decimal.TryParse(cell, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) || n < 0))) Error(key, "Completa las columnas de cada fila o elimina la fila vacía.");
                        if (cell.Length > 500) Error(key, "El texto de una celda supera 500 caracteres.");
                        if (col.TryGetProperty("tipo", out var ctipo) && ctipo.GetString() == "fecha" && !DateOnly.TryParseExact(cell, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)) Error(key, "Revisa las fechas de las filas.");
                    }
                if (key == "administracionTiempo" && rows.Sum(r => decimal.TryParse(r.GetValueOrDefault("horas"), CultureInfo.InvariantCulture, out var h) ? h : 0) > 24) Error(key, "El total de un día no puede superar 24 horas.");
            }
        }
        if (respuestas.TryGetValue("horaInicio", out var inicio) && respuestas.TryGetValue("horaFin", out var fin) && string.CompareOrdinal(fin, inicio) <= 0) Error("horaFin", "La hora de fin debe ser posterior al inicio.");
        if (respuestas.GetValueOrDefault("resultado") == "Se programa nueva cita para seguimiento")
        {
            if (string.CompareOrdinal(respuestas.GetValueOrDefault("proximaCita"), hoy) < 0) Error("proximaCita", "La cita no puede estar en el pasado.");
            if (string.CompareOrdinal(respuestas.GetValueOrDefault("horaFinCita"), respuestas.GetValueOrDefault("horaCita")) <= 0) Error("horaFinCita", "La hora de fin debe ser posterior al inicio.");
        }
        if (formato is "F06" or "F07" or "F08" or "F12" && string.CompareOrdinal(respuestas.GetValueOrDefault("fecha"), hoy) > 0) Error("fecha", "Registra una atención ya realizada.");
        return errors;
    }
    public int Avance(string formato, Dictionary<string, string> values, string hoy, string[] cursos)
    {
        var required = Campos(formato).Where(c => Visible(c, values) && c.GetProperty("obligatorio").GetBoolean()).Select(c => c.GetProperty("codigo").GetString()!).ToArray();
        var errors = Validar(formato, values, hoy, cursos);
        return required.Length == 0 ? 100 : (int)Math.Round(100.0 * required.Count(k => !errors.ContainsKey(k) && !errors.ContainsKey(k + "__otro")) / required.Length);
    }
}
