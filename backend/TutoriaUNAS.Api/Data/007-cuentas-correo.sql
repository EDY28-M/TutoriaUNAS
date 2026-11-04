CREATE TABLE "CredencialesCuenta" (
    "UsuarioId" text PRIMARY KEY REFERENCES "Usuarios" ("Id") ON DELETE RESTRICT,
    "CorreoNormalizado" text NOT NULL, "Rol" text NOT NULL CHECK ("Rol" IN ('estudiante','tutor','coordinacion')),
    "PasswordHash" text NOT NULL, "Verificada" boolean NOT NULL, "CambioObligatorio" boolean NOT NULL,
    "TemporalHasta" timestamptz, "IntentosFallidos" integer NOT NULL DEFAULT 0,
    "BloqueadaHasta" timestamptz, "Creada" timestamptz NOT NULL,
    UNIQUE ("CorreoNormalizado", "Rol")
);
CREATE UNIQUE INDEX "IX_Usuarios_CuentaPersonaRol" ON "Usuarios" ("PersonaId", "Rol") WHERE "Issuer" = 'portal-account';
CREATE TABLE "RetosCorreo" (
    "Id" text PRIMARY KEY, "Correo" text NOT NULL, "Rol" text NOT NULL, "Proposito" text NOT NULL,
    "PersonaId" text REFERENCES "Personas" ("Id") ON DELETE RESTRICT,
    "UsuarioId" text REFERENCES "Usuarios" ("Id") ON DELETE RESTRICT,
    "VersionUsuario" integer NOT NULL, "PruebaHash" text, "CodigoHash" text NOT NULL,
    "TicketHash" text, "Intentos" integer NOT NULL DEFAULT 0, "Envios" integer NOT NULL DEFAULT 0,
    "Creado" timestamptz NOT NULL, "Expira" timestamptz NOT NULL, "UltimoEnvio" timestamptz,
    "Verificado" timestamptz, "Consumido" timestamptz
);
CREATE INDEX "IX_RetosCorreo_CorreoCreado" ON "RetosCorreo" ("Correo", "Creado");
CREATE TABLE "CorreosCuenta" (
    "Id" text PRIMARY KEY, "UsuarioId" text REFERENCES "Usuarios" ("Id") ON DELETE RESTRICT,
    "RetoId" text REFERENCES "RetosCorreo" ("Id") ON DELETE RESTRICT,
    "Destinatario" text NOT NULL, "Asunto" text NOT NULL, "ContenidoProtegido" text NOT NULL,
    "Creado" timestamptz NOT NULL, "Caduca" timestamptz NOT NULL, "ProximoIntento" timestamptz NOT NULL,
    "BloqueoHasta" timestamptz, "Enviado" timestamptz, "Cancelado" timestamptz,
    "Intentos" integer NOT NULL DEFAULT 0, "Error" text
);
CREATE INDEX "IX_CorreosCuenta_Pendientes" ON "CorreosCuenta" ("ProximoIntento") WHERE "Enviado" IS NULL AND "Cancelado" IS NULL;
UPDATE "Permisos" SET "AccionesJson" = '["ver","crear","editar"]' WHERE "Rol"='coordinacion' AND "Recurso"='cuentas';
