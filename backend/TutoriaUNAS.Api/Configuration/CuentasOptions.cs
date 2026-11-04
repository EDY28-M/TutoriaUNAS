namespace TutoriaUNAS.Api.Configuration;

public sealed class CuentasOptions
{
    public bool Enabled { get; init; }
    public bool DisableDispatcher { get; init; }
    public int IpCodigosPorMinuto { get; init; } = 5;
    public int IpVerificacionesPorMinuto { get; init; } = 20;
    public string[] Dominios { get; init; } = ["unas.edu.pe"];
    public string CodigoKey { get; init; } = "";
    public string KeyRingPath { get; init; } = "";
    public string UrlAcceso { get; init; } = "http://127.0.0.1:5173/login";
    public bool Valida()
    {
        if (!Enabled) return true;
        try { return Convert.FromBase64String(CodigoKey).Length >= 32 && Dominios.Length > 0 && IpCodigosPorMinuto is >= 1 and <= 100 && IpVerificacionesPorMinuto is >= 1 and <= 200 &&
            Uri.TryCreate(UrlAcceso, UriKind.Absolute, out var url) && (url.Scheme == "https" || (url.Scheme == "http" && url.IsLoopback)); }
        catch (FormatException) { return false; }
    }
}
public sealed class SmtpCuentaOptions
{
    public string Host { get; init; } = "smtp.gmail.com";
    public int Port { get; init; } = 587;
    public string Usuario { get; init; } = "";
    public string Remitente { get; init; } = "";
    public string Nombre { get; init; } = "Tutoría UNAS";
    public string PasswordFile { get; init; } = "";
}
