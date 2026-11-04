namespace TutoriaUNAS.Api.Entities;

public sealed class PersonaEntity
{
    public string Id { get; set; } = "";
    public string Tipo { get; set; } = "";
    public string EscuelaId { get; set; } = "";
    public int? Ciclo { get; set; }
    public bool Activa { get; set; } = true;
    public string DatosJson { get; set; } = "{}";
}
public sealed class UsuarioEntity
{
    public int Version { get; set; } = 1;
    public string Id { get; set; } = "";
    public string Issuer { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Rol { get; set; } = "";
    public string PersonaId { get; set; } = "";
    public string EscuelaId { get; set; } = "";
    public string Identificador { get; set; } = "";
    public string? PasswordHashDesarrollo { get; set; }
    public bool Activo { get; set; } = true;
}
public sealed class PeriodoEntity
{
    public string Id { get; set; } = "";
    public string EscuelaId { get; set; } = "";
    public string SemestreId { get; set; } = "";
    public string Momento { get; set; } = "durante";
    public bool Activo { get; set; } = true;
    public int Version { get; set; } = 1;
}
public sealed class AsignacionEntity
{
    public string Id { get; set; } = "";
    public string EstudianteId { get; set; } = "";
    public string TutorId { get; set; } = "";
    public string EscuelaId { get; set; } = "";
    public string SemestreId { get; set; } = "";
    public string? Grupo { get; set; }
    public string DatosJson { get; set; } = "{}";
    public bool Activa { get; set; } = true;
    public int Version { get; set; } = 1;
}
public sealed class HorarioAcademicoEntity
{
    public string Id { get; set; } = "";
    public string EstudianteId { get; set; } = "";
    public string SemestreId { get; set; } = "";
    public int Dia { get; set; }
    public string HoraInicio { get; set; } = "";
    public string HoraFin { get; set; } = "";
    public string DatosJson { get; set; } = "{}";
}
public sealed class MatriculaEntity
{
    public string Id { get; set; } = "";
    public string EstudianteId { get; set; } = "";
    public string SemestreId { get; set; } = "";
    public string DatosJson { get; set; } = "{}";
}
public sealed class SesionEntity
{
    public string Id { get; set; } = "";
    public string TutorId { get; set; } = "";
    public string EscuelaId { get; set; } = "";
    public string SemestreId { get; set; } = "";
    public string Tipo { get; set; } = "individual";
    public string Fecha { get; set; } = "";
    public string HoraInicio { get; set; } = "";
    public string HoraFin { get; set; } = "";
    public DateTimeOffset FinUtc { get; set; }
    public string Modalidad { get; set; } = "presencial";
    public string Lugar { get; set; } = "";
    public string Tema { get; set; } = "";
    public string Objetivo { get; set; } = "";
    public string Estado { get; set; } = "programada";
    public bool AsistenciaConfirmada { get; set; }
    public string AcuerdosJson { get; set; } = "[]";
    public string? InstrumentoId { get; set; }
    public int Version { get; set; } = 1;
    public List<AsistenciaEntity> Asistentes { get; set; } = [];
}
public sealed class AsistenciaEntity
{
    public string SesionId { get; set; } = "";
    public string EstudianteId { get; set; } = "";
    public string Estado { get; set; } = "justificado";
    public string? HoraRegistro { get; set; }
    public string? Observacion { get; set; }
}
public sealed class InstrumentoEntity
{
    public string Id { get; set; } = "";
    public string Formato { get; set; } = "";
    public string EscuelaId { get; set; } = "";
    public string SemestreId { get; set; } = "";
    public string TutorId { get; set; } = "";
    public string? EstudianteId { get; set; }
    public string? SesionId { get; set; }
    public string Estado { get; set; } = "no-iniciado";
    public int Avance { get; set; }
    public int Version { get; set; }
    public DateTimeOffset Creado { get; set; }
    public DateTimeOffset Actualizado { get; set; }
    public DateTimeOffset? Enviado { get; set; }
    public string? RevisadoPor { get; set; }
    public string RespuestasJson { get; set; } = "{}";
    public string ObservacionesJson { get; set; } = "[]";
}
public sealed class ExpedienteDatoEntity
{
    public string EstudianteId { get; set; } = "";
    public string Periodo { get; set; } = "";
    public string Campo { get; set; } = "";
    public string Valor { get; set; } = "";
    public string DocumentoId { get; set; } = "";
    public DateTimeOffset Actualizado { get; set; }
}
public sealed class AuditoriaEntity
{
    public long Id { get; set; }
    public DateTimeOffset Fecha { get; set; }
    public string UsuarioId { get; set; } = "";
    public string EscuelaId { get; set; } = "";
    public string Accion { get; set; } = "";
    public string RecursoId { get; set; } = "";
    public int Version { get; set; }
}
