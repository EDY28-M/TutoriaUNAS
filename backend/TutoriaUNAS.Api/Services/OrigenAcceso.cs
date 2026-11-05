using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services;

/// <summary>Solo conserva categorías del dispositivo.</summary>
public sealed record OrigenAcceso(string? Dispositivo)
{
    public static OrigenAcceso Leer(HttpRequest request)
    {
        var ua = request.Headers.UserAgent.ToString();
        if (ua.Length > 1024) ua = ua[..1024];
        bool Contiene(string valor) => ua.Contains(valor, StringComparison.OrdinalIgnoreCase);
        var sistema = Contiene("iPad") || Contiene("iPhone") || Contiene("iPod") ? "iOS" :
            Contiene("Android") ? "Android" : Contiene("Windows") ? "Windows" :
            Contiene("CrOS") ? "ChromeOS" : Contiene("Macintosh") ? "macOS" :
            Contiene("Linux") ? "Linux" : null;
        var navegador = Contiene("Edg/") || Contiene("EdgA/") || Contiene("EdgiOS/") ? "Edge" :
            Contiene("OPR/") || Contiene("Opera") ? "Opera" :
            Contiene("Firefox/") || Contiene("FxiOS/") ? "Firefox" :
            Contiene("Chrome/") || Contiene("CriOS/") ? "Chrome" :
            Contiene("Safari/") ? "Safari" : null;
        var tipo = Contiene("iPad") || Contiene("Tablet") ||
            (sistema == "Android" && !Contiene("Mobi")) ? "Tableta" :
            Contiene("Mobi") || Contiene("iPhone") || Contiene("iPod") ? "Celular" :
            sistema is "Windows" or "macOS" or "Linux" or "ChromeOS" ? "Computadora" : null;
        var partes = new[] { tipo, sistema, navegador }.OfType<string>().ToArray();

        return new(partes.Length == 0 ? null : string.Join(" · ", partes));
    }

    public AuditoriaEntity Registrar(UsuarioEntity usuario, DateTimeOffset fecha, string accion) => new()
    {
        Fecha = fecha,
        UsuarioId = usuario.Id,
        EscuelaId = usuario.EscuelaId,
        Accion = accion,
        RecursoId = usuario.Id,
        Version = usuario.Version,
        Dispositivo = Dispositivo,
    };
}
