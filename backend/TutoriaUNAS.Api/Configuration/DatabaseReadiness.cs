using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using TutoriaUNAS.Api.Data;

namespace TutoriaUNAS.Api.Configuration;

public sealed class DatabaseReadiness(IServiceScopeFactory factory, IOptions<DatabaseOptions> options) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        if (!options.Value.Enabled) return HealthCheckResult.Unhealthy("La persistencia no está configurada.");
        try
        {
            await using var scope = factory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
            await db.Periodos.CountAsync(cancellationToken);
            if (!await db.Permisos.AnyAsync(cancellationToken) || await db.Catalogos.CountAsync(c => c.Tipo == "formatos", cancellationToken) != 12) return HealthCheckResult.Unhealthy("Aplica las migraciones del sistema.");
            await db.Notificaciones.Take(1).CountAsync(cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception e) when (e is not OperationCanceledException) { return HealthCheckResult.Unhealthy("La base de datos no está disponible."); }
    }
}
