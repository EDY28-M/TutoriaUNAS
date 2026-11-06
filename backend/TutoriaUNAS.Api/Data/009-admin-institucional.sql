ALTER TABLE "Usuarios"
    ADD COLUMN "AdminInstitucional" boolean NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT "CK_Usuarios_AdminInstitucional"
        CHECK (NOT "AdminInstitucional" OR "Rol" = 'coordinacion');

UPDATE "Usuarios"
SET "AdminInstitucional" = TRUE, "Version" = "Version" + 1
WHERE "Id" = 'COM-01' AND "Subject" = 'COM-01'
    AND "Issuer" = 'local-development' AND "Rol" = 'coordinacion'
    AND "Identificador" = 'coordinacion.tutoria';
