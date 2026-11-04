namespace TutoriaUNAS.Api.Entities;

public sealed class CredencialCuentaEntity
{
    public string UsuarioId { get; set; } = "";
    public string CorreoNormalizado { get; set; } = "";
    public string Rol { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool Verificada { get; set; }
    public bool CambioObligatorio { get; set; }
    public DateTimeOffset? TemporalHasta { get; set; }
    public int IntentosFallidos { get; set; }
    public DateTimeOffset? BloqueadaHasta { get; set; }
    public DateTimeOffset Creada { get; set; }
}

public sealed class RetoCorreoEntity
{
    public string Id { get; set; } = "";
    public string Correo { get; set; } = "";
    public string Rol { get; set; } = "";
    public string Proposito { get; set; } = "";
    public string? PersonaId { get; set; }
    public string? UsuarioId { get; set; }
    public int VersionUsuario { get; set; }
    public string? PruebaHash { get; set; }
    public string CodigoHash { get; set; } = "";
    public string? TicketHash { get; set; }
    public int Intentos { get; set; }
    public int Envios { get; set; }
    public DateTimeOffset Creado { get; set; }
    public DateTimeOffset Expira { get; set; }
    public DateTimeOffset? UltimoEnvio { get; set; }
    public DateTimeOffset? Verificado { get; set; }
    public DateTimeOffset? Consumido { get; set; }
}

public sealed class CorreoCuentaEntity
{
    public string Id { get; set; } = "";
    public string? UsuarioId { get; set; }
    public string? RetoId { get; set; }
    public string Destinatario { get; set; } = "";
    public string Asunto { get; set; } = "";
    public string ContenidoProtegido { get; set; } = "";
    public DateTimeOffset Creado { get; set; }
    public DateTimeOffset Caduca { get; set; }
    public DateTimeOffset ProximoIntento { get; set; }
    public DateTimeOffset? BloqueoHasta { get; set; }
    public DateTimeOffset? Enviado { get; set; }
    public DateTimeOffset? Cancelado { get; set; }
    public int Intentos { get; set; }
    public string? Error { get; set; }
}
