using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.EventLog;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Tests;

// Se ejecutan contra PostgreSQL real. El runner proporciona una conexión a la base
// exclusiva de pruebas; cada ejecución usa su propio esquema y nunca borra la base.
public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("TUTORIA_TEST_CONNECTION")))
            Skip = "Configura TUTORIA_TEST_CONNECTION con una base PostgreSQL exclusiva de pruebas.";
    }
}
public sealed class PostgresApp(string connection) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("Database:Enabled", "true");
        builder.UseSetting("ConnectionStrings:Tutoria", connection);
        builder.UseSetting("LocalDevelopment:Enabled", "true");
        builder.UseSetting("Tutoria:DisableDispatcher", "true");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Database:Enabled"] = "true", ["ConnectionStrings:Tutoria"] = connection,
            ["Authentication:Enabled"] = "false", ["LocalDevelopment:Enabled"] = "true",
            ["Tutoria:ApplyMigrations"] = "false", ["Tutoria:SeedDemo"] = "false",
            ["Logging:LogLevel:Default"] = "Warning"
        }));
        builder.ConfigureLogging(logging => { if (OperatingSystem.IsWindows()) logging.AddFilter<EventLogLoggerProvider>(_ => false); });
    }
}
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly string schema = "prueba_" + Guid.NewGuid().ToString("N");
    public string Connection { get; private set; } = "";
    public PostgresApp App { get; private set; } = null!;
    public async Task InitializeAsync()
    {
        var raw = Environment.GetEnvironmentVariable("TUTORIA_TEST_CONNECTION");
        if (string.IsNullOrWhiteSpace(raw)) return;
        var cs = new NpgsqlConnectionStringBuilder(raw);
        if (!cs.Database!.EndsWith("_tests", StringComparison.Ordinal)) throw new InvalidOperationException("La base debe terminar en _tests.");
        await using (var cn = new NpgsqlConnection(cs.ConnectionString))
        {
            await cn.OpenAsync();
            await using var cmd = new NpgsqlCommand($"CREATE SCHEMA {schema}", cn);
            await cmd.ExecuteNonQueryAsync();
        }
        cs.SearchPath = schema; Connection = cs.ConnectionString;
        App = new(Connection);
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
        await SchemaRunner.Apply(db);
        await SemillaDesarrollo.Cargar(db, Path.Combine(App.Services.GetRequiredService<IWebHostEnvironment>().ContentRootPath, "Data", "semilla-desarrollo.json"), TimeProvider.System);
    }
    public async Task DisposeAsync()
    {
        if (App is null) return;
        await App.DisposeAsync();
        await using var cn = new NpgsqlConnection(Connection); await cn.OpenAsync();
        await using var cmd = new NpgsqlCommand($"DROP SCHEMA {schema} CASCADE", cn); await cmd.ExecuteNonQueryAsync();
    }
    public async Task<HttpClient> Login(string identifier, string role)
    {
        var client = App.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { identifier, role, password = "tutoria2026" });
        response.EnsureSuccessStatusCode();
        var token = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token); return client;
    }
}
public sealed class PostgresTutoriaTests(PostgresFixture fixture) : IClassFixture<PostgresFixture>
{
    [PostgresFact]
    public async Task LoginAuditShowsAccountAndDeviceOnlyToCoordination()
    {
        using var student = fixture.App.CreateClient();
        student.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent",
            "Mozilla/5.0 (Linux; Android 10; Dispositivo Ficticio) Chrome/131.0.0.0 Mobile Safari/537.36");
        var login = await Ok<JsonElement>(await student.PostAsJsonAsync("/api/auth/login", new LoginLocalDto("2023010456", "tutoria2026")));
        student.DefaultRequestHeaders.Authorization = new("Bearer", login.GetProperty("accessToken").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync("/api/tutoria/auditoria")).StatusCode);

        using var coord = await fixture.Login("coordinacion.tutoria", "coordinacion");
        var audit = await Ok<JsonElement>(await coord.GetAsync("/api/tutoria/auditoria"));
        var acceso = audit.EnumerateArray().First(x =>
            x.GetProperty("identificador").GetString() == "2023010456" &&
            x.GetProperty("accion").GetString() == "iniciar-sesion");
        Assert.Equal("estudiante", acceso.GetProperty("rol").GetString());
        Assert.Equal("Celular · Android · Chrome", acceso.GetProperty("dispositivo").GetString());
        Assert.False(acceso.TryGetProperty("pais", out _));
        Assert.False(acceso.TryGetProperty("userAgent", out _));
    }

    [PostgresFact]
    public async Task MigrationReplayIsIdempotentAndRejectsModifiedHistory()
    {
        await using var scope = fixture.App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
        var count = await db.Instrumentos.CountAsync();
        await SchemaRunner.Apply(db); Assert.Equal(count, await db.Instrumentos.CountAsync());
        var resource = typeof(SchemaRunner).Assembly.GetManifestResourceNames().Single(n => n.EndsWith("001-inicial.sql", StringComparison.Ordinal));
        using var reader = new StreamReader(typeof(SchemaRunner).Assembly.GetManifestResourceStream(resource)!);
        var sql = (await reader.ReadToEndAsync()).Replace("\r\n", "\n", StringComparison.Ordinal);
        var windowsHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(sql.Replace("\n", "\r\n", StringComparison.Ordinal))));
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"__TutoriaMigrations\" SET \"Sha256\" = {windowsHash} WHERE \"Id\" = {resource}");
        await SchemaRunner.Apply(db);
        var hash = await db.Database.SqlQueryRaw<string>("SELECT \"Sha256\" AS \"Value\" FROM \"__TutoriaMigrations\" WHERE \"Id\" = {0}", resource).SingleAsync();
        try
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"__TutoriaMigrations\" SET \"Sha256\" = 'HISTORIA-ALTERADA' WHERE \"Id\" = {resource}");
            await Assert.ThrowsAsync<InvalidOperationException>(() => SchemaRunner.Apply(db));
        }
        finally { await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"__TutoriaMigrations\" SET \"Sha256\" = {hash} WHERE \"Id\" = {resource}"); }
    }
    private static async Task<EstadoTutoriaDto> Estado(HttpClient client) => (await client.GetFromJsonAsync<EstadoTutoriaDto>("/api/tutoria/estado"))!;
    private static async Task<T> Ok<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"HTTP {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
    private static Dictionary<string, string> RespuestasValidas(string formato)
    {
        var values = new Dictionary<string, string>();
        foreach (var c in new CatalogoFormatos().Campos(formato).Where(c => c.GetProperty("obligatorio").GetBoolean()))
        {
            var key = c.GetProperty("codigo").GetString()!;
            var tipo = c.GetProperty("tipo").GetString();
            var option = c.TryGetProperty("opciones", out var options) ? options[0].GetString()! : "Ninguno";
            values[key] = tipo switch
            {
                "fecha" => JsonDatos.Fecha(DateTimeOffset.UtcNow), "hora" => "12:00", "numero" => "1", "booleano" => "Sí",
                "seleccion" or "escala" => option, "multiple" => JsonSerializer.Serialize(new[] { option }),
                "tabla" => JsonSerializer.Serialize(new[] { c.GetProperty("columnas").EnumerateArray().ToDictionary(col => col.GetProperty("codigo").GetString()!, col => col.TryGetProperty("tipo", out var t) && t.GetString() == "numero" ? "1" : "Dato ficticio") }),
                _ => key == "correo" ? "ficticio@example.test" : "Dato ficticio de prueba"
            };
        }
        return values;
    }
    [PostgresFact]
    public async Task IndividualEvaluationRequiresAttendanceAndValidAnswersForEverySession()
    {
        using var tutor = await fixture.Login("DOC-0421", "tutor");
        using var student = await fixture.Login("2023010456", "estudiante");
        var evaluation = (await Estado(student)).Registros.Single(r => r.SesionId == "SES-PRUEBA-individual");
        var path = "/api/formularios/" + evaluation.Id;
        Assert.Equal(HttpStatusCode.Conflict, (await student.PutAsJsonAsync(path, new { version = evaluation.Version, respuestas = new { }, enviar = false })).StatusCode);
        var session = (await Estado(tutor)).Sesiones.Single(s => s.Id == "SES-PRUEBA-individual");
        var attendees = session.Asistentes.Select(a => a with { Estado = "tarde", HoraRegistro = session.HoraInicio }).ToArray();
        await Ok<SesionDto>(await tutor.PutAsJsonAsync($"/api/sesiones/{session.Id}/asistencia", new { version = session.Version, asistentes = attendees, tipoTutoria = "Personal" }));
        Assert.Equal(HttpStatusCode.BadRequest, (await student.PutAsJsonAsync(path, new { version = evaluation.Version, respuestas = new { }, enviar = true })).StatusCode);
        var sent = await Ok<InstrumentoDto>(await student.PutAsJsonAsync(path, new { version = evaluation.Version, respuestas = RespuestasValidas("F10"), enviar = true }));
        Assert.Equal(100, sent.Avance);
        Assert.Equal("F10", sent.Formato);
        var record = (await Estado(tutor)).Registros.Single(r => r.Formato == "F06" && r.SesionId == session.Id);
        Assert.Equal("Personal", CatalogoFormatos.Filas(record.Respuestas["asistentes"])[0]["tipo"]);
    }
    [PostgresFact]
    public async Task InterviewsRespectCyclesPeriodAndObservedCorrectionWorkflow()
    {
        using var coord = await fixture.Login("coordinacion.tutoria", "coordinacion");
        using var tutor = await fixture.Login("DOC-0421", "tutor");
        var scope = await Estado(coord);
        foreach (var e in scope.Estudiantes)
        {
            var interview = scope.Registros.Single(r => r.EstudianteId == e.GetProperty("id").GetString() && r.Formato is "F03" or "F04" or "F05");
            Assert.Equal(TutoriaUNAS.Api.Domain.EtapasTutoria.FormatoEntrevistaInicial(e.GetProperty("ciclo").GetInt32()), interview.Formato);
        }
        var target = (await Estado(tutor)).Registros.Where(r => r.Formato is "F03" or "F04" or "F05").Skip(3).First();
        using var student = await fixture.Login(target.EstudianteId!.Replace("EST-", "", StringComparison.Ordinal), "estudiante");
        var values = RespuestasValidas(target.Formato);
        var path = "/api/formularios/" + target.Id;
        Assert.Equal(HttpStatusCode.NoContent, (await coord.PutAsJsonAsync("/api/tutoria/periodo", new { version = scope.PeriodoVersion, momento = "durante" })).StatusCode);
        var sent = await Ok<InstrumentoDto>(await student.PutAsJsonAsync(path, new { version = target.Version, respuestas = values, enviar = true }));
        var contact = await Ok<InstrumentoDto>(await tutor.PostAsJsonAsync("/api/formularios", new { formato = "F12", estudianteId = target.EstudianteId }));
        Assert.Equal(sent.Respuestas["correo"], contact.Respuestas.GetValueOrDefault("correo"));
        var observed = await Ok<InstrumentoDto>(await tutor.PostAsJsonAsync(path + "/revision", new { version = sent.Version, decision = "observado", comentario = "Revisa la respuesta ficticia" }));
        scope = await Estado(coord);
        Assert.Equal(HttpStatusCode.NoContent, (await coord.PutAsJsonAsync("/api/tutoria/periodo", new { version = scope.PeriodoVersion, momento = "cierre" })).StatusCode);
        Assert.Equal("observado", observed.Estado);
        Assert.Equal(HttpStatusCode.NotFound, (await tutor.GetAsync(path)).StatusCode);
        var corrected = await Ok<InstrumentoDto>(await student.PutAsJsonAsync(path, new { version = observed.Version, respuestas = values, enviar = true }));
        var approved = await Ok<InstrumentoDto>(await tutor.PostAsJsonAsync(path + "/revision", new { version = corrected.Version, decision = "aprobado", comentario = "Conforme" }));
        Assert.Equal("aprobado", approved.Estado);
        Assert.Equal(HttpStatusCode.Conflict, (await student.PutAsJsonAsync(path, new { version = approved.Version, respuestas = values, enviar = false })).StatusCode);
        scope = await Estado(coord);
        Assert.Equal(HttpStatusCode.NoContent, (await coord.PutAsJsonAsync("/api/tutoria/periodo", new { version = scope.PeriodoVersion, momento = "durante" })).StatusCode);
    }
    [PostgresFact]
    public async Task ScopeAndRolesAreEnforcedByServer()
    {
        using var anon = fixture.App.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync("/api/tutoria/estado")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.PostAsJsonAsync("/api/auth/login", new { identifier = "DOC-0421", role = "coordinacion", password = "tutoria2026" })).StatusCode);
        using var tutor = await fixture.Login("DOC-0421", "tutor");
        using var student = await fixture.Login("2023010456", "estudiante");
        var mine = await Estado(student); var teacher = await Estado(tutor);
        Assert.Single(mine.Estudiantes);
        Assert.All(mine.Registros, r => Assert.Equal(mine.Usuario.Id, r.EstudianteId));
        Assert.All(mine.Sesiones.SelectMany(s => s.Asistentes), a => Assert.Equal(mine.Usuario.Id, a.EstudianteId));
        var group = mine.Sesiones.Single(s => s.Id == "SES-PRUEBA-grupal");
        Assert.Equal(3, group.TotalConvocados); Assert.Single(group.Asistentes);
        var other = teacher.Registros.First(r => r.EstudianteId is not null && r.EstudianteId != mine.Usuario.Id);
        Assert.Equal(HttpStatusCode.NotFound, (await student.GetAsync("/api/formularios/" + other.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.PutAsJsonAsync("/api/tutoria/periodo", new { version = mine.PeriodoVersion, momento = "cierre" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await tutor.GetAsync("/api/tutoria/auditoria")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await tutor.PostAsJsonAsync("/api/tutoria/asignaciones", new { estudianteId = mine.Usuario.Id, tutorId = "DOC-0422", referencia = "No autorizado" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.PostAsJsonAsync("/api/formularios", new { formato = "F06" })).StatusCode);
    }
    [PostgresFact]
    public async Task AttendanceUnlocksOnlyPresentStudentAndGeneratesOneOfficialRecord()
    {
        using var tutor = await fixture.Login("DOC-0421", "tutor");
        using var student = await fixture.Login("2023010456", "estudiante");
        var before = await Estado(student);
        var evaluation = before.Registros.Single(r => r.SesionId == "SES-PRUEBA-grupal");
        var path = "/api/formularios/" + evaluation.Id;
        Assert.Equal(HttpStatusCode.Conflict, (await student.PutAsJsonAsync(path, new { version = 0, respuestas = new { p01 = "Sí" }, enviar = false })).StatusCode);
        var session = (await Estado(tutor)).Sesiones.Single(s => s.Id == "SES-PRUEBA-grupal");
        var attendees = session.Asistentes.Select(a => a with { Estado = a.EstudianteId == before.Usuario.Id ? "asistio" : "falto" }).ToArray();
        Assert.Equal(HttpStatusCode.Forbidden, (await student.PutAsJsonAsync($"/api/sesiones/{session.Id}/asistencia", new { version = session.Version, asistentes = attendees })).StatusCode);
        var confirmed = await Ok<SesionDto>(await tutor.PutAsJsonAsync($"/api/sesiones/{session.Id}/asistencia", new { version = session.Version, asistentes = attendees, mensaje = "Acuerdo ficticio persistente" }));
        Assert.True(confirmed.AsistenciaConfirmada);
        var official = (await Estado(tutor)).Registros.Single(r => r.SesionId == session.Id && r.Formato == "F07");
        Assert.Single(CatalogoFormatos.Filas(official.Respuestas["asistentes"]));
        var values = Enumerable.Range(1, 13).ToDictionary(n => $"p{n:00}", _ => "Sí");
        values["nombreTutor"] = "Identidad manipulada";
        var sent = await Ok<InstrumentoDto>(await student.PutAsJsonAsync(path, new { version = 0, respuestas = values, enviar = true }));
        Assert.Equal("enviado", sent.Estado); Assert.NotEqual("Identidad manipulada", sent.Respuestas["nombreTutor"]);
        Assert.Equal(HttpStatusCode.Conflict, (await student.PutAsJsonAsync(path, new { version = sent.Version, respuestas = values, enviar = true })).StatusCode);
        var absentId = attendees.First(a => a.Estado == "falto").EstudianteId;
        using var absent = await fixture.Login(absentId.Replace("EST-", "", StringComparison.Ordinal), "estudiante");
        var absentEval = (await Estado(absent)).Registros.Single(r => r.SesionId == session.Id);
        Assert.Equal(HttpStatusCode.Conflict, (await absent.PutAsJsonAsync("/api/formularios/" + absentEval.Id, new { version = 0, respuestas = values, enviar = false })).StatusCode);
        var altered = attendees.Select(a => a with { Estado = "falto" }).ToArray();
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.PutAsJsonAsync($"/api/sesiones/{session.Id}/asistencia", new { version = confirmed.Version, asistentes = altered })).StatusCode);
        var revised = await Ok<SesionDto>(await tutor.PutAsJsonAsync($"/api/sesiones/{session.Id}/asistencia", new { version = confirmed.Version, asistentes = attendees }));
        Assert.Single((await Estado(tutor)).Registros, r => r.SesionId == session.Id && r.Formato == "F07");
        using var coordinator = await fixture.Login("coordinacion.tutoria", "coordinacion");
        var ready = (await Estado(coordinator)).Registros.Single(r => r.Id == official.Id);
        await Ok<InstrumentoDto>(await coordinator.PostAsJsonAsync($"/api/formularios/{ready.Id}/revision", new { version = ready.Version, decision = "aprobado", comentario = "Conforme" }));
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.PutAsJsonAsync($"/api/sesiones/{session.Id}/asistencia", new { version = revised.Version, asistentes = attendees })).StatusCode);
    }
    [PostgresFact]
    public async Task ConcurrentDraftsPersistAcrossClientsAndHostRestartWithoutOverwriting()
    {
        using var student = await fixture.Login("2023010456", "estudiante");
        var state = await Estado(student);
        var interview = state.Registros.Single(r => r.Formato is "F03" or "F04" or "F05");
        var path = "/api/formularios/" + interview.Id;
        var values = new Dictionary<string, string>(interview.Respuestas) { ["apoderado"] = "Contacto ficticio persistente", ["nombreEstudiante"] = "Nombre falso inyectado" };
        var attempts = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => student.PutAsJsonAsync(path, new { version = interview.Version, respuestas = values, enviar = false })));
        Assert.Single(attempts, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(attempts, r => r.StatusCode == HttpStatusCode.Conflict);
        var saved = await Ok<InstrumentoDto>(attempts.Single(r => r.IsSuccessStatusCode));
        Assert.NotEqual("Nombre falso inyectado", saved.Respuestas.GetValueOrDefault("nombreEstudiante"));
        using var second = await fixture.Login("2023010456", "estudiante");
        Assert.Equal(saved.Version, (await second.GetFromJsonAsync<InstrumentoDto>(path))!.Version);
        Assert.Equal("Contacto ficticio persistente", (await Estado(second)).Precargas[$"{state.Usuario.Id}|{state.SemestreId}|{interview.Formato}"]["apoderado"]);
        using var tutor = await fixture.Login("DOC-0421", "tutor");
        var summary = await Estado(tutor);
        Assert.Empty(summary.Registros.Single(r => r.Id == interview.Id).Respuestas);
        Assert.Empty(summary.Precargas[$"{state.Usuario.Id}|{state.SemestreId}|{interview.Formato}"]);
        Assert.Equal(HttpStatusCode.NotFound, (await tutor.GetAsync(path)).StatusCode);
        using var restarted = new PostgresApp(fixture.Connection);
        using var newClient = restarted.CreateClient();
        newClient.DefaultRequestHeaders.Authorization = student.DefaultRequestHeaders.Authorization;
        var restored = await Ok<InstrumentoDto>(await newClient.GetAsync(path));
        Assert.Equal(saved.Respuestas, restored.Respuestas); Assert.Equal(saved.Version, restored.Version);
    }
    [PostgresFact]
    public async Task SchedulingChecksRealTimeAssignmentConflictsAndAttendanceEnd()
    {
        using var tutor = await fixture.Login("DOC-0421", "tutor");
        using var student = await fixture.Login("2023010456", "estudiante");
        var tomorrow = JsonDatos.Fecha(DateTimeOffset.UtcNow.AddDays(3));
        var input = new ProgramarSesionDto("individual", tomorrow, "01:00", "01:30", "presencial", "Sala ficticia", "Prueba de programación", "Comprobar conflictos y permisos", ["EST-2023010456"]);
        var session = await Ok<SesionDto>(await tutor.PostAsJsonAsync("/api/sesiones", input));
        Assert.Contains((await Estado(student)).Sesiones, s => s.Id == session.Id);
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.PostAsJsonAsync("/api/sesiones", input)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.PostAsJsonAsync("/api/sesiones", input)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await tutor.PostAsJsonAsync("/api/sesiones", input with { Fecha = "2020-01-01" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await tutor.PostAsJsonAsync("/api/sesiones", input with { HoraInicio = "03:00", HoraFin = "03:30", Estudiantes = ["EST-NO-PERTENECE"] })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.PutAsJsonAsync($"/api/sesiones/{session.Id}/asistencia", new { version = session.Version, asistentes = session.Asistentes })).StatusCode);
    }
    [PostgresFact]
    public async Task ReferralAndExpedienteCommitAtomicallyWithValidation()
    {
        using var tutor = await fixture.Login("DOC-0421", "tutor");
        var d = await Ok<InstrumentoDto>(await tutor.PostAsJsonAsync("/api/formularios", new { formato = "F08", estudianteId = "EST-2023010456" }));
        var input = new Dictionary<string, string> { ["fecha"] = JsonDatos.Fecha(DateTimeOffset.UtcNow), ["motivo"] = "Situación personal", ["resultado"] = "Se deriva a:" };
        Assert.Equal(HttpStatusCode.BadRequest, (await tutor.PutAsJsonAsync("/api/formularios/" + d.Id, new { version = d.Version, respuestas = input, enviar = true })).StatusCode);
        Assert.DoesNotContain((await Estado(tutor)).Registros, r => r.Id == "INST-F12-desde-" + d.Id);
        input["areaDerivacion"] = "Psicología";
        await Ok<InstrumentoDto>(await tutor.PutAsJsonAsync("/api/formularios/" + d.Id, new { version = d.Version, respuestas = input, enviar = true }));
        var referral = (await Estado(tutor)).Registros.Single(r => r.Id == "INST-F12-desde-" + d.Id);
        Assert.Equal("no-iniciado", referral.Estado);
        Assert.Equal("Psicología", referral.Respuestas["area"]); Assert.Equal("Apoyo emocional", referral.Respuestas["motivo"]);
    }
    [PostgresFact]
    public async Task CoordinatorChangesAreVersionedScopedAndRevokeFormerTutor()
    {
        using var coord = await fixture.Login("coordinacion.tutoria", "coordinacion");
        using var teacher = await fixture.Login("DOC-0421", "tutor");
        var state = await Estado(coord);
        var a = state.Asignaciones.Last(a => a.GetProperty("tutorId").GetString() == "DOC-0421" && a.GetProperty("estudianteId").GetString() != "EST-2023010456");
        var id = a.GetProperty("estudianteId").GetString()!;
        var interview = (await Estado(teacher)).Registros.First(r => r.EstudianteId == id);
        var input = new { estudianteId = id, tutorId = "DOC-0422", grupo = "Grupo ficticio", referencia = "Acuerdo ficticio de prueba", version = a.GetProperty("version").GetInt32() };
        Assert.Equal(HttpStatusCode.NoContent, (await coord.PostAsJsonAsync("/api/tutoria/asignaciones", input)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await coord.PostAsJsonAsync("/api/tutoria/asignaciones", input)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await teacher.PutAsJsonAsync("/api/formularios/" + interview.Id, new { version = interview.Version, respuestas = new { }, enviar = false })).StatusCode);
        var updated = await Estado(coord);
        Assert.Equal(HttpStatusCode.NoContent, (await coord.PutAsJsonAsync("/api/tutoria/periodo", new { version = updated.PeriodoVersion, momento = "inicio" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await coord.PutAsJsonAsync("/api/tutoria/periodo", new { version = updated.PeriodoVersion, momento = "cierre" })).StatusCode);
        var latest = await Estado(coord);
        Assert.Equal(HttpStatusCode.NoContent, (await coord.PutAsJsonAsync("/api/tutoria/periodo", new { version = latest.PeriodoVersion, momento = "durante" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await coord.GetAsync("/api/tutoria/auditoria")).StatusCode);
    }
}
