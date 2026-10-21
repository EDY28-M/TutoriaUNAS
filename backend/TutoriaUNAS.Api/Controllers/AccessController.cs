using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.DTOs;

namespace TutoriaUNAS.Api.Controllers;

[ApiController]
[Route("api/access")]
[Authorize(Policy = RoleNames.TutoringAccessPolicy)]
public sealed class AccessController : ControllerBase
{
    [HttpGet("me")]
    [ProducesResponseType<CurrentIdentityDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public ActionResult<CurrentIdentityDto> GetIdentity()
    {
        var subject = User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(subject)) return Forbid();
        var roles = User.FindAll("role").Select(claim => claim.Value).ToArray();
        return Ok(new CurrentIdentityDto(subject, roles));
    }
}
