using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Controllers;

[ApiController]
[Route("api/demo")]
public sealed class DemoController(IDemoOverviewService service, IHostEnvironment environment) : ControllerBase
{
    [HttpGet("overview")]
    [AllowAnonymous]
    [ProducesResponseType<DemoOverviewDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<DemoOverviewDto> GetOverview() => environment.IsDevelopment() ? Ok(service.GetOverview()) : NotFound();
}
