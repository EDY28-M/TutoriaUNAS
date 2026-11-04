using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;
using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Tests;

public sealed class EntrevistasTests
{
    [PostgresFact]
    public async Task EveryCycleShowsOnlyItsCurrentInterviewAndRejectsWritingAnotherStage()
    {
        var fixture = new PostgresFixture();
        await fixture.InitializeAsync();
        try
        {
            const string studentId = "EST-2023010456";
            var docs = new Dictionary<string, string>();
            await using (var scope = fixture.App.Services.CreateAsyncScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
                foreach (var format in new[] { "F03", "F04", "F05" })
                {
                    var doc = await db.Instrumentos.SingleOrDefaultAsync(d => d.EstudianteId == studentId && d.Formato == format);
                    if (doc is null)
                    {
                        doc = DocumentosService.Nuevo("ESCENARIO-" + format, format, "DOC-0421", "E-IIS", "2026-II", studentId, DateTimeOffset.UtcNow);
                        db.Instrumentos.Add(doc);
                    }
                    docs[format] = doc.Id;
                }
                var historical = DocumentosService.Nuevo("ANTECEDENTE-F04", "F04", "DOC-0421", "E-IIS", "2026-I", studentId, DateTimeOffset.UtcNow);
                historical.Estado = "enviado";
                historical.RespuestasJson = "{\"colegio\":\"I.E. ficticia histórica\"}";
                db.Instrumentos.Add(historical);
                await db.SaveChangesAsync();
            }
            using var student = await fixture.Login("2023010456", "estudiante");
            for (var cycle = 1; cycle <= 10; cycle++)
            {
                await using (var scope = fixture.App.Services.CreateAsyncScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
                    (await db.Personas.SingleAsync(p => p.Id == studentId)).Ciclo = cycle;
                    await db.SaveChangesAsync();
                }
                var state = (await student.GetFromJsonAsync<EstadoTutoriaDto>("/api/tutoria/estado"))!;
                var expected = cycle <= 3 ? "F03" : cycle <= 7 ? "F04" : "F05";
                var interview = Assert.Single(state.Registros, r => r.Formato is "F03" or "F04" or "F05");
                Assert.Equal(expected, interview.Formato);
                Assert.Equal(cycle, Assert.Single(state.Estudiantes).GetProperty("ciclo").GetInt32());
                var wrong = expected == "F03" ? "F04" : "F03";
                var other = (await student.GetFromJsonAsync<InstrumentoDto>("/api/formularios/" + docs[wrong]))!;
                var denied = await student.PutAsJsonAsync("/api/formularios/" + docs[wrong], new { version = other.Version, respuestas = new { }, enviar = false });
                Assert.Equal(HttpStatusCode.BadRequest, denied.StatusCode);
                Assert.Contains("ciclo", await denied.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
            }
            var history = (await student.GetFromJsonAsync<InstrumentoDto>("/api/formularios/ANTECEDENTE-F04"))!;
            Assert.Contains((await student.GetFromJsonAsync<EstadoTutoriaDto>("/api/tutoria/estado"))!.Historial!, r => r.Id == history.Id);
            Assert.Equal("I.E. ficticia histórica", history.Respuestas["colegio"]);
        }
        finally { await fixture.DisposeAsync(); }
    }

    [Fact]
    public void ReuseKeepsProfileAndCurrentMeaningWithoutCopyingOldHealthOrFutureData()
    {
        ExpedienteDatoEntity Dato(string campo, string periodo, string valor) => new()
        { EstudianteId = "FICTICIO", Campo = campo, Periodo = periodo, Valor = valor, DocumentoId = "FUENTE", Actualizado = DateTimeOffset.UtcNow };
        var values = DocumentosService.Precargar(DocumentosService.DatosParaPeriodo([
            Dato("colegio", "permanente", "I.E. ficticia"),
            Dato("apoderado", "2026-I", "Contacto ficticio"),
            Dato("estadoSalud", "2026-I", "Dato anterior"),
            Dato("estadoSalud", "2026-II", "Estado actual"),
            Dato("habilidades", "2027-I", "Dato futuro"),
            Dato("motivacionEstudio", "2026-II", "Alta"),
            Dato("expectativasIngreso", "2026-II", "Adaptación"),
        ], "2026-II"), "F05");
        Assert.Equal("I.E. ficticia", values["colegio"]);
        Assert.Equal("Contacto ficticio", values["apoderado"]);
        Assert.Equal("Estado actual", values["estadoSalud"]);
        Assert.False(values.ContainsKey("habilidades"));
        Assert.False(values.ContainsKey("motivacion"));
        Assert.False(values.ContainsKey("expectativas"));
    }
}
