using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Controllers;

[ApiController, Route("api"), Authorize(Policy = RoleNames.TutoringAccessPolicy), RequestSizeLimit(256_000)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TutoriaController(EstadoTutoriaService estado, AgendaService agenda, DocumentosService documentos, TutoriaContext context, TutoriaDbContext db) : ControllerBase
{
    [HttpGet("tutoria/estado")]
    [RequierePermiso("portal", "ver")]
    public Task<EstadoTutoriaDto> Estado(CancellationToken ct) => estado.Obtener(ct);
    [HttpPost("sesiones")]
    [RequierePermiso("sesiones", "crear")]
    public Task<SesionDto> Programar(ProgramarSesionDto input, CancellationToken ct) => agenda.Programar(input, ct);
    [HttpPut("sesiones/{id}/asistencia")]
    [RequierePermiso("sesiones", "editar")]
    public Task<SesionDto> Asistencia(string id, RegistrarAsistenciaDto input, CancellationToken ct) => agenda.Asistencia(id, input, ct);
    [HttpPost("formularios")]
    [RequierePermiso("formularios", "crear")]
    public Task<InstrumentoDto> Crear(CrearInstrumentoDto input, CancellationToken ct) => documentos.Crear(input, ct);
    [HttpGet("formularios/{id}")]
    [RequierePermiso("formularios", "ver")]
    public Task<InstrumentoDto> Leer(string id, CancellationToken ct) => documentos.Leer(id, ct);
    [HttpPut("formularios/{id}")]
    [RequierePermiso("formularios", "editar")]
    public Task<InstrumentoDto> Guardar(string id, GuardarInstrumentoDto input, CancellationToken ct) => documentos.Guardar(id, input, ct);
    [HttpDelete("formularios/{id}"), RequierePermiso("formularios", "eliminar")]
    public async Task<IActionResult> Eliminar(string id, [FromQuery] int version, CancellationToken ct) { await documentos.Eliminar(id, version, ct); return NoContent(); }
    [HttpPost("formularios/{id}/revision")]
    [RequierePermiso("formularios", "revisar")]
    public Task<InstrumentoDto> Revisar(string id, RevisarInstrumentoDto input, CancellationToken ct) => documentos.Revisar(id, input, ct);
    [HttpPut("tutoria/periodo")]
    [RequierePermiso("periodos", "editar")]
    public async Task<IActionResult> Momento(CambiarMomentoDto input, CancellationToken ct) { await estado.CambiarMomento(input, ct); return NoContent(); }
    [HttpPost("tutoria/asignaciones")]
    [RequierePermiso("asignaciones", "editar")]
    public async Task<IActionResult> Asignar(AsignarTutorDto input, CancellationToken ct) { await estado.Asignar(input, ct); return NoContent(); }
    [HttpGet("tutoria/auditoria")]
    [RequierePermiso("auditoria", "ver")]
    public async Task<IActionResult> Auditoria(CancellationToken ct)
    {
        var actor = await context.Actor(ct);
        Domain.TutoriaError.Exigir(actor.Rol == "coordinacion", "Solo coordinación consulta la auditoría.", 403);
        var registros = await db.Auditoria.AsNoTracking().Where(a => a.EscuelaId == actor.EscuelaId)
            .OrderByDescending(a => a.Id).Take(200).ToArrayAsync(ct);
        var ids = registros.Select(a => a.UsuarioId).Distinct().ToArray();
        var cuentas = await (from usuario in db.Usuarios.AsNoTracking()
            join persona in db.Personas.AsNoTracking() on usuario.PersonaId equals persona.Id
            where ids.Contains(usuario.Id) && usuario.EscuelaId == actor.EscuelaId && persona.EscuelaId == actor.EscuelaId
            select new { usuario.Id, usuario.Identificador, usuario.Rol, persona.DatosJson })
            .ToDictionaryAsync(u => u.Id, ct);
        return Ok(registros.Select(registro =>
        {
            var cuenta = cuentas.GetValueOrDefault(registro.UsuarioId);
            return new
            {
                registro.Id, registro.Fecha, registro.UsuarioId, registro.EscuelaId,
                registro.Accion, registro.RecursoId, registro.Version, registro.Dispositivo,
                identificador = cuenta?.Identificador,
                rol = cuenta?.Rol,
                nombre = cuenta is null ? null : $"{JsonDatos.Texto(cuenta.DatosJson, "nombres")} {JsonDatos.Texto(cuenta.DatosJson, "apellidos")}".Trim(),
            };
        }));
    }
}
