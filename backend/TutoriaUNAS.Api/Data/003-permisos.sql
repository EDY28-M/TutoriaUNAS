INSERT INTO "Permisos" ("Rol", "Recurso", "Nombre", "AccionesJson")
SELECT rol, recurso, nombre, acciones::jsonb
FROM (VALUES ('estudiante'), ('tutor'), ('coordinacion')) AS roles(rol)
CROSS JOIN (VALUES
 ('portal', 'Portal', '["ver"]'),
 ('perfil', 'Contacto propio', '["ver","editar"]'),
 ('preferencias', 'Preferencias propias', '["ver","editar"]'),
 ('periodos', 'Periodo tutorial', '["ver"]'),
 ('campanas', 'Actividades de bienestar', '["ver"]'),
 ('comunicacion', 'Bandeja propia', '["ver","editar"]'),
 ('seguimiento', 'Apoyos de su ámbito', '["ver"]'),
 ('calendario', 'Agenda de su ámbito', '["ver"]')
) AS recursos(recurso, nombre, acciones);

INSERT INTO "Permisos" ("Rol", "Recurso", "Nombre", "AccionesJson") VALUES
 ('estudiante','formularios','Formularios propios','["ver","crear","editar"]'),
 ('tutor','formularios','Formularios y entrevistas asignadas','["ver","crear","editar","revisar"]'),
 ('coordinacion','formularios','Formularios de la escuela','["ver","crear","editar","revisar","aprobar"]'),
 ('estudiante','sesiones','Sesiones propias','["ver"]'),
 ('tutor','sesiones','Sesiones y asistencia propias','["ver","crear","editar"]'),
 ('coordinacion','sesiones','Sesiones de la escuela','["ver"]'),
 ('estudiante','solicitudes','Solicitudes propias de cambio de tutor','["ver","crear"]'),
 ('coordinacion','solicitudes','Resolver solicitudes de cambio de tutor','["ver","editar"]'),
 ('coordinacion','asignaciones','Asignaciones de la escuela','["ver","crear","editar"]'),
 ('coordinacion','cuentas','Habilitación de cuentas de la escuela','["ver","editar"]'),
 ('tutor','planes','Plan de la escuela','["ver"]'),
 ('coordinacion','planes','Plan de la escuela','["ver","crear","editar"]'),
 ('coordinacion','integraciones','Seguimiento de solicitudes de datos','["ver","editar"]'),
 ('coordinacion','auditoria','Auditoría de la escuela','["ver"]');

UPDATE "Permisos" SET "AccionesJson" = '["ver","crear","editar"]' WHERE "Recurso" = 'comunicacion' AND "Rol" IN ('tutor','coordinacion');
UPDATE "Permisos" SET "AccionesJson" = '["ver","editar"]' WHERE "Recurso" IN ('periodos','seguimiento') AND "Rol" = 'coordinacion';
UPDATE "Permisos" SET "AccionesJson" = '["ver","crear","eliminar"]' WHERE "Recurso" = 'campanas' AND "Rol" = 'estudiante';
UPDATE "Permisos" SET "AccionesJson" = '["ver","crear","editar","eliminar"]' WHERE "Recurso" = 'calendario' AND "Rol" = 'tutor';
