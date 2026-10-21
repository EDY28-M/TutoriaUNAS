using TutoriaUNAS.Api.DTOs;

namespace TutoriaUNAS.Api.Services;

public sealed class DemoOverviewService : IDemoOverviewService
{
    public DemoOverviewDto GetOverview() => new(true, "Datos ficticios de demostración; no representan registros institucionales.", 3, 2);
}
