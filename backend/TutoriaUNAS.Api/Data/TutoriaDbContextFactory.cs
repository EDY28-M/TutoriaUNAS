using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TutoriaUNAS.Api.Data;

public sealed class TutoriaDbContextFactory : IDesignTimeDbContextFactory<TutoriaDbContext>
{
    public TutoriaDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Tutoria")
            ?? throw new InvalidOperationException("Define ConnectionStrings__Tutoria antes de utilizar las herramientas de EF Core.");
        var options = new DbContextOptionsBuilder<TutoriaDbContext>().UseNpgsql(connectionString).Options;
        return new TutoriaDbContext(options);
    }
}
