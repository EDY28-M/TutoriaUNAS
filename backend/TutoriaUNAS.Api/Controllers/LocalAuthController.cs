using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;
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
        var decision = cuentasHabilitadas ? await HttpContext.RequestServices.GetRequiredService<CredencialesCuentaService>().IntentarLogin(input, ct) : null;
        if (decision?.Activacion is { } activacion) return Ok(activacion);
        if (decision?.PendienteVinculacion == true) return Ok(new { pendienteVinculacion = true });
        if (decision?.Usuario is { } account)
        {
            var principal = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("sub", account.Subject), new Claim("iss", SeguridadCuenta.Issuer),
                new Claim("role", account.Rol), new Claim("access_version", account.Version.ToString(System.Globalization.CultureInfo.InvariantCulture)) }, SeguridadCuenta.Scheme, "sub", "role"));
            return SignIn(principal, SeguridadCuenta.Scheme);
        }
        if (!environment.IsDevelopment() || !configuration.GetValue<bool>("LocalDevelopment:Enabled"))
            return cuentasHabilitadas ? Unauthorized(new ProblemDetails { Status = 401, Title = "Datos de acceso incorrectos." }) : NotFound();
        var db = HttpContext.RequestServices.GetRequiredService<TutoriaDbContext>();
        var user = await db.Usuarios.SingleOrDefaultAsync(u => u.Issuer == "local-development" && u.Identificador == input.Identifier && u.Rol == input.Role && u.Activo, ct);
        var hasher = new PasswordHasher<UsuarioEntity>();
        if (user?.PasswordHashDesarrollo is null || hasher.VerifyHashedPassword(user, user.PasswordHashDesarrollo, input.Password) == PasswordVerificationResult.Failed) return Unauthorized(new ProblemDetails { Status = 401, Title = "Datos de acceso incorrectos." });
        var claims = new[] { new Claim("sub", user.Subject), new Claim("iss", "local-development"), new Claim("role", user.Rol), new Claim("access_version", user.Version.ToString(System.Globalization.CultureInfo.InvariantCulture)) };
        db.Auditoria.Add(new() { Fecha = HttpContext.RequestServices.GetRequiredService<TimeProvider>().GetUtcNow(), UsuarioId = user.Id, EscuelaId = user.EscuelaId, Accion = "iniciar-sesion", RecursoId = user.Id, Version = user.Version });
        await db.SaveChangesAsync(ct);
        return SignIn(new ClaimsPrincipal(new ClaimsIdentity(claims, "LocalDevelopment", "sub", "role")), "LocalDevelopment");
    }
}
