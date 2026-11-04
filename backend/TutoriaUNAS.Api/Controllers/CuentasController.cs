using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Services.Accounts;

namespace TutoriaUNAS.Api.Controllers;

[ApiController, Route("api/cuentas"), Authorize(Policy = RoleNames.TutoringAccessPolicy), RequestSizeLimit(8192)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class CuentasController(CuentasAdminService cuentas) : ControllerBase
{
    [HttpGet, RequierePermiso("cuentas", "ver")]
    public Task<object[]> Listar(CancellationToken ct) => cuentas.Listar(ct);
    [HttpGet("candidatos"), RequierePermiso("cuentas", "crear")]
    public Task<object[]> Candidatos([FromQuery] string rol = "estudiante", [FromQuery] string buscar = "", CancellationToken ct = default) => cuentas.Candidatos(rol, buscar, ct);
    [HttpPost, RequierePermiso("cuentas", "crear")]
    public Task<CuentaCreadaDto> Crear(CrearCuentaInput input, CancellationToken ct) => cuentas.Crear(input, ct);
    [HttpPost("{id}/temporal"), RequierePermiso("cuentas", "editar")]
    public Task<CuentaCreadaDto> RenovarTemporal(string id, VincularCuentaInput input, CancellationToken ct) => cuentas.RenovarTemporal(id, input.Version, ct);
    [HttpPut("{id}/vinculacion"), RequierePermiso("cuentas", "editar")]
    public async Task<IActionResult> Vincular(string id, VincularCuentaInput input, CancellationToken ct) { await cuentas.Vincular(id, input.Version, ct); return NoContent(); }
    [HttpPut("{id}/estado"), RequierePermiso("cuentas", "editar")]
    public async Task<IActionResult> Estado(string id, AccesoInput input, CancellationToken ct) { await cuentas.Estado(id, input.Version, input.Activo, ct); return NoContent(); }
}
