using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;
using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Tests;

public sealed class AdministracionInstitucionalTests(PostgresFixture fixture) : IClassFixture<PostgresFixture>
{
    [PostgresFact]
    public async Task SoloLaCuentaInstitucionalCambiaDeEscuelaYEscribeEnElAmbitoElegido()
    {
        const string escuela = "E-ECO";
        const string ambito = "?ambitoEscuela=" + escuela;
        const string personaId = "PAD-ALU-ADMIN-PRUEBA";
        const string personaManualId = "ALU-ADMIN-PRUEBA";
        const string docenteId = "DOC-ADMIN-PRUEBA";
        const string global = "?ambitoInstitucional=true";
        await using (var scope = fixture.App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
            var coordinador = new UsuarioEntity
            {
                Id = "COORD-LOCAL-PRUEBA", Subject = "COORD-LOCAL-PRUEBA", Issuer = "local-development",
                Rol = "coordinacion", PersonaId = "DOC-0422", EscuelaId = "E-IIS", Identificador = "coord.escuela.prueba"
            };
            coordinador.PasswordHashDesarrollo = new PasswordHasher<UsuarioEntity>().HashPassword(coordinador, "tutoria2026");
            db.Usuarios.Add(coordinador);
            db.Personas.Add(new()
            {
                Id = personaId, Tipo = "estudiante", EscuelaId = escuela,
                DatosJson = JsonDatos.Serializar(new { id = personaId, escuelaId = escuela, nombres = "Alumno", apellidos = "Ficticio" })
            });
            db.Personas.Add(new()
            {
                Id = docenteId, Tipo = "tutor", EscuelaId = escuela,
                DatosJson = JsonDatos.Serializar(new { id = docenteId, escuelaId = escuela, nombres = "Docente", apellidos = "Ficticio", aforoMaximo = 10 })
            });
            db.Personas.Add(new()
            {
                Id = personaManualId, Tipo = "estudiante", EscuelaId = escuela,
                DatosJson = JsonDatos.Serializar(new { id = personaManualId, escuelaId = escuela, nombres = "Alumno", apellidos = "De prueba" })
            });
            await db.SaveChangesAsync();
        }

        using var admin = await fixture.Login("coordinacion.tutoria", "coordinacion");
        using var coordinacion = await fixture.Login("coord.escuela.prueba", "coordinacion");
        using var tutor = await fixture.Login("DOC-0421", "tutor");
        var inicial = (await admin.GetFromJsonAsync<EstadoTutoriaDto>("/api/tutoria/estado"))!;
        Assert.True(inicial.Usuario.AdminInstitucional);
        Assert.Contains(escuela, inicial.EscuelasAdministrables!);
        Assert.DoesNotContain(inicial.Estudiantes, e => e.GetProperty("id").GetString() == personaId);

        const string estado = "/api/tutoria/estado";
        var institucional = (await admin.GetFromJsonAsync<EstadoTutoriaDto>(estado + global))!;
        Assert.True(institucional.ConsultaInstitucional);
        Assert.DoesNotContain("E-BIO", institucional.EscuelasAdministrables!);
        Assert.DoesNotContain(institucional.Estudiantes, e => e.GetProperty("escuelaId").GetString() == "E-BIO");
        Assert.DoesNotContain(institucional.Docentes, e => e.GetProperty("escuelaId").GetString() == "E-BIO");
        Assert.DoesNotContain(institucional.Sistema!.PeriodosEscuela!, p => p.EscuelaId == "E-BIO");
        Assert.Contains(institucional.Estudiantes, e => e.GetProperty("escuelaId").GetString() == "E-IIS");
        Assert.Contains(institucional.Estudiantes, e => e.GetProperty("id").GetString() == personaId);
        Assert.Contains(institucional.Estudiantes, e => e.GetProperty("id").GetString() == personaManualId);
        Assert.Contains(institucional.Docentes, e => e.GetProperty("id").GetString() == docenteId);
        Assert.Contains(institucional.Sistema!.PeriodosEscuela!, p => p.EscuelaId == escuela);
        Assert.Equal(HttpStatusCode.Forbidden, (await coordinacion.GetAsync(estado + global)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await tutor.GetAsync(estado + global)).StatusCode);

        const string asignaciones = "/api/tutoria/asignaciones";
        var alta = new AsignarTutorDto(personaId, docenteId, null, "Acta ficticia QA");
        Assert.Equal(HttpStatusCode.Forbidden, (await coordinacion.PostAsJsonAsync(asignaciones, alta)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync(asignaciones + global, alta with { TutorId = "DOC-0421" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsJsonAsync(asignaciones + global, alta)).StatusCode);
        var conAsignacion = (await admin.GetFromJsonAsync<EstadoTutoriaDto>(estado + global))!;
        Assert.Contains(conAsignacion.Asignaciones, a => a.GetProperty("estudianteId").GetString() == personaId && a.GetProperty("escuelaId").GetString() == escuela);
        var auditoria = (await admin.GetFromJsonAsync<System.Text.Json.JsonElement[]>("/api/tutoria/auditoria" + global))!;
        Assert.Contains(auditoria, a =>
            a.GetProperty("escuelaId").GetString() == escuela && a.GetProperty("accion").GetString() == "asignar-tutor");

        var destino = (await admin.GetFromJsonAsync<EstadoTutoriaDto>("/api/tutoria/estado" + ambito))!;
        Assert.Equal(escuela, destino.EscuelaId);
        Assert.Contains(destino.Estudiantes, e => e.GetProperty("id").GetString() == personaId);
        Assert.DoesNotContain(destino.Estudiantes, e => e.GetProperty("escuelaId").GetString() == "E-IIS");
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync("/api/tutoria/periodo" + ambito,
            new { version = destino.PeriodoVersion, momento = "cierre" })).StatusCode);
        Assert.Equal("cierre", (await admin.GetFromJsonAsync<EstadoTutoriaDto>("/api/tutoria/estado" + ambito))!.Momento);
        Assert.Equal(inicial.Momento, (await admin.GetFromJsonAsync<EstadoTutoriaDto>("/api/tutoria/estado"))!.Momento);

        Assert.Equal(HttpStatusCode.Forbidden, (await coordinacion.GetAsync("/api/tutoria/estado" + ambito)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await tutor.GetAsync("/api/tutoria/estado" + ambito)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await coordinacion.GetAsync("/api/padron/" + personaId)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/padron/" + personaId)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/padron/" + personaManualId)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await coordinacion.GetAsync("/api/padron/" + personaManualId)).StatusCode);
    }
}
