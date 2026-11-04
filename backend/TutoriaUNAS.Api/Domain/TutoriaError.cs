namespace TutoriaUNAS.Api.Domain;

public sealed class TutoriaError(int status, string message, Dictionary<string, string[]>? errors = null) : Exception(message)
{
    public int Status { get; } = status;
    public Dictionary<string, string[]>? Errors { get; } = errors;
    public static void Exigir(bool condition, string message, int status = 400)
    {
        if (!condition) throw new TutoriaError(status, message);
    }
}
