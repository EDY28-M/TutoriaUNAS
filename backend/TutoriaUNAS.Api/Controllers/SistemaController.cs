using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Controllers;

[ApiController, Route("api/sistema"), Authorize(Policy = RoleNames.TutoringAccessPolicy), RequestSizeLimit(256000)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SistemaController(SistemaService sistema, ComunicacionService comunicacion, GestionSistemaService gestion, CalendarioService calendario, AgendaService agenda) : ControllerBase
{
    [HttpPut("perfil"), RequierePermiso("perfil", "editar")]
    public Task<PerfilContactoDto> Contacto(ContactoInput r, CancellationToken ct) => sistema.Contacto(r, ct);
    [HttpPut("preferencias"), RequierePermiso("preferencias", "editar")]
    public async Task<IActionResult> Preferencias(PreferenciasInput r, CancellationToken ct) { await sistema.Preferencias(r, ct); return NoContent(); }
    [HttpPut("notificaciones/lectura"), RequierePermiso("comunicacion", "editar")]
    public async Task<IActionResult> Lectura(LecturaInput r, CancellationToken ct) { await sistema.Lectura(r, ct); return NoContent(); }
    [HttpPost("mensajes"), RequierePermiso("comunicacion", "crear")]
    public async Task<IActionResult> CrearMensaje(MensajeInput r, CancellationToken ct) => Ok(new { id = await comunicacion.Guardar(null, r, ct) });
    [HttpPut("mensajes/{id}"), RequierePermiso("comunicacion", "crear")]
    public async Task<IActionResult> EditarMensaje(string id, MensajeInput r, CancellationToken ct) => Ok(new { id = await comunicacion.Guardar(id, r, ct) });
    [HttpDelete("mensajes/{id}"), RequierePermiso("comunicacion", "eliminar")]
    public async Task<IActionResult> EliminarMensaje(string id, [FromQuery] int version, CancellationToken ct) { await comunicacion.Eliminar(id, version, ct); return NoContent(); }
    [HttpPost("solicitudes-cambio"), RequierePermiso("solicitudes", "crear")]
    public async Task<IActionResult> Solicitud(SolicitudCambioInput r, CancellationToken ct) { await gestion.SolicitarCambio(r, ct); return NoContent(); }
    [HttpPut("solicitudes-cambio/{id}"), RequierePermiso("solicitudes", "editar")]
    public async Task<IActionResult> Resolver(string id, ResolverSolicitudInput r, CancellationToken ct) { await gestion.ResolverCambio(id, r, ct); return NoContent(); }
    [HttpPut("cuentas/{id}"), RequierePermiso("cuentas", "editar")]
    public async Task<IActionResult> Cuenta(string id, AccesoInput r, CancellationToken ct) { await sistema.Acceso(id, r, ct); return NoContent(); }
    [HttpPut("periodo"), RequierePermiso("periodos", "editar")]
    public async Task<IActionResult> Periodo(PeriodoInput r, CancellationToken ct) { await sistema.Periodo(r, ct); return NoContent(); }
    [HttpPost("plan"), RequierePermiso("planes", "crear")]
    public async Task<IActionResult> CrearActividad(ActividadInput r, CancellationToken ct) => Ok(new { id = await gestion.Actividad(null, r, ct) });
    [HttpPut("plan/{id}"), RequierePermiso("planes", "editar")]
    public async Task<IActionResult> EditarActividad(string id, ActividadInput r, CancellationToken ct) => Ok(new { id = await gestion.Actividad(id, r, ct) });
    [HttpDelete("plan/{id}"), RequierePermiso("planes", "eliminar")]
    public async Task<IActionResult> EliminarActividad(string id, [FromQuery] int version, CancellationToken ct) { await gestion.EliminarActividad(id, version, ct); return NoContent(); }
    [HttpPut("derivaciones/{id}"), RequierePermiso("seguimiento", "editar")]
    public async Task<IActionResult> Seguimiento(string id, SeguimientoInput r, CancellationToken ct) { await gestion.Seguimiento(id, r, ct); return NoContent(); }
    [HttpPut("insumos/{id}"), RequierePermiso("integraciones", "editar")]
    public async Task<IActionResult> Insumo(string id, InsumoInput r, CancellationToken ct) { await sistema.Insumo(id, r, ct); return NoContent(); }
    [HttpPut("sesiones/{id}/estado"), RequierePermiso("sesiones", "editar")]
    public Task<object> Sesion(string id, EstadoSesionInput r, CancellationToken ct) => agenda.CambiarEstado(id, r, ct);
    [HttpGet("calendario"), RequierePermiso("calendario", "ver")]
    public Task<System.Text.Json.JsonElement[]> Calendario(CancellationToken ct) => calendario.Listar(ct);
    [HttpPost("calendario"), RequierePermiso("calendario", "crear")]
    public Task<System.Text.Json.JsonElement> CrearHorario(CalendarioInput r, CancellationToken ct) => calendario.Guardar(null, r, ct);
    [HttpPut("calendario/{id}"), RequierePermiso("calendario", "editar")]
    public Task<System.Text.Json.JsonElement> EditarHorario(string id, CalendarioInput r, CancellationToken ct) => calendario.Guardar(id, r, ct);
    [HttpDelete("calendario/{id}"), RequierePermiso("calendario", "eliminar")]
    public async Task<IActionResult> EliminarHorario(string id, [FromQuery] int version, CancellationToken ct) { await calendario.Eliminar(id, version, ct); return NoContent(); }
    [HttpPost("campanas/{id}/inscripcion"), RequierePermiso("campanas", "crear")]
    public async Task<IActionResult> Inscribir(string id, CancellationToken ct) { await gestion.Inscribir(id, true, ct); return NoContent(); }
    [HttpDelete("campanas/{id}/inscripcion"), RequierePermiso("campanas", "eliminar")]
    public async Task<IActionResult> CancelarInscripcion(string id, CancellationToken ct) { await gestion.Inscribir(id, false, ct); return NoContent(); }
}
