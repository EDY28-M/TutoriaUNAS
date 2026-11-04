using Microsoft.EntityFrameworkCore;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Data;

public sealed class TutoriaDbContext(DbContextOptions<TutoriaDbContext> options) : DbContext(options)
{
    public DbSet<PersonaEntity> Personas => Set<PersonaEntity>();
    public DbSet<CredencialCuentaEntity> CredencialesCuenta => Set<CredencialCuentaEntity>();
    public DbSet<RetoCorreoEntity> RetosCorreo => Set<RetoCorreoEntity>();
    public DbSet<CorreoCuentaEntity> CorreosCuenta => Set<CorreoCuentaEntity>();
    public DbSet<UsuarioEntity> Usuarios => Set<UsuarioEntity>();
    public DbSet<PeriodoEntity> Periodos => Set<PeriodoEntity>();
    public DbSet<AsignacionEntity> Asignaciones => Set<AsignacionEntity>();
    public DbSet<HorarioAcademicoEntity> Horarios => Set<HorarioAcademicoEntity>();
    public DbSet<MatriculaEntity> Matriculas => Set<MatriculaEntity>();
    public DbSet<SesionEntity> Sesiones => Set<SesionEntity>();
    public DbSet<AsistenciaEntity> Asistencias => Set<AsistenciaEntity>();
    public DbSet<InstrumentoEntity> Instrumentos => Set<InstrumentoEntity>();
    public DbSet<ExpedienteDatoEntity> Expediente => Set<ExpedienteDatoEntity>();
    public DbSet<AuditoriaEntity> Auditoria => Set<AuditoriaEntity>();
    public DbSet<CatalogoEntity> Catalogos => Set<CatalogoEntity>();
    public DbSet<RegistroFuenteEntity> Fuentes => Set<RegistroFuenteEntity>();
    public DbSet<ContactoEntity> Contactos => Set<ContactoEntity>();
    public DbSet<PreferenciaUsuarioEntity> Preferencias => Set<PreferenciaUsuarioEntity>();
    public DbSet<PermisoAccesoEntity> Permisos => Set<PermisoAccesoEntity>();
    public DbSet<MensajeEntity> Mensajes => Set<MensajeEntity>();
    public DbSet<DestinatarioMensajeEntity> Destinatarios => Set<DestinatarioMensajeEntity>();
    public DbSet<NotificacionUsuarioEntity> Notificaciones => Set<NotificacionUsuarioEntity>();
    public DbSet<SolicitudCambioEntity> SolicitudesCambio => Set<SolicitudCambioEntity>();
    public DbSet<ActividadPlanEntity> ActividadesPlan => Set<ActividadPlanEntity>();
    public DbSet<CalendarioDocenteEntity> CalendarioDocente => Set<CalendarioDocenteEntity>();
    public DbSet<SeguimientoDerivacionEntity> Seguimientos => Set<SeguimientoDerivacionEntity>();
    public DbSet<InscripcionCampanaEntity> Inscripciones => Set<InscripcionCampanaEntity>();
    public DbSet<ConfiguracionPeriodoEntity> ConfiguracionPeriodos => Set<ConfiguracionPeriodoEntity>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<CredencialCuentaEntity>().ToTable("CredencialesCuenta").HasKey(e => e.UsuarioId);
        model.Entity<CredencialCuentaEntity>().HasIndex(e => new { e.CorreoNormalizado, e.Rol }).IsUnique();
        model.Entity<CredencialCuentaEntity>().HasOne<UsuarioEntity>().WithMany().HasForeignKey(e => e.UsuarioId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<RetoCorreoEntity>().ToTable("RetosCorreo").HasKey(e => e.Id);
        model.Entity<RetoCorreoEntity>().HasOne<UsuarioEntity>().WithMany().HasForeignKey(e => e.UsuarioId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<RetoCorreoEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.PersonaId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<CorreoCuentaEntity>().ToTable("CorreosCuenta").HasKey(e => e.Id);
        model.Entity<CorreoCuentaEntity>().HasOne<UsuarioEntity>().WithMany().HasForeignKey(e => e.UsuarioId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<CorreoCuentaEntity>().HasOne<RetoCorreoEntity>().WithMany().HasForeignKey(e => e.RetoId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<PersonaEntity>().ToTable("Personas").HasKey(e => e.Id);
        model.Entity<UsuarioEntity>().ToTable("Usuarios").HasKey(e => e.Id);
        model.Entity<UsuarioEntity>().HasIndex(e => new { e.Issuer, e.Subject }).IsUnique();
        model.Entity<UsuarioEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.PersonaId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<PeriodoEntity>().ToTable("Periodos").HasKey(e => e.Id);
        model.Entity<PeriodoEntity>().HasIndex(e => new { e.EscuelaId, e.SemestreId }).IsUnique();
        model.Entity<PeriodoEntity>().HasIndex(e => e.EscuelaId).IsUnique().HasFilter("\"Activo\" = TRUE");
        model.Entity<AsignacionEntity>().ToTable("Asignaciones").HasKey(e => e.Id);
        model.Entity<AsignacionEntity>().HasIndex(e => new { e.EstudianteId, e.SemestreId }).IsUnique().HasFilter("\"Activa\" = TRUE");
        model.Entity<AsignacionEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.EstudianteId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<AsignacionEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.TutorId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<HorarioAcademicoEntity>().ToTable("Horarios").HasKey(e => e.Id);
        model.Entity<HorarioAcademicoEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.EstudianteId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<MatriculaEntity>().ToTable("Matriculas").HasKey(e => e.Id);
        model.Entity<MatriculaEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.EstudianteId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<SesionEntity>().ToTable("Sesiones").HasKey(e => e.Id);
        model.Entity<SesionEntity>().HasIndex(e => new { e.TutorId, e.Fecha });
        model.Entity<SesionEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.TutorId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<SesionEntity>().HasMany(e => e.Asistentes).WithOne().HasForeignKey(e => e.SesionId).OnDelete(DeleteBehavior.Cascade);
        model.Entity<AsistenciaEntity>().ToTable("Asistencias").HasKey(e => new { e.SesionId, e.EstudianteId });
        model.Entity<AsistenciaEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.EstudianteId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<InstrumentoEntity>().ToTable("Instrumentos").HasKey(e => e.Id);
        model.Entity<InstrumentoEntity>().HasIndex(e => new { e.SesionId, e.EstudianteId, e.Formato }).IsUnique().HasFilter("\"SesionId\" IS NOT NULL");
        model.Entity<InstrumentoEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.TutorId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<InstrumentoEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.EstudianteId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<InstrumentoEntity>().HasOne<SesionEntity>().WithMany().HasForeignKey(e => e.SesionId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<ExpedienteDatoEntity>().ToTable("Expediente").HasKey(e => new { e.EstudianteId, e.Periodo, e.Campo });
        model.Entity<ExpedienteDatoEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.EstudianteId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<AuditoriaEntity>().ToTable("Auditoria").HasKey(e => e.Id);
        model.Entity<CatalogoEntity>().ToTable("Catalogos").HasKey(e => new { e.Tipo, e.Id });
        model.Entity<RegistroFuenteEntity>().ToTable("Fuentes").HasKey(e => new { e.Tipo, e.Id });
        model.Entity<RegistroFuenteEntity>().HasIndex(e => new { e.EscuelaId, e.EstudianteId, e.Tipo });
        model.Entity<ContactoEntity>().ToTable("Contactos").HasKey(e => e.PersonaId);
        model.Entity<ContactoEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.PersonaId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<PreferenciaUsuarioEntity>().ToTable("Preferencias").HasKey(e => e.UsuarioId);
        model.Entity<PreferenciaUsuarioEntity>().HasOne<UsuarioEntity>().WithMany().HasForeignKey(e => e.UsuarioId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<PermisoAccesoEntity>().ToTable("Permisos").HasKey(e => new { e.Rol, e.Recurso });
        model.Entity<MensajeEntity>().ToTable("Mensajes").HasKey(e => e.Id);
        model.Entity<MensajeEntity>().HasOne<UsuarioEntity>().WithMany().HasForeignKey(e => e.EmisorId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<MensajeEntity>().HasMany(e => e.Destinatarios).WithOne().HasForeignKey(e => e.MensajeId).OnDelete(DeleteBehavior.Cascade);
        model.Entity<MensajeEntity>().HasIndex(e => new { e.Estado, e.ProgramadoPara });
        model.Entity<DestinatarioMensajeEntity>().ToTable("Destinatarios").HasKey(e => new { e.MensajeId, e.UsuarioId });
        model.Entity<DestinatarioMensajeEntity>().HasOne<UsuarioEntity>().WithMany().HasForeignKey(e => e.UsuarioId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<NotificacionUsuarioEntity>().ToTable("Notificaciones").HasKey(e => e.Id);
        model.Entity<NotificacionUsuarioEntity>().HasOne<UsuarioEntity>().WithMany().HasForeignKey(e => e.UsuarioId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<NotificacionUsuarioEntity>().HasIndex(e => new { e.Evento, e.UsuarioId }).IsUnique();
        model.Entity<NotificacionUsuarioEntity>().HasIndex(e => new { e.UsuarioId, e.Fecha });
        model.Entity<SolicitudCambioEntity>().ToTable("SolicitudesCambio").HasKey(e => e.Id);
        model.Entity<SolicitudCambioEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.EstudianteId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<SolicitudCambioEntity>().HasIndex(e => new { e.EstudianteId, e.SemestreId }).IsUnique().HasFilter("\"Estado\" = 'pendiente'");
        model.Entity<ActividadPlanEntity>().ToTable("ActividadesPlan").HasKey(e => e.Id);
        model.Entity<ActividadPlanEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.ResponsableId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<CalendarioDocenteEntity>().ToTable("CalendarioDocente").HasKey(e => e.Id);
        model.Entity<CalendarioDocenteEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.TutorId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<SeguimientoDerivacionEntity>().ToTable("Seguimientos").HasKey(e => e.Id);
        model.Entity<SeguimientoDerivacionEntity>().HasOne<InstrumentoEntity>().WithMany().HasForeignKey(e => e.InstrumentoId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<SeguimientoDerivacionEntity>().HasIndex(e => e.InstrumentoId).IsUnique();
        model.Entity<InscripcionCampanaEntity>().ToTable("InscripcionesCampana").HasKey(e => new { e.CampanaId, e.EstudianteId });
        model.Entity<InscripcionCampanaEntity>().HasOne<PersonaEntity>().WithMany().HasForeignKey(e => e.EstudianteId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<ConfiguracionPeriodoEntity>().ToTable("ConfiguracionPeriodos").HasKey(e => e.PeriodoId);
        model.Entity<ConfiguracionPeriodoEntity>().HasOne<PeriodoEntity>().WithMany().HasForeignKey(e => e.PeriodoId).OnDelete(DeleteBehavior.Restrict);
        foreach (var entity in model.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                if (property.ClrType == typeof(string) && property.Name.EndsWith("Json", StringComparison.Ordinal)) property.SetColumnType("jsonb");
            }
            var version = entity.FindProperty("Version");
            if (version is not null) version.IsConcurrencyToken = true;
        }
    }
}
