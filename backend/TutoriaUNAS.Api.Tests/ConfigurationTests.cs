using TutoriaUNAS.Api.Configuration;

namespace TutoriaUNAS.Api.Tests;

public sealed class ConfigurationTests
{
    [Theory]
    [InlineData("https://identity.example", "tutoria", true)]
    [InlineData("http://identity.example", "tutoria", false)]
    [InlineData("", "tutoria", false)]
    [InlineData("https://identity.example", "", false)]
    public void EnabledIdentityRequiresSecureConfiguration(string authority, string audience, bool valid) =>
        Assert.Equal(valid, new IdentityOptions { Enabled = true, Authority = authority, Audience = audience }.IsValid());

    [Theory]
    [InlineData("http://localhost:5173", true)]
    [InlineData("https://portal.example", true)]
    [InlineData("*", false)]
    [InlineData("https://portal.example/path", false)]
    public void CorsRequiresExplicitOrigin(string origin, bool valid) =>
        Assert.Equal(valid, new CorsOptions { AllowedOrigins = [origin] }.IsValid());
}
