using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.DependencyInjection;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Tests;

public sealed class ApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;

    public ApiIntegrationTests(WebApplicationFactory<Program> factory) => this.factory = factory;

    private HttpClient CreateClient(string environment = "Development") => factory.WithWebHostBuilder(builder => builder.UseEnvironment(environment)).CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    [Fact]
    public async Task StatusAndHealthWorkWithoutPostgres()
    {
        using var client = CreateClient();
        var status = await client.GetFromJsonAsync<SystemStatusDto>("/api/status");
        Assert.NotNull(status);
        Assert.Equal("ok", status.Status);
        Assert.False(status.DatabaseEnabled);
        Assert.Equal("Healthy", await client.GetStringAsync("/health"));
    }

    [Fact]
    public async Task DemoOverviewIsClearlyLabeled()
    {
        using var client = CreateClient();
        var overview = await client.GetFromJsonAsync<DemoOverviewDto>("/api/demo/overview");
        Assert.NotNull(overview);
        Assert.True(overview.IsDemo);
        Assert.Contains("ficticios", overview.Notice, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("/api/demo/overview")]
    [InlineData("/openapi/v1.json")]
    [InlineData("/swagger/index.html")]
    public async Task DemoAndDocumentationAreUnavailableInProduction(string path)
    {
        using var client = CreateClient("Production");
        using var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-valid-token")]
    public async Task ServerRejectsUnverifiedIdentity(string? token)
    {
        using var client = CreateClient();
        if (token is not null) client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        using var response = await client.GetAsync("/api/access/me?role=coordinacion");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("http://localhost:5173", true)]
    [InlineData("https://untrusted.example", false)]
    public async Task CorsAllowsOnlyConfiguredOrigins(string origin, bool allowed)
    {
        using var client = CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/status");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "GET");
        using var response = await client.SendAsync(request);
        Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task OpenApiIncludesControllers()
    {
        using var client = CreateClient();
        var document = await client.GetStringAsync("/openapi/v1.json");
        Assert.Contains("/api/status", document, StringComparison.Ordinal);
        Assert.Contains("/api/access/me", document, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("estudiante", HttpStatusCode.OK)]
    [InlineData("tutor", HttpStatusCode.OK)]
    [InlineData("coordinacion", HttpStatusCode.OK)]
    [InlineData("administrador", HttpStatusCode.Forbidden)]
    public async Task ServerEnforcesRolesFromVerifiedPrincipal(string role, HttpStatusCode expectedStatus)
    {
        using var verifiedFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureTestServices(services => services.AddAuthentication("TestIdentity")
                .AddScheme<AuthenticationSchemeOptions, TestIdentityHandler>("TestIdentity", _ => { }));
        });
        using var client = verifiedFactory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Role", role);
        using var response = await client.GetAsync("/api/access/me");
        Assert.Equal(expectedStatus, response.StatusCode);
        if (expectedStatus == HttpStatusCode.OK)
        {
            var identity = await response.Content.ReadFromJsonAsync<CurrentIdentityDto>();
            Assert.NotNull(identity);
            Assert.Equal("test-subject", identity.Subject);
            Assert.Contains(role, identity.Roles);
        }
    }

    [Fact]
    public async Task UnexpectedErrorsReturnProblemDetailsWithoutInternalInformation()
    {
        using var failingFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureTestServices(services => services.AddScoped<ISystemStatusService, FailingStatusService>());
        });
        using var client = failingFactory.CreateClient();
        using var response = await client.GetAsync("/api/status");
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("internal-test-information", body, StringComparison.Ordinal);
        Assert.Contains("traceId", body, StringComparison.Ordinal);
    }

    private sealed class FailingStatusService : ISystemStatusService
    {
        public SystemStatusDto GetStatus() => throw new InvalidOperationException("internal-test-information");
    }
}
