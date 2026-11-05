namespace TutoriaUNAS.Api.DTOs;

public sealed record SolicitarCodigoInput(string Correo, string Proposito, string Rol = "estudiante", string? TokenActivacion = null);
public sealed record ConfirmarCodigoInput(string RetoId, string Codigo, string? TokenActivacion = null);
public sealed record CompletarCuentaInput(string RetoId, string Ticket, string Password, string Confirmacion);
public sealed record CrearCuentaInput(string Correo, string Rol, string Nombres, string Apellidos, string? PersonaId = null, string? Codigo = null, int? Ciclo = null);
public sealed record VincularCuentaInput(int Version);
public sealed record CodigoEnCaminoDto(string RetoId, int ExpiraEn, int ReenviarEn, string Mensaje);
public sealed record CodigoValidadoDto(string Ticket, int ExpiraEn);
public sealed record CuentaCompletadaDto(string Identifier, string Role, bool PendienteVinculacion);
public sealed record ActivacionRequeridaDto(bool ActivacionRequerida, string TokenActivacion, string Correo, int ExpiraEn, string Role);
public sealed record CuentaCreadaDto(string Id, string Identifier, string PasswordTemporal, int ExpiraEn, string EstadoCorreo);
