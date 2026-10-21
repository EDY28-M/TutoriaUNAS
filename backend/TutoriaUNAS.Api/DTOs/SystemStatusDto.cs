namespace TutoriaUNAS.Api.DTOs;

public sealed record SystemStatusDto(string Status, string Mode, bool DatabaseEnabled, DateTimeOffset CheckedAt);
