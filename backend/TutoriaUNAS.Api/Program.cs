using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging.EventLog;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Services;
using CorsSettings = TutoriaUNAS.Api.Configuration.CorsOptions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using IdentityOptions = TutoriaUNAS.Api.Configuration.IdentityOptions;
using TutoriaUNAS.Api.Entities;
using TutoriaUNAS.Api.Services.Accounts;

if (args.Contains("--schema-script", StringComparer.Ordinal))
{
    using var db = new TutoriaDbContext(new DbContextOptionsBuilder<TutoriaDbContext>().UseNpgsql("Host=127.0.0.1;Database=schema").Options);
    Console.Write(db.Database.GenerateCreateScript());
    return;
}
var builder = WebApplication.CreateBuilder(args);
// El desarrollo local no requiere permisos sobre el registro de eventos de Windows.
// Consola y los demás proveedores conservan sus mensajes y errores.
if (builder.Environment.IsDevelopment() && OperatingSystem.IsWindows())
    builder.Logging.AddFilter<EventLogLoggerProvider>(_ => false);
var localConfig = Environment.GetEnvironmentVariable("TUTORIA_LOCAL_CONFIG");
if (builder.Environment.IsDevelopment() && !string.IsNullOrEmpty(localConfig)) builder.Configuration.AddJsonFile(localConfig, optional: false);
var localAuth = builder.Configuration.GetValue<bool>("LocalDevelopment:Enabled");
var cuentas = builder.Configuration.GetSection("Cuentas").Get<CuentasOptions>() ?? new();
builder.Services.AddOptions<CuentasOptions>().BindConfiguration("Cuentas").Validate(o => o.Valida(), "Configura los dominios, la clave de códigos y la URL de acceso de cuentas.").ValidateOnStart();
builder.Services.AddOptions<SmtpCuentaOptions>().BindConfiguration("SmtpCuentas");
if (cuentas.Enabled)
{
    var protection = builder.Services.AddDataProtection().SetApplicationName("TutoriaUNAS.Accounts.v1");
    if (cuentas.KeyRingPath.Length > 0) protection.PersistKeysToFileSystem(new DirectoryInfo(cuentas.KeyRingPath));
    if (OperatingSystem.IsWindows()) protection.ProtectKeysWithDpapi();
}
builder.Services.Configure<PasswordHasherOptions>(o => o.IterationCount = 210000);
builder.Services.AddSingleton<IPasswordHasher<CredencialCuentaEntity>, PasswordHasher<CredencialCuentaEntity>>();
builder.Services.AddScoped<SeguridadCuenta>();
builder.Services.AddScoped<CredencialesCuentaService>();
builder.Services.AddScoped<VerificacionCuentaService>();
builder.Services.AddScoped<CuentasAdminService>();
builder.Services.AddScoped<ColaCorreoCuenta>();
builder.Services.AddScoped<ICorreoCuentaSender, SmtpCuentaSender>();
if (localAuth && (!builder.Environment.IsDevelopment() || builder.Configuration.GetValue<bool>("Authentication:Enabled"))) throw new InvalidOperationException("El acceso ficticio solo se permite en Development y separado del proveedor institucional.");
builder.Services.AddControllers(options => options.Filters.Add<PermisoTutoriaFilter>());
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddHealthChecks().AddCheck<DatabaseReadiness>("postgresql", tags: ["ready"]);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<ISystemStatusService, SystemStatusService>();
builder.Services.AddScoped<IDemoOverviewService, DemoOverviewService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CatalogoFormatos>();
builder.Services.AddScoped<TutoriaContext>();
builder.Services.AddScoped<EstadoTutoriaService>();
builder.Services.AddScoped<DocumentosService>();
builder.Services.AddScoped<AgendaService>();
builder.Services.AddScoped<SistemaService>();
builder.Services.AddScoped<ComunicacionService>();
builder.Services.AddScoped<GestionSistemaService>();
builder.Services.AddScoped<CalendarioService>();
builder.Services.AddRateLimiter(options => {
    options.RejectionStatusCode = 429;
    options.AddPolicy("local-login", http => RateLimitPartition.GetFixedWindowLimiter(http.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.AddPolicy("account-mail", http => RateLimitPartition.GetFixedWindowLimiter(http.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions { PermitLimit = cuentas.IpCodigosPorMinuto, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.AddPolicy("account-verify", http => RateLimitPartition.GetFixedWindowLimiter(http.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions { PermitLimit = cuentas.IpVerificacionesPorMinuto, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddOptions<DatabaseOptions>().BindConfiguration(DatabaseOptions.SectionName).ValidateOnStart();
builder.Services.AddOptions<IdentityOptions>().BindConfiguration(IdentityOptions.SectionName)
    .Validate(options => options.IsValid(), "La autenticación requiere una Authority HTTPS y un Audience.").ValidateOnStart();
builder.Services.AddOptions<CorsSettings>().BindConfiguration(CorsSettings.SectionName)
    .Validate(options => options.IsValid(), "CORS requiere orígenes explícitos válidos, sin comodines ni rutas.").ValidateOnStart();

var database = builder.Configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>() ?? new();
if (database.Enabled && !builder.Configuration.GetValue<bool>("Tutoria:DisableDispatcher")) builder.Services.AddHostedService<PublicadorAvisos>();
if (database.Enabled && cuentas.Enabled && !cuentas.DisableDispatcher) builder.Services.AddHostedService<DespachadorCorreoCuenta>();
if (database.Enabled)
{
    var connectionString = builder.Configuration.GetConnectionString("Tutoria");
    if (string.IsNullOrWhiteSpace(connectionString)) throw new InvalidOperationException("Define ConnectionStrings__Tutoria al habilitar PostgreSQL.");
    builder.Services.AddDbContext<TutoriaDbContext>(options => options.UseNpgsql(connectionString));
}
else builder.Services.AddScoped<TutoriaDbContext>(_ => throw new TutoriaUNAS.Api.Domain.TutoriaError(503, "La persistencia institucional no está configurada."));

builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
{
    var cors = builder.Configuration.GetSection(CorsSettings.SectionName).Get<CorsSettings>() ?? new();
    policy.WithOrigins(cors.AllowedOrigins).WithMethods("GET", "POST", "PUT", "DELETE").WithHeaders("Content-Type", "Authorization");
}));

builder.Services.AddAuthentication(localAuth ? "LocalDevelopment" : cuentas.Enabled ? SeguridadCuenta.Scheme : JwtBearerDefaults.AuthenticationScheme).AddJwtBearer().AddBearerToken("LocalDevelopment", options => { options.BearerTokenExpiration = TimeSpan.FromHours(8); })
    .AddBearerToken(SeguridadCuenta.Scheme, options => { options.BearerTokenExpiration = TimeSpan.FromHours(8); });
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme).Configure<IOptions<IdentityOptions>>((options, identity) =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters.RoleClaimType = "role";
    options.TokenValidationParameters.NameClaimType = "sub";
    options.TokenValidationParameters.ValidateIssuer = true;
    options.TokenValidationParameters.ValidateAudience = true;
    options.TokenValidationParameters.ValidateLifetime = true;
    options.TokenValidationParameters.ValidateIssuerSigningKey = true;
    options.RequireHttpsMetadata = true;
    options.IncludeErrorDetails = false;
    if (identity.Value.Enabled)
    {
        options.Authority = identity.Value.Authority;
        options.Audience = identity.Value.Audience;
    }
});
builder.Services.AddAuthorization(options => options.AddPolicy(RoleNames.TutoringAccessPolicy, policy => {
    if (cuentas.Enabled) { policy.AddAuthenticationSchemes(SeguridadCuenta.Scheme); if (localAuth) policy.AddAuthenticationSchemes("LocalDevelopment"); if (builder.Configuration.GetValue<bool>("Authentication:Enabled")) policy.AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme); }
    policy.RequireAuthenticatedUser().RequireRole(RoleNames.Student, RoleNames.Tutor, RoleNames.Coordination);
}));

var app = builder.Build();
if (args.Contains("--protect-smtp", StringComparer.Ordinal))
{
    var secret = Environment.GetEnvironmentVariable("TUTORIA_SMTP_PASSWORD") ?? throw new InvalidOperationException("Falta la contraseña SMTP en el entorno del proceso.");
    var path = app.Configuration.GetValue<string>("SmtpCuentas:PasswordFile") ?? throw new InvalidOperationException("Falta PasswordFile.");
    Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
    var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
    await File.WriteAllTextAsync(temporary, System.Text.Json.JsonSerializer.Serialize(app.Services.GetRequiredService<IDataProtectionProvider>().CreateProtector(SmtpCuentaSender.SecretPurpose).Protect(secret.Replace(" ", "", StringComparison.Ordinal))));
    File.Move(temporary, path, overwrite: true);
    Console.WriteLine("Contraseña SMTP protegida para la identidad de este servidor."); return;
}
if (args.Contains("--migrate", StringComparer.Ordinal) || (app.Environment.IsDevelopment() && app.Configuration.GetValue<bool>("Tutoria:ApplyMigrations")))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<TutoriaDbContext>();
    await SchemaRunner.Apply(db);
    if (app.Configuration.GetValue<bool>("Tutoria:SeedDemo"))
    {
        if (!app.Environment.IsDevelopment()) throw new InvalidOperationException("No se permite cargar datos ficticios fuera de Development.");
        await SemillaDesarrollo.Cargar(db, Path.Combine(app.Environment.ContentRootPath, "Data", "semilla-desarrollo.json"), app.Services.GetRequiredService<TimeProvider>());
    }
    if (args.Contains("--migrate", StringComparer.Ordinal)) return;
}
app.UseExceptionHandler();
app.UseStatusCodePages();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "Tutoría UNAS API v1"));
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") }).AllowAnonymous();
app.MapControllers();
app.Run();

public partial class Program;
