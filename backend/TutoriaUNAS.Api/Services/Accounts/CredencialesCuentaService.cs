using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Domain;
using TutoriaUNAS.Api.DTOs;
using TutoriaUNAS.Api.Entities;

namespace TutoriaUNAS.Api.Services.Accounts;

public sealed record DecisionAcceso(UsuarioEntity? Usuario = null, ActivacionRequeridaDto? Activacion = null, bool PendienteVinculacion = false);

public sealed class CredencialesCuentaService(TutoriaDbContext db, IPasswordHasher<CredencialCuentaEntity> hasher,
    TimeProvider clock, IOptions<CuentasOptions> options, ColaCorreoCuenta cola)
{
    private static readonly Lazy<string> DummyHash = new(() => new PasswordHasher<CredencialCuentaEntity>(Options.Create(new PasswordHasherOptions { IterationCount = 210000 })).HashPassword(new(), SeguridadCuenta.Aleatorio()));
    public void ExigirDisponible() => TutoriaError.Exigir(options.Value.Enabled, "El servicio de cuentas institucionales no está habilitado.", 503);
    public async Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> Bloquear(string correo, CancellationToken ct)
    {
        var tx = await db.Database.BeginTransactionAsync(ct);
        try { await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"cuenta:" + correo}, 0))", ct); return tx; }
        catch { await tx.DisposeAsync(); throw; }
    }
    public bool PasswordValida(CredencialCuentaEntity c, string password) => hasher.VerifyHashedPassword(c, c.PasswordHash, password) != PasswordVerificationResult.Failed;
    public void CambiarPassword(CredencialCuentaEntity c, string password) => c.PasswordHash = hasher.HashPassword(c, password);
    public UsuarioEntity Crear(PersonaEntity persona, string correo, string rol, string password, bool temporal)
    {
        var id = "CTA-" + Guid.NewGuid().ToString("N");
        var usuario = new UsuarioEntity { Id = id, Subject = id, Issuer = SeguridadCuenta.Issuer, Rol = rol, PersonaId = persona.Id,
            EscuelaId = persona.EscuelaId, Identificador = correo, Activo = persona.EscuelaId.Length > 0 };
        var credencial = new CredencialCuentaEntity { UsuarioId = id, CorreoNormalizado = correo, Rol = rol, CambioObligatorio = temporal,
            Verificada = !temporal, TemporalHasta = temporal ? clock.GetUtcNow().AddHours(48) : null, Creada = clock.GetUtcNow() };
        CambiarPassword(credencial, password); db.Usuarios.Add(usuario); db.CredencialesCuenta.Add(credencial);
        return usuario;
    }
    public async Task<DecisionAcceso?> IntentarLogin(LoginLocalDto input, OrigenAcceso origen, CancellationToken ct)
    {
        if (!options.Value.Enabled) return null;
        TutoriaError.Exigir(input.Identifier.Length <= 254 && input.Password.Length <= 128 &&
            input.Role is null or "estudiante" or "tutor" or "coordinacion", "Datos de acceso incorrectos.", 401);
        var identifier = input.Identifier.Trim().ToLowerInvariant();
        var correos = await (from c in db.CredencialesCuenta.AsNoTracking() join u in db.Usuarios on c.UsuarioId equals u.Id
            where (input.Role == null || c.Rol == input.Role) && (c.CorreoNormalizado == identifier || u.Identificador == identifier)
            select c.CorreoNormalizado).Distinct().Take(2).ToArrayAsync(ct);
        if (correos.Length == 0) { _ = hasher.VerifyHashedPassword(new(), DummyHash.Value, input.Password); return null; }
        TutoriaError.Exigir(correos.Length == 1, "Ingresa tu correo institucional para continuar.", 401);
        var email = correos[0];
        await using var tx = await Bloquear(email, ct);
        var credenciales = await db.CredencialesCuenta.Where(c => c.CorreoNormalizado == email &&
            (input.Role == null || c.Rol == input.Role)).ToArrayAsync(ct);
        var ahora = clock.GetUtcNow();
        var coincidencias = credenciales.Where(c => PasswordValida(c, input.Password)).ToArray();
        TutoriaError.Exigir(coincidencias.Length <= 1,
            "Esta contraseña coincide con más de un perfil. Recupera la clave de uno de ellos y elige una diferente.", 409);
        if (coincidencias.Length == 0)
        {
            foreach (var candidata in credenciales.Where(c => c.BloqueadaHasta is null || c.BloqueadaHasta <= ahora))
            {
                candidata.IntentosFallidos++;
                if (candidata.IntentosFallidos < 5) continue;
                candidata.BloqueadaHasta = ahora.AddMinutes(15);
                candidata.IntentosFallidos = 0;
            }
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
            throw new TutoriaError(401, "Datos de acceso incorrectos.");
        }
        var cred = coincidencias[0];
        if (cred.BloqueadaHasta > ahora) throw new TutoriaError(401, "Datos de acceso incorrectos o acceso temporalmente limitado.");
        var user = await db.Usuarios.SingleAsync(u => u.Id == cred.UsuarioId, ct);
        var persona = await db.Personas.SingleAsync(p => p.Id == user.PersonaId, ct);
        TutoriaError.Exigir(persona.Activa && (user.Activo || (user.EscuelaId == "" && cred.Verificada)), "La cuenta no está habilitada.", 403);
        cred.IntentosFallidos = 0; cred.BloqueadaHasta = null;
        DecisionAcceso decision;
        if (cred.CambioObligatorio || !cred.Verificada)
        {
            TutoriaError.Exigir(cred.TemporalHasta > ahora, "La contraseña temporal venció. Solicita una nueva a coordinación.", 409);
            await cola.CancelarRetos(email, "activacion", ahora, ct);
            var prueba = SeguridadCuenta.Aleatorio();
            db.RetosCorreo.Add(new() { Id = SeguridadCuenta.Aleatorio(), Correo = email, Rol = user.Rol, Proposito = "activacion",
                UsuarioId = user.Id, PersonaId = user.PersonaId, VersionUsuario = user.Version, PruebaHash = SeguridadCuenta.Hash(prueba), Creado = ahora, Expira = ahora.AddMinutes(15) });
            decision = new(Activacion: new(true, prueba, email, 900, user.Rol));
        }
        else if (user.EscuelaId.Length == 0) decision = new(PendienteVinculacion: true);
        else decision = new(Usuario: user);
        var accion = decision.Activacion is not null ? "iniciar-activacion" :
            decision.PendienteVinculacion ? "acceso-pendiente-vinculacion" : "iniciar-sesion";
        db.Auditoria.Add(origen.Registrar(user, ahora, accion));
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return decision;
    }
}
