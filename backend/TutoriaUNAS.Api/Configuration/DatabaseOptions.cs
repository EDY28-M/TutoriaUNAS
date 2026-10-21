namespace TutoriaUNAS.Api.Configuration;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";
    public bool Enabled { get; init; }
}
