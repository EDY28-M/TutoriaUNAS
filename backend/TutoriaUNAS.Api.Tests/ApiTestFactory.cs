using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.EventLog;

namespace TutoriaUNAS.Api.Tests;

public sealed class ApiTestFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureLogging(logging =>
        {
            // Las pruebas de errores no deben depender de permisos para escribir
            // en el registro de eventos de Windows. Los demás proveedores siguen activos.
            if (OperatingSystem.IsWindows())
                logging.AddFilter<EventLogLoggerProvider>(_ => false);
        });
    }
}
