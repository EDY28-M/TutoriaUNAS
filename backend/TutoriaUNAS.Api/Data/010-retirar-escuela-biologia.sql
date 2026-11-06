-- Los registros históricos de la semilla se conservan, pero no corresponden al padrón.
UPDATE "Periodos"
SET "Activo" = FALSE, "Version" = "Version" + 1
WHERE "EscuelaId" = 'E-BIO' AND "Activo" = TRUE;

DELETE FROM "Catalogos" WHERE "Tipo" = 'escuelas' AND "Id" = 'E-BIO';
