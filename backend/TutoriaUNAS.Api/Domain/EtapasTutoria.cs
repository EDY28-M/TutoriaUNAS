namespace TutoriaUNAS.Api.Domain;

/// <summary>Rangos de tutoría indicados para el sistema por el usuario el 27/10/2026.</summary>
public static class EtapasTutoria
{
    /// <summary>Primer ciclo académico del sistema.</summary>
    public const int PrimerCiclo = 1;

    /// <summary>Último ciclo académico del sistema.</summary>
    public const int UltimoCiclo = 10;

    /// <summary>Último ciclo de la etapa inicial (ingresantes).</summary>
    public const int UltimoCicloInicial = 3;

    /// <summary>Último ciclo de la etapa intermedia.</summary>
    public const int UltimoCicloIntermedio = 7;

    /// <summary>Indica si el ciclo pertenece al rango académico válido.</summary>
    public static bool EsCicloValido(int ciclo) => ciclo is >= PrimerCiclo and <= UltimoCiclo;

    /// <summary>Formato de entrevista inicial que corresponde al ciclo del estudiante.</summary>
    public static string FormatoEntrevistaInicial(int ciclo)
    {
        if (!EsCicloValido(ciclo))
        {
            throw new ArgumentOutOfRangeException(nameof(ciclo), ciclo, "El ciclo debe estar entre 1 y 10.");
        }

        return ciclo <= UltimoCicloInicial ? "F03" : ciclo <= UltimoCicloIntermedio ? "F04" : "F05";
    }
}
