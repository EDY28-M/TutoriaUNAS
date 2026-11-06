using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;
using TutoriaUNAS.Api.Services;
using TutoriaUNAS.Api.Services.Accounts;

namespace TutoriaUNAS.Api.Controllers;

[ApiController, Route("api/auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class LocalAuthController(IWebHostEnvironment environment, IConfiguration configuration) : ControllerBase
{
    [HttpPost("login"), EnableRateLimiting("local-login"), RequestSizeLimit(4096)]
    public async Task<IActionResult> Login(LoginLocalDto input, CancellationToken ct)
    {
        var cuentasHabilitadas = configuration.GetValue<bool>("Cuentas:Enabled");
        var origen = OrigenAcceso.Leer(Request);
        var decision = cuentasHabilitadas ? await HttpContext.RequestServices.GetRequiredService<CredencialesCuentaService>().IntentarLogin(input, origen, ct) : null;
        if (decision?.Activacion is { } activacion) return Ok(activacion);
        if (decision?.PendienteVinculacion == true) return Ok(new { pendienteVinculacion = true });
        if (decision?.Usuario is { } account)
        {
            var principal = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("sub", account.Subject), new Claim("iss", SeguridadCuenta.Issuer),
                new Claim("role", account.Rol), new Claim("access_version", account.Version.ToString(System.Globalization.CultureInfo.InvariantCulture)) }, SeguridadCuenta.Scheme, "sub", "role"));
            return await Acceso(principal, SeguridadCuenta.Scheme, input.IncluirEstado, ct);
        }
        if (!environment.IsDevelopment() || !configuration.GetValue<bool>("LocalDevelopment:Enabled"))
            return cuentasHabilitadas ? Unauthorized(new ProblemDetails { Status = 401, Title = "Datos de acceso incorrectos." }) : NotFound();
        var db = HttpContext.RequestServices.GetRequiredService<TutoriaDbContext>();
        var identifier = input.Identifier.Trim().ToLowerInvariant();
        var candidatos = await db.Usuarios.Where(u => u.Issuer == "local-development" &&
            u.Identificador.ToLower() == identifier && (input.Role == null || u.Rol == input.Role) && u.Activo).ToArrayAsync(ct);
        var hasher = new PasswordHasher<UsuarioEntity>();
        var coincidencias = candidatos.Where(u => u.PasswordHashDesarrollo is not null &&
            hasher.VerifyHashedPassword(u, u.PasswordHashDesarrollo, input.Password) != PasswordVerificationResult.Failed).ToArray();
        if (coincidencias.Length != 1) return Unauthorized(new ProblemDetails { Status = 401, Title = "Datos de acceso incorrectos." });
        var user = coincidencias[0];
        var claims = new[] { new Claim("sub", user.Subject), new Claim("iss", "local-development"), new Claim("role", user.Rol), new Claim("access_version", user.Version.ToString(System.Globalization.CultureInfo.InvariantCulture)) };
        db.Auditoria.Add(origen.Registrar(user, HttpContext.RequestServices.GetRequiredService<TimeProvider>().GetUtcNow(), "iniciar-sesion"));
        await db.SaveChangesAsync(ct);
        return await Acceso(new ClaimsPrincipal(new ClaimsIdentity(claims, "LocalDevelopment", "sub", "role")), "LocalDevelopment", input.IncluirEstado, ct);
    }

    private async Task<IActionResult> Acceso(ClaimsPrincipal principal, string scheme, bool incluirEstado, CancellationToken ct)
    {
        if (!incluirEstado) return SignIn(principal, scheme);
        var services = HttpContext.RequestServices;
        HttpContext.User = principal;
        var actor = await services.GetRequiredService<TutoriaContext>().Actor(ct);
        actor.Exigir("portal", "ver");
        var estado = await services.GetRequiredService<EstadoTutoriaService>().Obtener(ct, inicioInstitucional: true);
        var options = services.GetRequiredService<IOptionsMonitor<BearerTokenOptions>>().Get(scheme);
        var now = services.GetRequiredService<TimeProvider>().GetUtcNow();
        // Mismo formato de ticket, protecciones y vigencia que el esquema BearerToken.
        var access = new AuthenticationTicket(principal, new() { ExpiresUtc = now + options.BearerTokenExpiration }, $"{scheme}:AccessToken");
        var refresh = new AuthenticationTicket(principal, new() { ExpiresUtc = now + options.RefreshTokenExpiration }, $"{scheme}:RefreshToken");
        Response.Headers.CacheControl = "no-store, no-transform";
        return Ok(new
        {
            tokenType = "Bearer",
            accessToken = options.BearerTokenProtector.Protect(access),
            expiresIn = (long)options.BearerTokenExpiration.TotalSeconds,
            refreshToken = options.RefreshTokenProtector.Protect(refresh),
            estado
        });
    }
}
