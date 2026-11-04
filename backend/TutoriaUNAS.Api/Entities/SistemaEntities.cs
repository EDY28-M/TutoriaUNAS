namespace TutoriaUNAS.Api.Entities;

// Los catálogos y las instantáneas de fuentes externas son de solo lectura en el
// portal. Su JSON conserva el contrato de cada fuente, con alcance y procedencia explícitos.
public sealed class CatalogoEntity
{
    public string Tipo { get; set; } = "";
    public string Id { get; set; } = "";
    public string DatosJson { get; set; } = "{}";
    public int Version { get; set; } = 1;
}
public sealed class RegistroFuenteEntity
{
    public string Tipo { get; set; } = "";
    public string Id { get; set; } = "";
    public string? EstudianteId { get; set; }
    public string? TutorId { get; set; }
    public string? EscuelaId { get; set; }
    public string? SemestreId { get; set; }
    public string Fuente { get; set; } = "";
    public DateTimeOffset FechaCorte { get; set; }
    public string DatosJson { get; set; } = "{}";
    public int Version { get; set; } = 1;
}
public sealed class ContactoEntity
{
    public string PersonaId { get; set; } = "";
    public string Correo { get; set; } = "";
    public string Telefono { get; set; } = "";
    public DateTimeOffset Actualizado { get; set; }
    public int Version { get; set; } = 1;
}
public sealed class PreferenciaUsuarioEntity
{
    public string UsuarioId { get; set; } = "";
    public string AvisosJson { get; set; } = "{}";
    public string PantallaJson { get; set; } = "{}";
    public int Version { get; set; } = 1;
}
public sealed class PermisoAccesoEntity
{
    public string Rol { get; set; } = "";
    public string Recurso { get; set; } = "";
    public string Nombre { get; set; } = "";
    public string AccionesJson { get; set; } = "[]";
}
public sealed class MensajeEntity
{
    public string Id { get; set; } = "";
    public string EmisorId { get; set; } = "";
    public string EscuelaId { get; set; } = "";
    public string Asunto { get; set; } = "";
    public string Cuerpo { get; set; } = "";
    public string Canal { get; set; } = "sistema";
    public string Estado { get; set; } = "borrador";
    public string Plantilla { get; set; } = "";
    public string? RelacionadoCon { get; set; }
    public DateTimeOffset Creado { get; set; }
    public DateTimeOffset? ProgramadoPara { get; set; }
    public DateTimeOffset? Publicado { get; set; }
    public int Version { get; set; } = 1;
    public List<DestinatarioMensajeEntity> Destinatarios { get; set; } = [];
}
public sealed class DestinatarioMensajeEntity
{
    public string MensajeId { get; set; } = "";
    public string UsuarioId { get; set; } = "";
}
public sealed class NotificacionUsuarioEntity
{
    public string Id { get; set; } = "";
    public string UsuarioId { get; set; } = "";
    public string Evento { get; set; } = "";
    public string Tipo { get; set; } = "sistema";
    public string Titulo { get; set; } = "";
    public string Detalle { get; set; } = "";
    public string? Enlace { get; set; }
    public string? MensajeId { get; set; }
    public DateTimeOffset Fecha { get; set; }
    public DateTimeOffset? Leida { get; set; }
}
public sealed class SolicitudCambioEntity
{
    public string Id { get; set; } = "";
    public string EstudianteId { get; set; } = "";
    public string TutorActualId { get; set; } = "";
    public string EscuelaId { get; set; } = "";
    public string SemestreId { get; set; } = "";
    public string Motivo { get; set; } = "";
    public string Estado { get; set; } = "pendiente";
    public string? Respuesta { get; set; }
    public string? ResueltoPor { get; set; }
    public DateTimeOffset Creado { get; set; }
    public DateTimeOffset? Resuelto { get; set; }
    public int Version { get; set; } = 1;
}
public sealed class ActividadPlanEntity
{
    public string Id { get; set; } = "";
    public string EscuelaId { get; set; } = "";
    public string SemestreId { get; set; } = "";
    public string ResponsableId { get; set; } = "";
    public string Problematica { get; set; } = "";
    public string Objetivo { get; set; } = "";
    public string Actividad { get; set; } = "";
    public string Meta { get; set; } = "";
    public string FechaInicio { get; set; } = "";
    public string FechaFin { get; set; } = "";
    public string Evidencia { get; set; } = "";
    public string Aprobacion { get; set; } = "";
    public int Avance { get; set; }
    public string Estado { get; set; } = "planificada";
    public int Version { get; set; } = 1;
}
public sealed class CalendarioDocenteEntity
{
    public string Id { get; set; } = "";
    public string TutorId { get; set; } = "";
    public string EscuelaId { get; set; } = "";
    public string SemestreId { get; set; } = "";
    public string DatosJson { get; set; } = "{}";
    public DateTimeOffset Creado { get; set; }
    public int Version { get; set; } = 1;
}
public sealed class SeguimientoDerivacionEntity
{
    public string Id { get; set; } = "";
    public string? InstrumentoId { get; set; }
    public string EstudianteId { get; set; } = "";
    public string TutorId { get; set; } = "";
    public string EscuelaId { get; set; } = "";
    public string SemestreId { get; set; } = "";
    public string Area { get; set; } = "";
    public string Estado { get; set; } = "registrada";
    public string Prioridad { get; set; } = "media";
    public string ResponsableArea { get; set; } = "";
    public string SiguienteAccion { get; set; } = "";
    public string? RecomendacionComunicable { get; set; }
    public string? VigenciaRecomendacion { get; set; }
    public string? FechaCita { get; set; }
    public DateTimeOffset Actualizado { get; set; }
    public string HistorialJson { get; set; } = "[]";
    public int Version { get; set; } = 1;
}
public sealed class InscripcionCampanaEntity
{
    public string CampanaId { get; set; } = "";
    public string EstudianteId { get; set; } = "";
    public DateTimeOffset Fecha { get; set; }
}
public sealed class ConfiguracionPeriodoEntity
{
    public string PeriodoId { get; set; } = "";
    public string Inicio { get; set; } = "";
    public string Fin { get; set; } = "";
    public string EntrevistasHasta { get; set; } = "";
    public string InformesHasta { get; set; } = "";
    public bool Cerrado { get; set; }
    public int Version { get; set; } = 1;
}
