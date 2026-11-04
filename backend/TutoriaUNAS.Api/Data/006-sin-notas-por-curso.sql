-- El padrón entregado contiene PPA/TCA, matrícula y horario, sin calificaciones por curso.
DELETE FROM "Fuentes" WHERE "Tipo" = 'resultadosAcademicos';
UPDATE "Fuentes" SET "DatosJson" = "DatosJson" - 'promedioSemestre' - 'cursosDesaprobados',
    "Version" = "Version" + 1
WHERE "Tipo" = 'resumenesAcademicos' AND ("DatosJson" ? 'promedioSemestre' OR "DatosJson" ? 'cursosDesaprobados');
