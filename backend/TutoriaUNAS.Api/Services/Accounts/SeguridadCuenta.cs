using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.Domain;

namespace TutoriaUNAS.Api.Services.Accounts;

public sealed class SeguridadCuenta(IOptions<CuentasOptions> options)
{
    public const string Issuer = "portal-account";
    public const string Scheme = "PortalAccount";
    public const string CodigoInvalido = "El código no es válido, venció o agotó sus intentos. Solicita uno nuevo.";
    public static string Aleatorio() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    public static string Hash(string valor) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(valor)));
    public static bool Iguales(string? a, string? b) => a is not null && b is not null &&
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
    public string HashCodigo(string id, string codigo) => Convert.ToHexString(HMACSHA256.HashData(
        Convert.FromBase64String(options.Value.CodigoKey), Encoding.UTF8.GetBytes(id + ":" + codigo)));
    public string Correo(string valor)
    {
        var email = valor.Trim().ToLowerInvariant();
        TutoriaError.Exigir(email.Length <= 254 && MailAddress.TryCreate(email, out var parsed) && parsed.Address == email &&
            options.Value.Dominios.Contains(parsed.Host, StringComparer.OrdinalIgnoreCase), "Usa tu correo institucional @unas.edu.pe.");
        return email;
    }
    public static void Password(string valor, string confirmacion)
    {
        TutoriaError.Exigir(valor.Length is >= 15 and <= 128 && !string.IsNullOrWhiteSpace(valor), "Usa una contraseña de 15 a 128 caracteres. Puedes usar una frase larga.");
        TutoriaError.Exigir(valor == confirmacion, "Las contraseñas no coinciden.");
    }
}
