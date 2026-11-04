using Microsoft.Extensions.Options;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.DTOs;

namespace TutoriaUNAS.Api.Services;

public sealed class SystemStatusService(IOptions<DatabaseOptions> database, IOptions<IdentityOptions> identity, TimeProvider timeProvider, IOptions<CuentasOptions> cuentas) : ISystemStatusService
{
    public SystemStatusDto GetStatus() => new("ok", cuentas.Value.Enabled ? "institutional-accounts" : identity.Value.Enabled ? "server-identity" : "integration-scaffold", database.Value.Enabled, timeProvider.GetUtcNow());
}
