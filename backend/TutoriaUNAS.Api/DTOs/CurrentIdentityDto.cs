namespace TutoriaUNAS.Api.DTOs;

public sealed record CurrentIdentityDto(string Subject, IReadOnlyCollection<string> Roles);
