using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;

namespace TutoriaUNAS.Api.Tests;

// Test-only trusted principal injection. This handler is never registered by the API.
public sealed class TestIdentityHandler(IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger, UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var role = Request.Headers["X-Test-Role"].ToString();
        var claims = new[] { new Claim("sub", "test-subject"), new Claim("role", role) };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme.Name, "sub", "role"));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name)));
    }
}
