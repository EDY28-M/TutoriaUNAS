using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;
using TutoriaUNAS.Api.Services;
using TutoriaUNAS.Api.Services.Accounts;

namespace TutoriaUNAS.Api.Tests;

public sealed class CorreoPrueba : ICorreoCuentaSender
{
    public ConcurrentQueue<(string Para, string Asunto, string Contenido)> Mensajes { get; } = new();
    public bool FallarSiguiente { get; set; }
    public Task Enviar(string para, string asunto, string contenido, CancellationToken ct)
    {
        if (FallarSiguiente) { FallarSiguiente = false; throw new System.Net.Mail.SmtpException("Fallo sintético sin datos reales"); }
        Mensajes.Enqueue((para, asunto, contenido)); return Task.CompletedTask;
    }
}
public sealed class CuentasFixture : IAsyncLifetime
{
    public PostgresFixture Db { get; } = new();
    public WebApplicationFactory<Program> App { get; private set; } = null!;
    public CorreoPrueba Correo { get; } = new();
    public async Task InitializeAsync()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("TUTORIA_TEST_CONNECTION"))) return;
        await Db.InitializeAsync();
        App = Db.App.WithWebHostBuilder(builder => {
            builder.UseSetting("Cuentas:Enabled", "true");
            builder.UseSetting("Cuentas:DisableDispatcher", "true");
            builder.UseSetting("Cuentas:CodigoKey", Convert.ToBase64String(Enumerable.Range(1, 32).Select(n => (byte)n).ToArray()));
            builder.UseSetting("Cuentas:IpCodigosPorMinuto", "100");
            builder.UseSetting("Cuentas:IpVerificacionesPorMinuto", "200");
            builder.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(new Dictionary<string, string?> {
                ["Cuentas:Enabled"] = "true", ["Cuentas:DisableDispatcher"] = "true",
                ["Cuentas:CodigoKey"] = Convert.ToBase64String(Enumerable.Range(1, 32).Select(n => (byte)n).ToArray()),
                ["Cuentas:IpCodigosPorMinuto"] = "100", ["Cuentas:IpVerificacionesPorMinuto"] = "200"
            }));
            builder.ConfigureServices(s => { s.RemoveAll<ICorreoCuentaSender>(); s.AddSingleton<ICorreoCuentaSender>(Correo); });
        });
    }
    public async Task DisposeAsync() { if (App is not null) await App.DisposeAsync(); await Db.DisposeAsync(); }
    public async Task<HttpClient> Admin()
    {
        var c = App.CreateClient(); var r = await c.PostAsJsonAsync("/api/auth/login", new LoginLocalDto("coordinacion.tutoria", "tutoria2026", "coordinacion"));
        r.EnsureSuccessStatusCode(); c.DefaultRequestHeaders.Authorization = new("Bearer", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString()); return c;
    }
    public async Task<string> Persona(string email, string tipo = "estudiante", string escuela = "E-IIS")
    {
        await using var scope = App.Services.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
        var id = "PAD-TEST-" + Guid.NewGuid().ToString("N");
        db.Personas.Add(new() { Id = id, Tipo = tipo, EscuelaId = escuela, Ciclo = tipo == "estudiante" ? 3 : null,
            DatosJson = JsonDatos.Serializar(new { id, nombres = "Persona ficticia", apellidos = "Prueba de cuentas", correo = email, telefono = "", escuelaId = escuela, codigo = id, ciclo = tipo == "estudiante" ? (int?)3 : null }) });
        await db.SaveChangesAsync(); return id;
    }
    public async Task Drenar()
    {
        for (var n = 0; n < 100; n++)
        {
            await using var scope = App.Services.CreateAsyncScope();
            if (!await DespachadorCorreoCuenta.Procesar(scope.ServiceProvider)) break;
        }
    }
    public async Task<string> Codigo(string email)
    {
        await Drenar();
        var mail = Correo.Mensajes.Last(m => m.Para == email && m.Asunto.StartsWith("Verifica", StringComparison.Ordinal));
        return Regex.Match(mail.Contenido, @"\b\d{6}\b").Value;
    }
    public async Task Modificar(Func<TutoriaDbContext, Task> fn)
    { await using var scope = App.Services.CreateAsyncScope(); await fn(scope.ServiceProvider.GetRequiredService<TutoriaDbContext>()); }
}

