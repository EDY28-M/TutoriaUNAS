using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace TutoriaUNAS.Api.Data;

/// <summary>Migraciones SQL versionadas, con checksum y exclusión entre instancias.</summary>
public static class SchemaRunner
{
    private static string Hash(string sql) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sql)));
    public static async Task Apply(TutoriaDbContext db, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(20261028)", ct);
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE IF NOT EXISTS \"__TutoriaMigrations\" (\"Id\" text PRIMARY KEY, \"Sha256\" text NOT NULL)", ct);
        var assembly = typeof(SchemaRunner).Assembly;
        foreach (var resource in assembly.GetManifestResourceNames().Where(n => n.EndsWith(".sql", StringComparison.Ordinal)).Order(StringComparer.Ordinal))
        {
            using var stream = assembly.GetManifestResourceStream(resource)!;
            using var reader = new StreamReader(stream);
            // Git puede cambiar LF/CRLF entre Windows y el servidor de despliegue.
            var sql = (await reader.ReadToEndAsync(ct)).Replace("\r\n", "\n", StringComparison.Ordinal);
            var hash = Hash(sql);
            var applied = await db.Database.SqlQueryRaw<string>("SELECT \"Sha256\" AS \"Value\" FROM \"__TutoriaMigrations\" WHERE \"Id\" = {0}", resource).SingleOrDefaultAsync(ct);
            if (applied is not null)
            {
                if (applied != hash)
                {
                    if (applied != Hash(sql.Replace("\n", "\r\n", StringComparison.Ordinal))) throw new InvalidOperationException("Una migración aplicada fue modificada. Crea otra versión SQL.");
                    await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"__TutoriaMigrations\" SET \"Sha256\" = {hash} WHERE \"Id\" = {resource}", ct);
                }
                continue;
            }
            // Un script versionado es SQL literal: no es una plantilla de String.Format.
            // Así los literales JSON con llaves no se interpretan como parámetros.
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.Transaction = tx.GetDbTransaction();
            command.CommandText = sql;
            command.CommandTimeout = 60;
            await command.ExecuteNonQueryAsync(ct);
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"__TutoriaMigrations\" (\"Id\", \"Sha256\") VALUES ({resource}, {hash})", ct);
        }
        await tx.CommitAsync(ct);
    }
}
