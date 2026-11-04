using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TutoriaUNAS.Api.Domain;

namespace TutoriaUNAS.Api.Configuration;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger, IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var status = exception is TutoriaError error ? error.Status :
            exception is DbUpdateConcurrencyException || exception is DbUpdateException { InnerException: PostgresException { SqlState: "23505" or "40001" } } ? 409 :
            exception is NpgsqlException or TimeoutException || exception is DbUpdateException { InnerException: NpgsqlException } ? 503 : 500;
        if (status != 500)
        {
            httpContext.Response.StatusCode = status;
            var details = new ProblemDetails { Status = status, Title = exception is TutoriaError ? exception.Message : status == 503 ? "La base de datos no está disponible. Inténtalo de nuevo." : "El registro cambió. Actualiza antes de guardar." };
            if (exception is TutoriaError { Errors: { } errors }) details.Extensions["errors"] = errors;
            return await problemDetails.TryWriteAsync(new ProblemDetailsContext { HttpContext = httpContext, ProblemDetails = details });
        }
        logger.LogError(exception, "Unexpected API failure. Trace identifier: {TraceIdentifier}", httpContext.TraceIdentifier);
        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "No se pudo procesar la solicitud.",
                Extensions = { ["traceId"] = httpContext.TraceIdentifier }
            }
        });
    }
}