public sealed class CuentasCorreoTests(CuentasFixture fixture) : IClassFixture<CuentasFixture>
{
    private const string Password = "Una frase segura para tutoría 2026!";
    private static string Email(string prefijo) => prefijo + Guid.NewGuid().ToString("N") + "@unas.edu.pe";
    private static async Task<T> Ok<T>(HttpResponseMessage r)
    { Assert.True(r.IsSuccessStatusCode, $"{r.StatusCode}: {await r.Content.ReadAsStringAsync()}"); return (await r.Content.ReadFromJsonAsync<T>())!; }
    private async Task<(CodigoEnCaminoDto Reto, string Ticket)> Verificar(HttpClient c, string email, string rol = "estudiante", string proposito = "registro", string? prueba = null)
    {
        var reto = await Ok<CodigoEnCaminoDto>(await c.PostAsJsonAsync("/api/auth/codigo", new SolicitarCodigoInput(email, proposito, rol, prueba)));
        var codigo = await fixture.Codigo(email);
        var validado = await Ok<CodigoValidadoDto>(await c.PostAsJsonAsync("/api/auth/codigo/confirmar", new ConfirmarCodigoInput(reto.RetoId, codigo, prueba)));
        return (reto, validado.Ticket);
    }
    private static async Task<string> Login(HttpClient c, string email, string password = Password, string rol = "estudiante") =>
        (await Ok<JsonElement>(await c.PostAsJsonAsync("/api/auth/login", new LoginLocalDto(email, password, rol)))).GetProperty("accessToken").GetString()!;

