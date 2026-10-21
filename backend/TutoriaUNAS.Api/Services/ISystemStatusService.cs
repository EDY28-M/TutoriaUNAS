using TutoriaUNAS.Api.DTOs;

namespace TutoriaUNAS.Api.Services;

public interface ISystemStatusService
{
    SystemStatusDto GetStatus();
}
