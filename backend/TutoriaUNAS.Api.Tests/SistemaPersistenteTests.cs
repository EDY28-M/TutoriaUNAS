using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;
using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Tests;

public sealed class SistemaPersistenteTests(PostgresFixture fixture) : IClassFixture<PostgresFixture>
{
    private static async Task<EstadoTutoriaDto> Estado(HttpClient c) => (await c.GetFromJsonAsync<EstadoTutoriaDto>("/api/tutoria/estado"))!;
    private static async Task<T> Ok<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
    private static async Task SinContenido(HttpResponseMessage r) => Assert.True(r.StatusCode == HttpStatusCode.NoContent, $"{r.StatusCode}: {await r.Content.ReadAsStringAsync()}");
    private static string Fecha(int dias = 0) => JsonDatos.Fecha(DateTimeOffset.UtcNow.AddDays(dias));

    [PostgresFact]
    public async Task NoticesPersistAcrossClientsEditDeleteAndEnforceOwnership()
    {
        using var tutor = await fixture.Login("DOC-0421", "tutor"); using var student = await fixture.Login("2023010456", "estudiante"); using var other = await fixture.Login("DOC-0422", "tutor");
        var input = new MensajeInput(0, "Aviso ficticio QA", "Contenido ficticio persistente", "sistema", ["EST-2023010456"], "borrador");
        Assert.Equal(HttpStatusCode.Forbidden, (await student.PostAsJsonAsync("/api/sistema/mensajes", input)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await tutor.PostAsJsonAsync("/api/sistema/mensajes", input with { Destinatarios = ["CUENTA-AJENA"] })).StatusCode);
        var id = (await Ok<JsonElement>(await tutor.PostAsJsonAsync("/api/sistema/mensajes", input))).GetProperty("id").GetString()!;
        using var second = await fixture.Login("DOC-0421", "tutor");
        var saved = Assert.Single((await Estado(second)).Sistema!.Mensajes, m => m.GetProperty("id").GetString() == id);
        var version = saved.GetProperty("version").GetInt32();
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsJsonAsync("/api/sistema/mensajes/" + id, input with { Version = version, Destinatarios = ["COM-01"] })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.PutAsJsonAsync("/api/sistema/mensajes/" + id, input)).StatusCode);
        await Ok<JsonElement>(await tutor.PutAsJsonAsync("/api/sistema/mensajes/" + id, input with { Version = version, Asunto = "Aviso corregido QA" }));
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.DeleteAsync($"/api/sistema/mensajes/{id}?version={version}")).StatusCode);
        await SinContenido(await tutor.DeleteAsync($"/api/sistema/mensajes/{id}?version={version + 1}"));
        Assert.DoesNotContain((await Estado(second)).Sistema!.Mensajes, m => m.GetProperty("id").GetString() == id);
    }

    [PostgresFact]
    public async Task PublishingIsDeliveredOnceAndReadStatePersistsWhileExternalMailIsRejected()
    {
        using var tutor = await fixture.Login("DOC-0421", "tutor"); using var student = await fixture.Login("2023010456", "estudiante");
        var input = new MensajeInput(0, "Publicación ficticia QA", "Aviso para comprobar recepción", "correo", ["EST-2023010456"], "enviado");
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.PostAsJsonAsync("/api/sistema/mensajes", input)).StatusCode);
        var id = (await Ok<JsonElement>(await tutor.PostAsJsonAsync("/api/sistema/mensajes", input with { Canal = "sistema" }))).GetProperty("id").GetString()!;
        var state = await Estado(student);
        var notification = Assert.Single(state.Sistema!.Notificaciones, n => n.TryGetProperty("aviso", out var a) && a.ValueKind == JsonValueKind.Object && a.GetProperty("id").GetString() == id);
        var nid = notification.GetProperty("id").GetString()!;
        await SinContenido(await student.PutAsJsonAsync("/api/sistema/notificaciones/lectura", new { ids = new[] { nid }, leida = true }));
        using var second = await fixture.Login("2023010456", "estudiante");
        Assert.True(Assert.Single((await Estado(second)).Sistema!.Notificaciones, n => n.GetProperty("id").GetString() == nid).GetProperty("leida").GetBoolean());
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.DeleteAsync($"/api/sistema/mensajes/{id}?version=1")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.PutAsJsonAsync("/api/sistema/mensajes/" + id, input with { Version = 1, Canal = "sistema" })).StatusCode);
    }

    [PostgresFact]
    public async Task ScheduledPublicationsAreIdempotentAndCheckRevokedRecipients()
    {
        using var tutor = await fixture.Login("DOC-0421", "tutor");
        var when = DateTimeOffset.UtcNow.AddMinutes(10);
        var input = new MensajeInput(0, "Programado ficticio QA", "Prueba del publicador persistente", "sistema", ["EST-2023010456"], "programado", ProgramadoPara: when);
        var id = (await Ok<JsonElement>(await tutor.PostAsJsonAsync("/api/sistema/mensajes", input))).GetProperty("id").GetString()!;
        await using (var scope = fixture.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
            Assert.Equal(1, await PublicadorAvisos.Procesar(db, when.AddSeconds(1)));
            Assert.Equal(0, await PublicadorAvisos.Procesar(db, when.AddSeconds(2)));
            Assert.Equal(1, await db.Notificaciones.CountAsync(n => n.MensajeId == id));
        }
        var failedId = (await Ok<JsonElement>(await tutor.PostAsJsonAsync("/api/sistema/mensajes", input with { Destinatarios = ["EST-2023010457"] }))).GetProperty("id").GetString()!;
        await using (var scope = fixture.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>(); var user = await db.Usuarios.SingleAsync(u => u.Id == "EST-2023010457");
            user.Activo = false; await db.SaveChangesAsync();
            try { Assert.Equal(0, await PublicadorAvisos.Procesar(db, when.AddSeconds(1))); Assert.Equal("fallido", (await db.Mensajes.SingleAsync(m => m.Id == failedId)).Estado); }
            finally { user.Activo = true; await db.SaveChangesAsync(); }
        }
    }

    [PostgresFact]
    public async Task CalendarCreatesUpdatesDeletesWithVersionConflictAndResourceScope()
    {
        using var tutor = await fixture.Login("DOC-0421", "tutor"); using var other = await fixture.Login("DOC-0422", "tutor"); using var student = await fixture.Login("2023010456", "estudiante");
        var input = new CalendarioInput(0, "tutoria", "Disponibilidad ficticia QA", "2026-II", [1, 2, 3, 4, 5, 6, 7], Fecha(14), Fecha(20), "22:00", "22:30", "Sala ficticia", "presencial", 3);
        var created = await Ok<JsonElement>(await tutor.PostAsJsonAsync("/api/sistema/calendario", input)); var id = created.GetProperty("id").GetString()!;
        Assert.Contains((await student.GetFromJsonAsync<JsonElement[]>("/api/sistema/calendario"))!, b => b.GetProperty("id").GetString() == id);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.PostAsJsonAsync("/api/sistema/calendario", input)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.DeleteAsync($"/api/sistema/calendario/{id}?version=1")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.PutAsJsonAsync("/api/sistema/calendario/" + id, input)).StatusCode);
        var changed = await Ok<JsonElement>(await tutor.PutAsJsonAsync("/api/sistema/calendario/" + id, input with { Version = 1, Title = "Horario actualizado QA" }));
        Assert.Equal(2, changed.GetProperty("version").GetInt32());
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.DeleteAsync($"/api/sistema/calendario/{id}?version=1")).StatusCode);
        await SinContenido(await tutor.DeleteAsync($"/api/sistema/calendario/{id}?version=2"));
        Assert.DoesNotContain((await tutor.GetFromJsonAsync<JsonElement[]>("/api/sistema/calendario"))!, b => b.GetProperty("id").GetString() == id);
    }

    [PostgresFact]
    public async Task DraftDeletionPreservesSubmittedCasesAndReportsReuseSafeAggregates()
    {
        using var tutor = await fixture.Login("DOC-0421", "tutor");
        var draft = await Ok<InstrumentoDto>(await tutor.PostAsJsonAsync("/api/formularios", new { formato = "F08", estudianteId = "EST-2023010456" }));
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.DeleteAsync($"/api/formularios/{draft.Id}?version={draft.Version + 1}")).StatusCode);
        await SinContenido(await tutor.DeleteAsync($"/api/formularios/{draft.Id}?version={draft.Version}"));
        Assert.Equal(HttpStatusCode.NotFound, (await tutor.GetAsync("/api/formularios/" + draft.Id)).StatusCode);
        var doc = await Ok<InstrumentoDto>(await tutor.PostAsJsonAsync("/api/formularios", new { formato = "F08", estudianteId = "EST-2023010456" }));
        doc.Respuestas["motivo"] = "Dificultades de estudio"; doc.Respuestas["resultado"] = "Se resuelve con la asesoría"; doc.Respuestas["detalleMotivo"] = "Relato privado ficticio que no debe copiarse al informe";
        var sent = await Ok<InstrumentoDto>(await tutor.PutAsJsonAsync("/api/formularios/" + doc.Id, new { version = doc.Version, respuestas = doc.Respuestas, enviar = true }));
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.DeleteAsync($"/api/formularios/{doc.Id}?version={sent.Version}")).StatusCode);
        var report = await Ok<InstrumentoDto>(await tutor.PostAsJsonAsync("/api/formularios", new { formato = "F02" }));
        var saved = await Ok<InstrumentoDto>(await tutor.PutAsJsonAsync("/api/formularios/" + report.Id, new { version = report.Version, respuestas = new { }, enviar = false }));
        Assert.Contains("Dificultades de estudio", saved.Respuestas["dificultadesAcademicas"]);
        Assert.DoesNotContain("Relato privado", saved.Respuestas["dificultadesAcademicas"]);
    }

    [PostgresFact]
    public async Task PlanCrudPrefillsF01AndKeepsExecutionEvidence()
    {
        using var coord = await fixture.Login("coordinacion.tutoria", "coordinacion"); using var student = await fixture.Login("2023010456", "estudiante");
        var input = new ActividadInput(0, "Problemática ficticia sin repetir QA", "Objetivo ficticio QA", "Actividad ficticia QA", "Una actividad", Fecha(1), Fecha(2), "DOC-0421", "", "Referencia ficticia", 0, "planificada");
        Assert.Equal(HttpStatusCode.Forbidden, (await student.PostAsJsonAsync("/api/sistema/plan", input)).StatusCode);
        var id = (await Ok<JsonElement>(await coord.PostAsJsonAsync("/api/sistema/plan", input))).GetProperty("id").GetString()!;
        var f01 = await Ok<InstrumentoDto>(await coord.PostAsJsonAsync("/api/formularios", new { formato = "F01" }));
        Assert.Contains("Ingeniería", f01.Respuestas["facultad"]);
        var rows = CatalogoFormatos.Filas(f01.Respuestas["actividades"]); var row = Assert.Single(rows, r => r["problematica"] == input.Problematica);
        Assert.Equal(input.Meta, row["meta"]); Assert.Equal("", row["fecha"]); Assert.Equal("", row["evidencia"]);
        Assert.Equal(HttpStatusCode.Conflict, (await coord.PutAsJsonAsync("/api/sistema/plan/" + id, input)).StatusCode);
        await Ok<JsonElement>(await coord.PutAsJsonAsync("/api/sistema/plan/" + id, input with { Version = 1, Actividad = "Actividad editada QA" }));
        await SinContenido(await coord.DeleteAsync($"/api/sistema/plan/{id}?version=2"));
        var completed = (await Ok<JsonElement>(await coord.PostAsJsonAsync("/api/sistema/plan", input with { Estado = "culminada", Avance = 100, Evidencia = "Evidencia ficticia confirmada" }))).GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.Conflict, (await coord.DeleteAsync($"/api/sistema/plan/{completed}?version=1")).StatusCode);
    }

    [PostgresFact]
    public async Task ChangeRequestsAreVersionedAndDecisionsReachStudent()
    {
        using var student = await fixture.Login("2023010457", "estudiante"); using var coord = await fixture.Login("coordinacion.tutoria", "coordinacion");
        await SinContenido(await student.PostAsJsonAsync("/api/sistema/solicitudes-cambio", new { motivo = "Motivo ficticio de cambio QA" }));
        Assert.Equal(HttpStatusCode.Conflict, (await student.PostAsJsonAsync("/api/sistema/solicitudes-cambio", new { motivo = "Duplicado ficticio QA" })).StatusCode);
        var request = Assert.Single((await Estado(student)).Sistema!.SolicitudesCambio, s => s.GetProperty("estado").GetString() == "pendiente"); var id = request.GetProperty("id").GetString()!; var version = request.GetProperty("version").GetInt32();
        Assert.Equal(HttpStatusCode.Conflict, (await coord.PutAsJsonAsync("/api/sistema/solicitudes-cambio/" + id, new ResolverSolicitudInput(version - 1, "rechazada", "Respuesta ficticia QA"))).StatusCode);
        await SinContenido(await coord.PutAsJsonAsync("/api/sistema/solicitudes-cambio/" + id, new ResolverSolicitudInput(version, "rechazada", "Respuesta ficticia QA")));
        Assert.Equal("rechazada", Assert.Single((await Estado(student)).Sistema!.SolicitudesCambio, s => s.GetProperty("id").GetString() == id).GetProperty("estado").GetString());
        await SinContenido(await student.PostAsJsonAsync("/api/sistema/solicitudes-cambio", new { motivo = "Nueva solicitud ficticia QA" }));
        request = Assert.Single((await Estado(student)).Sistema!.SolicitudesCambio, s => s.GetProperty("estado").GetString() == "pendiente");
        var assignment = Assert.Single((await Estado(coord)).Asignaciones, a => a.GetProperty("estudianteId").GetString() == "EST-2023010457");
        await SinContenido(await coord.PutAsJsonAsync("/api/sistema/solicitudes-cambio/" + request.GetProperty("id").GetString(), new ResolverSolicitudInput(request.GetProperty("version").GetInt32(), "aprobada", "Referencia aprobatoria ficticia QA", "DOC-0422", assignment.GetProperty("version").GetInt32())));
        Assert.Contains((await Estado(student)).Asignaciones, a => a.GetProperty("tutorId").GetString() == "DOC-0422");
        var restored = Assert.Single((await Estado(coord)).Asignaciones, a => a.GetProperty("estudianteId").GetString() == "EST-2023010457");
        await SinContenido(await coord.PostAsJsonAsync("/api/tutoria/asignaciones", new AsignarTutorDto("EST-2023010457", "DOC-0421", restored.GetProperty("grupo").GetString(), "Restauración de escenario aislado", restored.GetProperty("version").GetInt32())));
    }

    [PostgresFact]
    public async Task AccountRevocationProfilePreferencesAndPeriodRulesPersist()
    {
        using var coord = await fixture.Login("coordinacion.tutoria", "coordinacion"); using var student = await fixture.Login("2023010458", "estudiante"); using var tutor = await fixture.Login("DOC-0421", "tutor");
        var contact = (await Estado(student)).Sistema!.Contacto;
        var saved = await Ok<PerfilContactoDto>(await student.PutAsJsonAsync("/api/sistema/perfil", new ContactoInput(contact.Version, "ficticio-qa@example.test", "900000123")));
        Assert.Equal(HttpStatusCode.Conflict, (await student.PutAsJsonAsync("/api/sistema/perfil", new ContactoInput(contact.Version, "ficticio-qa@example.test", "900000123"))).StatusCode);
        Assert.Equal(saved.Correo, (await Estado(student)).Sistema!.Contacto.Correo);
        var pref = (await Estado(student)).Sistema!.Preferencias;
        await SinContenido(await student.PutAsJsonAsync("/api/sistema/preferencias", new PreferenciasInput(pref.Version, SistemaService.AvisosPredeterminados(), SistemaService.PantallaPredeterminada())));
        var user = Assert.Single((await Estado(coord)).Sistema!.Cuentas, u => u.GetProperty("id").GetString() == "EST-2023010458"); var uv = user.GetProperty("version").GetInt32();
        await SinContenido(await coord.PutAsJsonAsync("/api/sistema/cuentas/EST-2023010458", new AccesoInput(uv, false)));
        Assert.Equal(HttpStatusCode.Unauthorized, (await fixture.App.CreateClient().PostAsJsonAsync("/api/auth/login", new { identifier = "2023010458", role = "estudiante", password = "tutoria2026" })).StatusCode);
        Assert.False((await student.GetAsync("/api/tutoria/estado")).IsSuccessStatusCode);
        await SinContenido(await coord.PutAsJsonAsync("/api/sistema/cuentas/EST-2023010458", new AccesoInput(uv + 1, true)));
        var state = await Estado(coord); var cfg = state.Sistema!.ConfiguracionPeriodo!.Value.Deserialize<ConfiguracionPeriodoEntity>(JsonDatos.Options)!;
        var input = new PeriodoInput(cfg.Version, cfg.Inicio, cfg.Fin, cfg.EntrevistasHasta, cfg.InformesHasta, true);
        await SinContenido(await coord.PutAsJsonAsync("/api/sistema/periodo", input));
        try { Assert.Equal(HttpStatusCode.Conflict, (await tutor.PostAsJsonAsync("/api/formularios", new { formato = "F08", estudianteId = "EST-2023010456" })).StatusCode); }
        finally { await SinContenido(await coord.PutAsJsonAsync("/api/sistema/periodo", input with { Version = cfg.Version + 1, Cerrado = false })); }
    }

    [PostgresFact]
    public async Task CampaignCapacityAndCancellationAreIdempotentAndShared()
    {
        var id = "CAMP-QA-" + Guid.NewGuid();
        await using (var scope = fixture.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
            db.Fuentes.Add(new RegistroFuenteEntity { Tipo = "campanasSalud", Id = id, EscuelaId = "E-IIS", Fuente = "Prueba ficticia aislada", FechaCorte = DateTimeOffset.UtcNow, DatosJson = JsonDatos.Serializar(new { id, tema = "Actividad ficticia QA", fecha = Fecha(15), hora = "10:00", canal = "presencial", lugar = "Sala ficticia", escuelas = new[] { "E-IIS" }, cupos = 1, inscritos = 0 }) }); await db.SaveChangesAsync();
        }
        using var one = await fixture.Login("2023010456", "estudiante"); using var two = await fixture.Login("2023010457", "estudiante");
        var path = $"/api/sistema/campanas/{id}/inscripcion";
        await SinContenido(await one.PostAsync(path, null)); await SinContenido(await one.PostAsync(path, null));
        Assert.Equal(HttpStatusCode.Conflict, (await two.PostAsync(path, null)).StatusCode);
        var item = Assert.Single((await Estado(one)).Sistema!.Fuentes["campanasSalud"], c => c.GetProperty("id").GetString() == id); Assert.True(item.GetProperty("inscrito").GetBoolean()); Assert.Equal(1, item.GetProperty("inscritos").GetInt32());
        await SinContenido(await one.DeleteAsync(path)); await SinContenido(await one.DeleteAsync(path)); await SinContenido(await two.PostAsync(path, null));
    }

    [PostgresFact]
    public async Task ReferralFollowupAndInstitutionalRequestUpdatesReachBothPortals()
    {
        using var tutor = await fixture.Login("DOC-0421", "tutor"); using var coord = await fixture.Login("coordinacion.tutoria", "coordinacion"); using var student = await fixture.Login("2023010456", "estudiante");
        var doc = await Ok<InstrumentoDto>(await tutor.PostAsJsonAsync("/api/formularios", new { formato = "F12", estudianteId = "EST-2023010456" }));
        doc.Respuestas["area"] = "Psicología"; doc.Respuestas["motivo"] = "Apoyo emocional";
        await Ok<InstrumentoDto>(await tutor.PutAsJsonAsync("/api/formularios/" + doc.Id, new { version = doc.Version, respuestas = doc.Respuestas, enviar = true }));
        var path = "/api/sistema/derivaciones/" + doc.Id;
        var input = new SeguimientoInput(0, "recibida", "Comunicación ficticia de recepción", "Área ficticia QA", "Coordinar la cita");
        Assert.Equal(HttpStatusCode.Forbidden, (await tutor.PutAsJsonAsync(path, input)).StatusCode);
        await SinContenido(await coord.PutAsJsonAsync(path, input));
        Assert.Equal(HttpStatusCode.Conflict, (await coord.PutAsJsonAsync(path, input)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await coord.PutAsJsonAsync(path, input with { Version = 1, Estado = "atendida" })).StatusCode);
        await SinContenido(await coord.PutAsJsonAsync(path, input with { Version = 1, Estado = "citada", FechaCita = Fecha(1) }));
        Assert.Equal("citada", Assert.Single((await Estado(student)).Sistema!.Fuentes["derivaciones"], d => d.GetProperty("instrumentoId").GetString() == doc.Id).GetProperty("estado").GetString());
        var insumo = (await Estado(coord)).Sistema!.Fuentes["insumos"][0]; var iid = insumo.GetProperty("id").GetString()!; var version = insumo.GetProperty("version").GetInt32();
        var response = new InsumoInput(version, "parcial", "Responsable ficticio QA", "Respuesta ficticia de auditoría", Fecha());
        await SinContenido(await coord.PutAsJsonAsync("/api/sistema/insumos/" + iid, response));
        Assert.Equal(HttpStatusCode.Conflict, (await coord.PutAsJsonAsync("/api/sistema/insumos/" + iid, response)).StatusCode);
    }

    [PostgresFact]
    public async Task SessionReprogrammingAndCancellationPreserveHistoryAndRejectStaleChanges()
    {
        using var tutor = await fixture.Login("DOC-0421", "tutor"); using var student = await fixture.Login("2023010456", "estudiante");
        var input = new ProgramarSesionDto("individual", Fecha(12), "23:00", "23:30", "presencial", "Sala ficticia QA", "Sesión ficticia QA", "Verificar los cambios de convocatoria", ["EST-2023010456"]);
        var session = await Ok<SesionDto>(await tutor.PostAsJsonAsync("/api/sesiones", input)); var path = $"/api/sistema/sesiones/{session.Id}/estado";
        Assert.Equal(HttpStatusCode.Forbidden, (await student.PutAsJsonAsync(path, new EstadoSesionInput(session.Version, "cancelar", "Motivo ficticio QA"))).StatusCode);
        var changed = await Ok<JsonElement>(await tutor.PutAsJsonAsync(path, new EstadoSesionInput(session.Version, "reprogramar", "Nueva convocatoria ficticia QA", Fecha(12), "23:10", "23:40")));
        Assert.Equal("reprogramada", changed.GetProperty("sesion").GetProperty("estado").GetString());
        var next = changed.GetProperty("nueva").Deserialize<SesionDto>(JsonDatos.Options)!;
        Assert.Equal(HttpStatusCode.Conflict, (await tutor.PutAsJsonAsync(path, new EstadoSesionInput(session.Version, "cancelar", "Motivo ficticio QA"))).StatusCode);
        await Ok<JsonElement>(await tutor.PutAsJsonAsync($"/api/sistema/sesiones/{next.Id}/estado", new EstadoSesionInput(next.Version, "cancelar", "Cancelación ficticia QA")));
        Assert.Contains((await Estado(student)).Sesiones, s => s.Id == next.Id && s.Estado == "cancelada");
    }
}