    [PostgresFact]
    public async Task AdministracionCreaLosTresPerfilesYNoAceptaOtraEscuela()
    {
        using var admin = await fixture.Admin();
        foreach (var rol in new[] { "estudiante", "tutor", "coordinacion" })
        {
            var email = Email("admin-");
            var creada = await Ok<CuentaCreadaDto>(await admin.PostAsJsonAsync("/api/cuentas", new CrearCuentaInput(email, rol, "Nombre ficticio", "Apellido ficticio")));
            Assert.True(creada.PasswordTemporal.Length >= 20);
            using var anon = fixture.App.CreateClient();
            var acceso = await Ok<JsonElement>(await anon.PostAsJsonAsync("/api/auth/login", new LoginLocalDto(email, creada.PasswordTemporal, rol)));
            Assert.True(acceso.GetProperty("activacionRequerida").GetBoolean()); Assert.False(acceso.TryGetProperty("accessToken", out _));
            anon.DefaultRequestHeaders.Authorization = new("Bearer", acceso.GetProperty("tokenActivacion").GetString());
            Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync("/api/tutoria/estado")).StatusCode);
            if (rol == "estudiante")
            {
                await fixture.Modificar(async db => { var cred = await db.CredencialesCuenta.SingleAsync(x => x.UsuarioId == creada.Id); cred.TemporalHasta = DateTimeOffset.UtcNow.AddSeconds(-1); await db.SaveChangesAsync(); });
                var renovada = await Ok<CuentaCreadaDto>(await admin.PostAsJsonAsync($"/api/cuentas/{creada.Id}/temporal", new VincularCuentaInput(1)));
                Assert.NotEqual(creada.PasswordTemporal, renovada.PasswordTemporal);
                Assert.Equal(HttpStatusCode.Unauthorized, (await anon.PostAsJsonAsync("/api/auth/login", new LoginLocalDto(email, creada.PasswordTemporal, rol))).StatusCode);
                Assert.True((await Ok<ActivacionRequeridaDto>(await anon.PostAsJsonAsync("/api/auth/login", new LoginLocalDto(email, renovada.PasswordTemporal, rol)))).ActivacionRequerida);
            }
        }
        var otro = Email("otra-escuela-"); var persona = await fixture.Persona(otro, escuela: "E-ECO");
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync("/api/cuentas", new CrearCuentaInput(otro, "estudiante", "", "", persona))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/cuentas", new CrearCuentaInput("persona@example.invalid", "estudiante", "Ficticio", "Prueba"))).StatusCode);
        using var anonimo = fixture.App.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.PostAsJsonAsync("/api/cuentas", new CrearCuentaInput(Email("sin-permiso-"), "coordinacion", "Ficticio", "Prueba"))).StatusCode);
    }

    [PostgresFact]
    public async Task AltaManualFueraDelPadronSeReflejaEnPersonasYEnCuentasSinDuplicar()
    {
        using var admin = await fixture.Admin();
        foreach (var rol in new[] { "estudiante", "tutor" })
        {
            var email = Email("fuera-padron-"); var codigo = "NUEVO-" + Guid.NewGuid().ToString("N")[..8];
            await fixture.Modificar(async db => Assert.DoesNotContain(await db.Personas.Select(p => p.DatosJson).ToArrayAsync(), datos => JsonDatos.Texto(datos, "correo") == email));
            var input = new CrearCuentaInput(email, rol, "Persona nueva ficticia", "Alta manual", Codigo: codigo, Ciclo: rol == "estudiante" ? 3 : null);
            var cuenta = await Ok<CuentaCreadaDto>(await admin.PostAsJsonAsync("/api/cuentas", input));
            var estado = await admin.GetFromJsonAsync<EstadoTutoriaDto>("/api/tutoria/estado");
            var lista = rol == "estudiante" ? estado!.Estudiantes : estado!.Docentes;
            var persona = Assert.Single(lista, p => p.GetProperty("correo").GetString() == email);
            Assert.Equal("Persona nueva ficticia", persona.GetProperty("nombres").GetString());
            Assert.Equal("Alta manual", persona.GetProperty("apellidos").GetString());
            Assert.Equal(codigo, persona.GetProperty("codigo").GetString());
            Assert.Equal("E-IIS", persona.GetProperty("escuelaId").GetString());
            if (rol == "estudiante") Assert.Equal(3, persona.GetProperty("ciclo").GetInt32());
            var cuentas = await admin.GetFromJsonAsync<JsonElement[]>("/api/cuentas");
            var acceso = Assert.Single(cuentas!, c => c.GetProperty("id").GetString() == cuenta.Id);
            Assert.Equal(rol, acceso.GetProperty("rol").GetString());
            Assert.False(acceso.GetProperty("verificada").GetBoolean());
            Assert.True(acceso.GetProperty("cambioObligatorio").GetBoolean());
            Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/cuentas", input)).StatusCode);
            await fixture.Modificar(async db => Assert.Single(await db.Personas.Select(p => p.DatosJson).ToArrayAsync(), datos => JsonDatos.Texto(datos, "correo") == email));
        }
    }

    [PostgresFact]
    public async Task TemporalExigeCodigoYPasswordPersonalSinReutilizarPruebas()
    {
        using var admin = await fixture.Admin(); using var c = fixture.App.CreateClient(); var email = Email("temporal-");
        var cuenta = await Ok<CuentaCreadaDto>(await admin.PostAsJsonAsync("/api/cuentas", new CrearCuentaInput(email, "estudiante", "Ficticio", "Prueba")));
        var acceso = await Ok<ActivacionRequeridaDto>(await c.PostAsJsonAsync("/api/auth/login", new LoginLocalDto(email, cuenta.PasswordTemporal, "estudiante")));
        var reto = await Ok<CodigoEnCaminoDto>(await c.PostAsJsonAsync("/api/auth/codigo", new SolicitarCodigoInput(email, "activacion", TokenActivacion: acceso.TokenActivacion)));
        var codigo = await fixture.Codigo(email);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/auth/codigo/confirmar", new ConfirmarCodigoInput(reto.RetoId, codigo))).StatusCode);
        var validado = await Ok<CodigoValidadoDto>(await c.PostAsJsonAsync("/api/auth/codigo/confirmar", new ConfirmarCodigoInput(reto.RetoId, codigo, acceso.TokenActivacion)));
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/codigo/confirmar", new ConfirmarCodigoInput(reto.RetoId, codigo, acceso.TokenActivacion))).StatusCode);
        var input = new CompletarCuentaInput(reto.RetoId, validado.Ticket, Password, Password);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/cuenta/completar", input with { Password = cuenta.PasswordTemporal, Confirmacion = cuenta.PasswordTemporal })).StatusCode);
        await Ok<CuentaCompletadaDto>(await c.PostAsJsonAsync("/api/auth/cuenta/completar", input));
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/cuenta/completar", input)).StatusCode);
        c.DefaultRequestHeaders.Authorization = new("Bearer", await Login(c, email));
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/api/tutoria/estado")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/auth/login", new LoginLocalDto(email, cuenta.PasswordTemporal, "estudiante"))).StatusCode);
        await fixture.Modificar(async db => { var cred = await db.CredencialesCuenta.SingleAsync(x => x.UsuarioId == cuenta.Id); Assert.True(cred.Verificada); Assert.False(cred.CambioObligatorio); Assert.NotEqual(Password, cred.PasswordHash); });
    }

    [PostgresFact]
    public async Task RegistroDesdePadronQuedaVerificadoYNoPermiteAutocrearCoordinacion()
    {
        using var c = fixture.App.CreateClient(); var email = Email("registro-"); var pid = await fixture.Persona(email);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/auth/codigo", new SolicitarCodigoInput(email, "registro", "coordinacion"))).StatusCode);
        var (reto, ticket) = await Verificar(c, email);
        await Ok<CuentaCompletadaDto>(await c.PostAsJsonAsync("/api/auth/cuenta/completar", new CompletarCuentaInput(reto.RetoId, ticket, Password, Password)));
        var token = await Login(c, email); c.DefaultRequestHeaders.Authorization = new("Bearer", token);
        var estado = await c.GetFromJsonAsync<EstadoTutoriaDto>("/api/tutoria/estado"); Assert.Equal(pid, estado!.Usuario.PersonaId);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/cuentas", new CrearCuentaInput(Email("prohibida-"), "coordinacion", "Nombre", "Prueba"))).StatusCode);
        var extra = Email("no-padron-");
        var sinPadron = await Ok<CodigoEnCaminoDto>(await c.PostAsJsonAsync("/api/auth/codigo", new SolicitarCodigoInput(extra, "registro")));
        Assert.Equal(reto.Mensaje, sinPadron.Mensaje);
        Assert.DoesNotContain(fixture.Correo.Mensajes, m => m.Para == extra);
    }

    [PostgresFact]
    public async Task CodigosTienenCaducidadCincoIntentosYReenvioInvalidaElAnterior()
    {
        using var c = fixture.App.CreateClient(); var email = Email("limites-"); await fixture.Persona(email);
        var r = await Ok<CodigoEnCaminoDto>(await c.PostAsJsonAsync("/api/auth/codigo", new SolicitarCodigoInput(email, "registro")));
        var codigo = await fixture.Codigo(email);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await c.PostAsJsonAsync("/api/auth/codigo", new SolicitarCodigoInput(email, "registro"))).StatusCode);
        await fixture.Modificar(async db => { var reto = await db.RetosCorreo.FindAsync(r.RetoId); reto!.Expira = DateTimeOffset.UtcNow.AddMinutes(-1); reto.UltimoEnvio = DateTimeOffset.UtcNow.AddMinutes(-2); await db.SaveChangesAsync(); });
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/codigo/confirmar", new ConfirmarCodigoInput(r.RetoId, codigo))).StatusCode);
        var nuevo = await Ok<CodigoEnCaminoDto>(await c.PostAsJsonAsync("/api/auth/codigo", new SolicitarCodigoInput(email, "registro")));
        Assert.NotEqual(r.RetoId, nuevo.RetoId);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/codigo/confirmar", new ConfirmarCodigoInput(r.RetoId, codigo))).StatusCode);
        var correcto = await fixture.Codigo(email);
        for (var n = 0; n < 5; n++) Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/codigo/confirmar", new ConfirmarCodigoInput(nuevo.RetoId, "xxxxxx"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/codigo/confirmar", new ConfirmarCodigoInput(nuevo.RetoId, correcto))).StatusCode);
    }

    [PostgresFact]
    public async Task DocenteSinEscuelaQuedaVerificadoHastaLaVinculacionAutorizada()
    {
        using var c = fixture.App.CreateClient(); using var admin = await fixture.Admin(); var email = Email("docente-");
        await fixture.Persona(email, "tutor", ""); var (r, ticket) = await Verificar(c, email, "tutor");
        var resultado = await Ok<CuentaCompletadaDto>(await c.PostAsJsonAsync("/api/auth/cuenta/completar", new CompletarCuentaInput(r.RetoId, ticket, Password, Password)));
        Assert.True(resultado.PendienteVinculacion);
        var pendiente = await Ok<JsonElement>(await c.PostAsJsonAsync("/api/auth/login", new LoginLocalDto(email, Password, "tutor")));
        Assert.True(pendiente.GetProperty("pendienteVinculacion").GetBoolean());
        var lista = await admin.GetFromJsonAsync<JsonElement[]>("/api/cuentas"); var cuenta = Assert.Single(lista!, x => x.GetProperty("correo").GetString() == email);
        var response = await admin.PutAsJsonAsync($"/api/cuentas/{cuenta.GetProperty("id").GetString()}/vinculacion", new VincularCuentaInput(cuenta.GetProperty("version").GetInt32())); Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        c.DefaultRequestHeaders.Authorization = new("Bearer", await Login(c, email, rol: "tutor"));
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/api/tutoria/estado")).StatusCode);
    }

    [PostgresFact]
    public async Task RecuperacionRevocaSesionesYUnCodigoSoloEmiteUnTicketConcurrente()
    {
        using var c = fixture.App.CreateClient(); var email = Email("recuperar-"); await fixture.Persona(email);
        var (r, ticket) = await Verificar(c, email);
        await Ok<CuentaCompletadaDto>(await c.PostAsJsonAsync("/api/auth/cuenta/completar", new CompletarCuentaInput(r.RetoId, ticket, Password, Password)));
        var anterior = await Login(c, email);
        await fixture.Modificar(async db => { foreach (var x in await db.RetosCorreo.Where(x => x.Correo == email).ToArrayAsync()) x.UltimoEnvio = DateTimeOffset.UtcNow.AddMinutes(-2); await db.SaveChangesAsync(); });
        var reset = await Ok<CodigoEnCaminoDto>(await c.PostAsJsonAsync("/api/auth/codigo", new SolicitarCodigoInput(email, "recuperacion")));
        var codigo = await fixture.Codigo(email);
        using var otro = fixture.App.CreateClient();
        var responses = await Task.WhenAll(c.PostAsJsonAsync("/api/auth/codigo/confirmar", new ConfirmarCodigoInput(reset.RetoId, codigo)), otro.PostAsJsonAsync("/api/auth/codigo/confirmar", new ConfirmarCodigoInput(reset.RetoId, codigo)));
        var valido = Assert.Single(responses, x => x.IsSuccessStatusCode); Assert.Single(responses, x => x.StatusCode == HttpStatusCode.BadRequest);
        var nueva = "Otra frase segura de recuperación 2026!";
        var grant = await valido.Content.ReadFromJsonAsync<CodigoValidadoDto>();
        await Ok<CuentaCompletadaDto>(await c.PostAsJsonAsync("/api/auth/cuenta/completar", new CompletarCuentaInput(reset.RetoId, grant!.Ticket, nueva, nueva)));
        c.DefaultRequestHeaders.Authorization = new("Bearer", anterior);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/tutoria/estado")).StatusCode);
        await Login(otro, email, nueva);
    }

    [PostgresFact]
    public async Task OutboxCifraElCodigoYReintentaSinDuplicarElMensajeAceptado()
    {
        await fixture.Drenar();
        using var c = fixture.App.CreateClient(); var email = Email("cola-"); await fixture.Persona(email);
        var r = await Ok<CodigoEnCaminoDto>(await c.PostAsJsonAsync("/api/auth/codigo", new SolicitarCodigoInput(email, "registro")));
        await fixture.Modificar(async db => { var mail = await db.CorreosCuenta.SingleAsync(x => x.RetoId == r.RetoId); Assert.DoesNotContain("Tu código", mail.ContenidoProtegido); Assert.NotEmpty(mail.ContenidoProtegido); });
        fixture.Correo.FallarSiguiente = true;
        await fixture.Drenar();
        Assert.DoesNotContain(fixture.Correo.Mensajes, m => m.Para == email);
        await fixture.Modificar(async db => { var mail = await db.CorreosCuenta.SingleAsync(x => x.RetoId == r.RetoId); Assert.Equal(1, mail.Intentos); Assert.NotNull(mail.Error); mail.ProximoIntento = DateTimeOffset.UtcNow.AddSeconds(-1); await db.SaveChangesAsync(); });
        Assert.Equal(6, (await fixture.Codigo(email)).Length);
        await fixture.Drenar();
        Assert.Single(fixture.Correo.Mensajes, m => m.Para == email);
        await fixture.Modificar(async db => { var mail = await db.CorreosCuenta.SingleAsync(x => x.RetoId == r.RetoId); Assert.NotNull(mail.Enviado); Assert.Empty(mail.ContenidoProtegido); });
    }
}
