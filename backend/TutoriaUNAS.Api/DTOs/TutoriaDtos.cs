using System.Text.Json;

namespace TutoriaUNAS.Api.DTOs;

public sealed record UsuarioDto(string Id, string Role, string Name, string Identifier, string Email, string PersonaId);
public sealed record EstadoTutoriaDto(UsuarioDto Usuario, string SemestreId, string Momento, int PeriodoVersion,
    JsonElement[] Estudiantes, JsonElement[] Docentes, JsonElement[] Asignaciones,
    JsonElement[] Matriculas, JsonElement[] Horarios, InstrumentoDto[] Registros, SesionDto[] Sesiones,
    Dictionary<string, Dictionary<string, string>> Precargas, SistemaDto? Sistema = null, InstrumentoDto[]? Historial = null);
public sealed record InstrumentoDto(string Id, string Formato, string SemestreId, string TutorId, string? EstudianteId,
    string? SesionId, string Estado, int Avance, int Version, string Creado, string Actualizado, string? Enviado,
    string? RevisadoPor, JsonElement Observaciones, bool DescargaDisponible, Dictionary<string, string> Respuestas);
public sealed record SesionDto(string Id, string Codigo, string Tipo, string TutorId, string SemestreId,
    string Fecha, string HoraInicio, string HoraFin, string Modalidad, string Lugar, string Tema, string Objetivo,
    string Estado, AsistenteDto[] Asistentes, JsonElement Acuerdos, string? InstrumentoId, string? Observacion,
    bool AsistenciaConfirmada, int Version, int TotalConvocados, int TotalAsistentes);
public sealed record AsistenteDto(string EstudianteId, string Estado, string? HoraRegistro, string? Observacion);
public sealed record ProgramarSesionDto(string Tipo, string Fecha, string HoraInicio, string HoraFin, string Modalidad,
    string Lugar, string Tema, string Objetivo, string[] Estudiantes);
public sealed record RegistrarAsistenciaDto(int Version, AsistenteDto[] Asistentes, string Mensaje = "", string TipoTutoria = "Académica");
public sealed record CrearInstrumentoDto(string Formato, string? EstudianteId, string[]? Participantes = null);
public sealed record GuardarInstrumentoDto(int Version, Dictionary<string, string> Respuestas, bool Enviar);
public sealed record RevisarInstrumentoDto(int Version, string Decision, string Comentario);
public sealed record CambiarMomentoDto(int Version, string Momento);
public sealed record AsignarTutorDto(string EstudianteId, string TutorId, string? Grupo, string Referencia, int? Version = null, string? SolicitudId = null, int? SolicitudVersion = null);
public sealed record LoginLocalDto(string Identifier, string Password, string? Role = null, bool IncluirEstado = false);
