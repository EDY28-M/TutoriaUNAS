ALTER TABLE "Usuarios" ADD COLUMN "Version" integer NOT NULL DEFAULT 1;

CREATE TABLE "Catalogos" (
    "Tipo" text NOT NULL,
    "Id" text NOT NULL,
    "DatosJson" jsonb NOT NULL,
    "Version" integer NOT NULL,
    CONSTRAINT "PK_Catalogos" PRIMARY KEY ("Tipo", "Id")
);

CREATE TABLE "Fuentes" (
    "Tipo" text NOT NULL,
    "Id" text NOT NULL,
    "EstudianteId" text,
    "TutorId" text,
    "EscuelaId" text,
    "SemestreId" text,
    "Fuente" text NOT NULL,
    "FechaCorte" timestamp with time zone NOT NULL,
    "DatosJson" jsonb NOT NULL,
    "Version" integer NOT NULL,
    CONSTRAINT "PK_Fuentes" PRIMARY KEY ("Tipo", "Id")
);

CREATE TABLE "Permisos" (
    "Rol" text NOT NULL,
    "Recurso" text NOT NULL,
    "Nombre" text NOT NULL,
    "AccionesJson" jsonb NOT NULL,
    CONSTRAINT "PK_Permisos" PRIMARY KEY ("Rol", "Recurso")
);

