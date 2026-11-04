using System.Reflection;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Configuration;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RequierePermisoAttribute(string recurso, string accion) : Attribute
{
    public string Recurso { get; } = recurso;
    public string Accion { get; } = accion;
}
public sealed class PermisoTutoriaFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext action, ActionExecutionDelegate next)
    {
        if (action.ActionDescriptor is ControllerActionDescriptor descriptor)
        {
            var permiso = descriptor.MethodInfo.GetCustomAttribute<RequierePermisoAttribute>() ?? descriptor.ControllerTypeInfo.GetCustomAttribute<RequierePermisoAttribute>();
            if (permiso is not null)
            {
                var context = action.HttpContext.RequestServices.GetRequiredService<TutoriaContext>();
                (await context.Actor(action.HttpContext.RequestAborted)).Exigir(permiso.Recurso, permiso.Accion);
            }
        }
        await next();
    }
}
