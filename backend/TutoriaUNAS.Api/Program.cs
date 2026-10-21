using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TutoriaUNAS.Api.Configuration;
using TutoriaUNAS.Api.Data;
using TutoriaUNAS.Api.Services;
using CorsSettings = TutoriaUNAS.Api.Configuration.CorsOptions;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddHealthChecks();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<ISystemStatusService, SystemStatusService>();
builder.Services.AddScoped<IDemoOverviewService, DemoOverviewService>();
builder.Services.AddOptions<DatabaseOptions>().BindConfiguration(DatabaseOptions.SectionName).ValidateOnStart();
builder.Services.AddOptions<IdentityOptions>().BindConfiguration(IdentityOptions.SectionName)
    .Validate(options => options.IsValid(), "La autenticación requiere una Authority HTTPS y un Audience.").ValidateOnStart();
builder.Services.AddOptions<CorsSettings>().BindConfiguration(CorsSettings.SectionName)
    .Validate(options => options.IsValid(), "CORS requiere orígenes explícitos válidos, sin comodines ni rutas.").ValidateOnStart();

var database = builder.Configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>() ?? new();
if (database.Enabled)
{
    var connectionString = builder.Configuration.GetConnectionString("Tutoria");
    if (string.IsNullOrWhiteSpace(connectionString)) throw new InvalidOperationException("Define ConnectionStrings__Tutoria al habilitar PostgreSQL.");
    builder.Services.AddDbContext<TutoriaDbContext>(options => options.UseNpgsql(connectionString));
}

builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
{
    var cors = builder.Configuration.GetSection(CorsSettings.SectionName).Get<CorsSettings>() ?? new();
    policy.WithOrigins(cors.AllowedOrigins).WithMethods("GET", "POST", "PUT", "DELETE").WithHeaders("Content-Type", "Authorization");
}));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
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
builder.Services.AddAuthorization(options => options.AddPolicy(RoleNames.TutoringAccessPolicy, policy =>
    policy.RequireAuthenticatedUser().RequireRole(RoleNames.Student, RoleNames.Tutor, RoleNames.Coordination)));

var app = builder.Build();
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
app.MapHealthChecks("/health").AllowAnonymous();
app.MapControllers();
app.Run();

public partial class Program;
