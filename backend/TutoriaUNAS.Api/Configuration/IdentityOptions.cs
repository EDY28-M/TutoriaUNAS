namespace TutoriaUNAS.Api.Configuration;

public sealed class IdentityOptions
{
    public const string SectionName = "Authentication";
    public bool Enabled { get; init; }
    public string Authority { get; init; } = string.Empty;
    public string Audience { get; init; } = string.Empty;

    public bool IsValid() => !Enabled ||
        (Uri.TryCreate(Authority, UriKind.Absolute, out var authorityUri) &&
         authorityUri.Scheme == Uri.UriSchemeHttps && !string.IsNullOrWhiteSpace(Audience));
}
