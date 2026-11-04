UPDATE "Permisos" SET "AccionesJson" = '["ver","crear","editar","revisar","eliminar"]'
WHERE "Rol" = 'tutor' AND "Recurso" = 'formularios';
UPDATE "Permisos" SET "AccionesJson" = '["ver","crear","editar","eliminar"]'
WHERE ("Rol" IN ('tutor','coordinacion') AND "Recurso" = 'comunicacion')
   OR ("Rol" = 'coordinacion' AND "Recurso" = 'planes');