CREATE TABLE "ConfiguracionPeriodos" (
    "PeriodoId" text NOT NULL,
    "Inicio" text NOT NULL,
    "Fin" text NOT NULL,
    "EntrevistasHasta" text NOT NULL,
    "InformesHasta" text NOT NULL,
    "Cerrado" boolean NOT NULL,
    "Version" integer NOT NULL,
    CONSTRAINT "PK_ConfiguracionPeriodos" PRIMARY KEY ("PeriodoId"),
    CONSTRAINT "FK_ConfiguracionPeriodos_Periodos_PeriodoId" FOREIGN KEY ("PeriodoId") REFERENCES "Periodos" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "ActividadesPlan" (
    "Id" text NOT NULL,
    "EscuelaId" text NOT NULL,
    "SemestreId" text NOT NULL,
    "ResponsableId" text NOT NULL,
    "Problematica" text NOT NULL,
    "Objetivo" text NOT NULL,
    "Actividad" text NOT NULL,
    "Meta" text NOT NULL,
    "FechaInicio" text NOT NULL,
    "FechaFin" text NOT NULL,
    "Evidencia" text NOT NULL,
    "Aprobacion" text NOT NULL,
    "Avance" integer NOT NULL,
    "Estado" text NOT NULL,
    "Version" integer NOT NULL,
    CONSTRAINT "PK_ActividadesPlan" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ActividadesPlan_Personas_ResponsableId" FOREIGN KEY ("ResponsableId") REFERENCES "Personas" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "CalendarioDocente" (
    "Id" text NOT NULL,
    "TutorId" text NOT NULL,
    "EscuelaId" text NOT NULL,
    "SemestreId" text NOT NULL,
    "DatosJson" jsonb NOT NULL,
    "Creado" timestamp with time zone NOT NULL,
    "Version" integer NOT NULL,
    CONSTRAINT "PK_CalendarioDocente" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_CalendarioDocente_Personas_TutorId" FOREIGN KEY ("TutorId") REFERENCES "Personas" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "Contactos" (
    "PersonaId" text NOT NULL,
    "Correo" text NOT NULL,
    "Telefono" text NOT NULL,
    "Actualizado" timestamp with time zone NOT NULL,
    "Version" integer NOT NULL,
    CONSTRAINT "PK_Contactos" PRIMARY KEY ("PersonaId"),
    CONSTRAINT "FK_Contactos_Personas_PersonaId" FOREIGN KEY ("PersonaId") REFERENCES "Personas" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "InscripcionesCampana" (
    "CampanaId" text NOT NULL,
    "EstudianteId" text NOT NULL,
    "Fecha" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_InscripcionesCampana" PRIMARY KEY ("CampanaId", "EstudianteId"),
    CONSTRAINT "FK_InscripcionesCampana_Personas_EstudianteId" FOREIGN KEY ("EstudianteId") REFERENCES "Personas" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "SolicitudesCambio" (
    "Id" text NOT NULL,
    "EstudianteId" text NOT NULL,
    "TutorActualId" text NOT NULL,
    "EscuelaId" text NOT NULL,
    "SemestreId" text NOT NULL,
    "Motivo" text NOT NULL,
    "Estado" text NOT NULL,
    "Respuesta" text,
    "ResueltoPor" text,
    "Creado" timestamp with time zone NOT NULL,
    "Resuelto" timestamp with time zone,
    "Version" integer NOT NULL,
    CONSTRAINT "PK_SolicitudesCambio" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SolicitudesCambio_Personas_EstudianteId" FOREIGN KEY ("EstudianteId") REFERENCES "Personas" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "Mensajes" (
    "Id" text NOT NULL,
    "EmisorId" text NOT NULL,
    "EscuelaId" text NOT NULL,
    "Asunto" text NOT NULL,
    "Cuerpo" text NOT NULL,
    "Canal" text NOT NULL,
    "Estado" text NOT NULL,
    "Plantilla" text NOT NULL,
    "RelacionadoCon" text,
    "Creado" timestamp with time zone NOT NULL,
    "ProgramadoPara" timestamp with time zone,
    "Publicado" timestamp with time zone,
    "Version" integer NOT NULL,
    CONSTRAINT "PK_Mensajes" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Mensajes_Usuarios_EmisorId" FOREIGN KEY ("EmisorId") REFERENCES "Usuarios" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "Notificaciones" (
    "Id" text NOT NULL,
    "UsuarioId" text NOT NULL,
    "Evento" text NOT NULL,
    "Tipo" text NOT NULL,
    "Titulo" text NOT NULL,
    "Detalle" text NOT NULL,
    "Enlace" text,
    "MensajeId" text,
    "Fecha" timestamp with time zone NOT NULL,
    "Leida" timestamp with time zone,
    CONSTRAINT "PK_Notificaciones" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Notificaciones_Usuarios_UsuarioId" FOREIGN KEY ("UsuarioId") REFERENCES "Usuarios" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "Preferencias" (
    "UsuarioId" text NOT NULL,
    "AvisosJson" jsonb NOT NULL,
    "PantallaJson" jsonb NOT NULL,
    "Version" integer NOT NULL,
    CONSTRAINT "PK_Preferencias" PRIMARY KEY ("UsuarioId"),
    CONSTRAINT "FK_Preferencias_Usuarios_UsuarioId" FOREIGN KEY ("UsuarioId") REFERENCES "Usuarios" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "Seguimientos" (
    "Id" text NOT NULL,
    "InstrumentoId" text,
    "EstudianteId" text NOT NULL,
    "TutorId" text NOT NULL,
    "EscuelaId" text NOT NULL,
    "SemestreId" text NOT NULL,
    "Area" text NOT NULL,
    "Estado" text NOT NULL,
    "Prioridad" text NOT NULL,
    "ResponsableArea" text NOT NULL,
    "SiguienteAccion" text NOT NULL,
    "RecomendacionComunicable" text,
    "VigenciaRecomendacion" text,
    "FechaCita" text,
    "Actualizado" timestamp with time zone NOT NULL,
    "HistorialJson" jsonb NOT NULL,
    "Version" integer NOT NULL,
    CONSTRAINT "PK_Seguimientos" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Seguimientos_Instrumentos_InstrumentoId" FOREIGN KEY ("InstrumentoId") REFERENCES "Instrumentos" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "Destinatarios" (
    "MensajeId" text NOT NULL,
    "UsuarioId" text NOT NULL,
    CONSTRAINT "PK_Destinatarios" PRIMARY KEY ("MensajeId", "UsuarioId"),
    CONSTRAINT "FK_Destinatarios_Mensajes_MensajeId" FOREIGN KEY ("MensajeId") REFERENCES "Mensajes" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Destinatarios_Usuarios_UsuarioId" FOREIGN KEY ("UsuarioId") REFERENCES "Usuarios" ("Id") ON DELETE RESTRICT
);

CREATE INDEX "IX_ActividadesPlan_ResponsableId" ON "ActividadesPlan" ("ResponsableId");

CREATE INDEX "IX_CalendarioDocente_TutorId" ON "CalendarioDocente" ("TutorId");

CREATE INDEX "IX_Destinatarios_UsuarioId" ON "Destinatarios" ("UsuarioId");

CREATE INDEX "IX_Fuentes_EscuelaId_EstudianteId_Tipo" ON "Fuentes" ("EscuelaId", "EstudianteId", "Tipo");

CREATE INDEX "IX_InscripcionesCampana_EstudianteId" ON "InscripcionesCampana" ("EstudianteId");

CREATE INDEX "IX_Mensajes_EmisorId" ON "Mensajes" ("EmisorId");

CREATE INDEX "IX_Mensajes_Estado_ProgramadoPara" ON "Mensajes" ("Estado", "ProgramadoPara");

CREATE UNIQUE INDEX "IX_Notificaciones_Evento_UsuarioId" ON "Notificaciones" ("Evento", "UsuarioId");

CREATE INDEX "IX_Notificaciones_UsuarioId_Fecha" ON "Notificaciones" ("UsuarioId", "Fecha");

CREATE UNIQUE INDEX "IX_Seguimientos_InstrumentoId" ON "Seguimientos" ("InstrumentoId");

CREATE UNIQUE INDEX "IX_SolicitudesCambio_EstudianteId_SemestreId" ON "SolicitudesCambio" ("EstudianteId", "SemestreId") WHERE "Estado" = 'pendiente';