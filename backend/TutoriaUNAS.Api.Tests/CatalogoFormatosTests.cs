using TutoriaUNAS.Api.Services;

namespace TutoriaUNAS.Api.Tests;

public sealed class CatalogoFormatosTests
{
    private readonly CatalogoFormatos catalogo = new();
    [Theory]
    [InlineData("[null]")]
    [InlineData("[{\"nombre\":null}]")]
    [InlineData("{\"nombre\":\"x\"}")]
    [InlineData("no es JSON")]
    public void MalformedRowsProduceValidationErrorsInsteadOfServerExceptions(string rows)
    {
        var errors = catalogo.Validar("F07", new() { ["asistentes"] = rows }, "2026-10-28", []);
        Assert.Contains("asistentes", errors.Keys);
    }
    [Fact]
    public void RepeatedExclusiveOptionsAndUnknownCoursesAreRejected()
    {
        var errors = catalogo.Validar("F04", new() { ["otrasActividades"] = "[\"Solo estudio\",\"Trabajo\"]", ["cursosDificiles"] = "[\"Curso inexistente\"]" }, "2026-10-28", ["Curso ficticio"]);
        Assert.Contains("otrasActividades", errors.Keys);
        Assert.Contains("cursosDificiles", errors.Keys);
        Assert.Equal("", catalogo.NombreCurso("curso-inexistente"));
    }
    [Fact]
    public void HiddenAnswersAndUnknownKeysDoNotPersist()
    {
        var answers = catalogo.Limpiar("F08", new() { ["resultado"] = "Se resuelve con la asesoría", ["proximaCita"] = "2026-11-01", ["areaDerivacion"] = "Psicología", ["rol"] = "coordinacion" });
        Assert.DoesNotContain("proximaCita", answers.Keys);
        Assert.DoesNotContain("areaDerivacion", answers.Keys);
        Assert.DoesNotContain("rol", answers.Keys);
    }
}
