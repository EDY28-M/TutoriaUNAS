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

public sealed class PadronTests(PostgresFixture fixture) : IClassFixture<PostgresFixture>
{
    [PostgresFact]
    public async Task SoloCoordinacionConsultaElPadronYNoSeExponenOtrasPersonas()
    {
        using var alumno = await fixture.Login("2023010456", "estudiante");
        using var tutor = await fixture.Login("DOC-0421", "tutor");
        using var coordinacion = await fixture.Login("coordinacion.tutoria", "coordinacion");
        Assert.Equal(HttpStatusCode.Forbidden, (await alumno.GetAsync("/api/padron")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await tutor.GetAsync("/api/padron/DOC-0421")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await coordinacion.GetAsync("/api/padron/DOC-0421")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await coordinacion.GetAsync("/api/padron?tipo=otro")).StatusCode);
        var vacio = await coordinacion.GetFromJsonAsync<JsonElement>("/api/padron?tipo=tutor");
        Assert.Equal(0, vacio.GetProperty("total").GetInt32());
    }

    [PostgresFact]
    public async Task CoordinacionRecibeLaMatriculaDeEstudiantesSinTutorAsignado()
    {
        string estudianteId;
        await using (var scope = fixture.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
            var asignacion = await db.Asignaciones.FirstAsync(a => a.Activa);
            estudianteId = asignacion.EstudianteId;
            asignacion.Activa = false;
            await db.SaveChangesAsync();
        }
        using var coordinacion = await fixture.Login("coordinacion.tutoria", "coordinacion");
        var estado = (await coordinacion.GetFromJsonAsync<EstadoTutoriaDto>("/api/tutoria/estado"))!;
        Assert.DoesNotContain(estado.Asignaciones, a => a.GetProperty("estudianteId").GetString() == estudianteId);
        // Sin tutor, la ficha de «Estudiantes» igual debe mostrar los cursos que ya están cargados.
        Assert.Contains(estado.Matriculas, m => m.GetProperty("estudianteId").GetString() == estudianteId);
        Assert.Contains(estado.Estudiantes, e => e.GetProperty("id").GetString() == estudianteId);
    }

    [Fact]
    public void ElEstadoNoArrastraElDetalleDeAulasDeLaMatricula()
    {
        const string json = """{"semestreId":"2026-II","cursos":[{"cursoId":"X","docente":"D","horario":"Día 1 09-01 pm.","horariosOriginales":[{"aula":"A"}]}]}""";
        var curso = JsonDocument.Parse(EstadoTutoriaService.SinHorariosOriginales(json)).RootElement.GetProperty("cursos")[0];
        Assert.False(curso.TryGetProperty("horariosOriginales", out _));
        Assert.Equal("Día 1 09-01 pm.", curso.GetProperty("horario").GetString());
        Assert.Equal("{}", EstadoTutoriaService.SinHorariosOriginales("{}"));
    }

    [PostgresFact]
    public async Task BuscaConTildesPaginaYConservaDetallesOriginalesSinNotas()
    {
        await using (var scope = fixture.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
            for (var n = 1; n <= 27; n++) db.Personas.Add(new PersonaEntity { Id = $"PAD-ALU-TEST-{n:00}", Tipo = "estudiante", EscuelaId = "E-ECO", Ciclo = null,
                DatosJson = JsonDatos.Serializar(new { id = $"PAD-ALU-TEST-{n:00}", codigo = $"TEST-{n:00}", apellidos = "Fictício", nombres = $"Alumno {n:00}", correo = $"prueba{n}@example.invalid", escuelaId = "E-ECO", ciclo = (int?)null, promedioPonderado = (decimal?)null }) });
            db.Matriculas.Add(new() { Id = "PAD-ALU-TEST-01|2026-II", EstudianteId = "PAD-ALU-TEST-01", SemestreId = "2026-II", DatosJson = JsonDatos.Serializar(new { estudianteId = "PAD-ALU-TEST-01", semestreId = "2026-II", estado = "matriculado", cursos = new[] { new { cursoId = "no-catalogado", seccion = "A", docente = "Docente ficticio", horariosOriginales = new[] { new { fila = 8, dia = "6", horas = "09-01 pm.", duracion = "0", aula = "Aula ficticia", codigoAula = "001", esHoraTeorica = "1" } } } } }) });
            await db.SaveChangesAsync();
        }
        using var c = await fixture.Login("coordinacion.tutoria", "coordinacion");
        var primero = await c.GetFromJsonAsync<JsonElement>("/api/padron?buscar=ficticio&escuelaId=E-ECO");
        Assert.Equal(27, primero.GetProperty("total").GetInt32());
        Assert.Equal(25, primero.GetProperty("filas").GetArrayLength());
        var segundo = await c.GetFromJsonAsync<JsonElement>("/api/padron?buscar=ficticio&escuelaId=E-ECO&pagina=2");
        Assert.Equal(2, segundo.GetProperty("filas").GetArrayLength());
        Assert.Empty(primero.GetProperty("filas").EnumerateArray().Select(p => p.GetProperty("id").GetString()).Intersect(segundo.GetProperty("filas").EnumerateArray().Select(p => p.GetProperty("id").GetString())));
        var detalle = await c.GetFromJsonAsync<JsonElement>("/api/padron/PAD-ALU-TEST-01");
        Assert.Equal(JsonValueKind.Null, detalle.GetProperty("persona").GetProperty("ciclo").ValueKind);
        var curso = detalle.GetProperty("matriculas")[0].GetProperty("cursos")[0];
        Assert.Equal("0", curso.GetProperty("horariosOriginales")[0].GetProperty("duracion").GetString());
        Assert.False(curso.TryGetProperty("notaFinal", out _));
    }
}
