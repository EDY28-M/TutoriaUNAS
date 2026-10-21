using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Controllers;

[ApiController]
[Route("api/status")]
public sealed class SystemController(ISystemStatusService service) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType<SystemStatusDto>(StatusCodes.Status200OK)]
    public ActionResult<SystemStatusDto> Get() => Ok(service.GetStatus());
}
