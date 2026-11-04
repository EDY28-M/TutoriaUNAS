using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Services.Accounts;

namespace TutoriaUNAS.Api.Controllers;

[ApiController, Route("api/auth"), RequestSizeLimit(8192)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class VerificacionCuentaController(IOptions<CuentasOptions> options) : ControllerBase
{
    [HttpGet("capacidades")]
    public object Capacidades() => new { registro = options.Value.Enabled, dominios = options.Value.Dominios, passwordMinimo = 15 };
    [HttpPost("codigo"), EnableRateLimiting("account-mail")]
    public Task<CodigoEnCaminoDto> Codigo(SolicitarCodigoInput input, [FromServices] VerificacionCuentaService cuentas, CancellationToken ct) => cuentas.Solicitar(input, ct);
    [HttpPost("codigo/confirmar"), EnableRateLimiting("account-verify")]
    public Task<CodigoValidadoDto> Confirmar(ConfirmarCodigoInput input, [FromServices] VerificacionCuentaService cuentas, CancellationToken ct) => cuentas.Confirmar(input, ct);
    [HttpPost("cuenta/completar"), EnableRateLimiting("account-verify")]
    public Task<CuentaCompletadaDto> Completar(CompletarCuentaInput input, [FromServices] VerificacionCuentaService cuentas, CancellationToken ct) => cuentas.Completar(input, ct);
}
