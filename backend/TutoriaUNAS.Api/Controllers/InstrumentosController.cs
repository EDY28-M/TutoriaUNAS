using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;

namespace TutoriaUNAS.Api.Controllers;

[ApiController]
[Route("api/instrumentos")]
public sealed class InstrumentosController : ControllerBase
{
    /// <summary>Devuelve el formato de entrevista inicial que corresponde al ciclo.</summary>
    [HttpGet("entrevista-inicial/{ciclo:int}")]
    [AllowAnonymous]
    [ProducesResponseType<EntrevistaInicialDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public ActionResult<EntrevistaInicialDto> GetEntrevistaInicial(int ciclo)
    {
        if (!EtapasTutoria.EsCicloValido(ciclo))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Ciclo fuera de rango",
                detail: "El ciclo debe estar entre 1 y 10.");
        }

        return Ok(new EntrevistaInicialDto(ciclo, EtapasTutoria.FormatoEntrevistaInicial(ciclo)));
    }
}
