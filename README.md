# Sistema de Tutoría Universitaria · UNAS

Base ejecutable de demostración con React, TypeScript, Vite y ASP.NET Core .NET 10.
Todas las cuentas y los registros son ficticios. Los formularios reproducen los anexos 01–12
de la Resolución N.º 500-2022-CU-R-UNAS y los responsables/momentos de la guía de llenado
proporcionada. Sus envíos son demostrativos. El frontend funciona sin API ni PostgreSQL.

**Sesiones es el único módulo para consultar y gestionar las sesiones de tutoría en los
tres roles.** Incluye el calendario mensual/semanal y el detalle de cada sesión. No hay
un módulo Calendario o Horarios separado ni bloques de disponibilidad en esta vista;
los enlaces antiguos redirigen a Sesiones.

Sesiones abre en **Semana** para todos los roles. Agenda muestra las sesiones programadas o
reprogramadas; Historial, las realizadas. Seleccionar una fecha conserva el período visible.
El tutor registra la asistencia en **Asistencias**, con columnas Asistió/Faltó y círculos
excluyentes. El acuerdo y la cantidad de asistentes aparecen en el detalle de la sesión,
sin listas de estudiantes. Este registro se conserva en `localStorage` del navegador de
demostración; no se envía a una API.

Para comprimir o trasladar el proyecto no incluyas `frontend/node_modules`, cachés, reportes,
ni `bin/obj` del backend. Las dependencias se recuperan desde `frontend` con
`pnpm install --frozen-lockfile`; después, `pnpm dev`. Conserva `package.json` y `pnpm-lock.yaml`.

## Formularios de tutoría · 16 de octubre de 2026

Revisión documental del **27 de octubre de 2026**: `docs/MIGRACION.md` contiene el contraste de
las cartas 000151-ATCD y 001026-DIBU, la matriz de datos de las nueve áreas y la automatización
anexo por anexo. La respuesta de DBU solicita un plan; no concede todavía acceso. El plan
editable se rehízo con el Word de referencia y está en
`artifacts/analisis-tutoria/Requerimientos_Bienestar_Universitario_Tutoria.docx`.

La precarga distingue semestre y significado de la pregunta; conserva el texto de «Otro» y los
contactos declarados. Solo la trayectoria escolar se reutiliza entre semestres. Los envíos
rechazados no cambian esa fuente y los enviados conservan su contenido. La versión anterior
de la caché deja de usarse por no registrar semestre; los borradores del workspace permanecen.
La ficha del tutor restringe el acceso a sus asignaciones activas y recibe estados de salud sin
motivo médico. Una identidad estudiantil desconocida ya no muestra otro expediente.
Estos controles de demostración requieren sus equivalentes en servidor antes del uso real.

- Estudiante: **Mi tutoría → Mis formularios**. Entrevista 03 (ciclos 1 a 3), 04 (ciclos 4 a 7)
  o 05 (ciclos 8 a 10) al iniciar el semestre. Evaluaciones 10 y 11 por cada sesión
  individual o grupal finalizada, con asistencia confirmada por el docente; no dependen del ciclo.
  Esta distribución sigue la indicación del usuario del 27 de octubre de 2026 y es la misma
  en frontend y backend. Los ciclos inválidos se rechazan; no se asignan a una etapa por defecto.
- Docente: **Mi tutoría → Mis formularios / Respuestas de estudiantes**, al principio del menú.
  Registros 06, 07, 08 y 12 durante el semestre; preparación de 09 durante el semestre y envío
  de 02 y 09 al cierre. El 01 corresponde a la comisión.
- Pasos breves con datos precargados, radios, casillas, selectores, filas editables y revisión
  previa al envío. Las sugerencias conservan «Otro» para respuestas distintas.
- El mismo registro recorre borrador, envío, observación, subsanación y revisión. Los borradores
  del estudiante no se abren desde el portal docente. El tutor consulta las evaluaciones
  enviadas, pero no puede cambiarlas ni aprobarlas en nombre del estudiante.
- Los formularios reutilizan los datos estables que ya registraste (colegio, hábitos de
  estudio, situación socioemocional, rasgos, expectativas) y los del padrón; solo se completa lo
  que falta o cambió. El formato 01 se precarga con el plan de la escuela y el 12 se prepara desde
  la atención 08. Detalle anexo por anexo en `docs/ANEXOS-COBERTURA.md`.
- Una atención 08 con seguimiento incorpora la cita a Sesiones de ambos roles.
  Si requiere derivación, prepara un borrador 12; después de su envío aparece en solicitudes
  de apoyo. Los informes precargan las cifras de las atenciones registradas.

La demostración conserva el avance y el momento del semestre en `sessionStorage` de **la misma
pestaña**, al recargar y cambiar de rol. El selector de momento permite probar inicio,
desarrollo y cierre; no representa una apertura institucional. Cerrar la pestaña elimina esa
persistencia. No hay sincronización entre dispositivos, firma electrónica ni envío a servicios
externos. La API y la autorización institucional quedan para la integración posterior.

La programación y asistencia se guardan en `localStorage`. El tutor programa una sesión
individual o convoca a un grupo; ambos portales comparten el mismo calendario. Al terminar,
el botón **Registrar asistencia** del detalle abre la lista de convocados. Confirmar presentes
habilita **Evaluar tutoría** en el detalle del estudiante, que abre el formulario de esa sesión.
Una falta permite únicamente ver las preguntas y explica el requisito de asistencia.
Cada evaluación tiene una clave por sesión y estudiante; reutiliza grupo, turno, tutor y fecha,
sin copiar calificaciones. El guardado comprueba las mismas condiciones que la interfaz.

## Navegación del portal · 19 de octubre de 2026

El sidebar y la cabecera permanecen montados mientras se descarga una página; la
pantalla de carga de un módulo queda dentro del contenido. Los enlaces anticipan
solo el módulo señalado tras 80 ms de hover o al recibir foco por teclado. La
precarga y `React.lazy` comparten la descarga, sin cargar todos los portales al
iniciar. Con ahorro de datos activo se omite esta descarga anticipada.

El contenido cambia directamente, sin animación de entrada ni desplazamiento,
sin añadir espera al clic ni remontar los formularios al cambiar sus filtros.
El drawer móvil conserva foco, `Escape`, bloqueo del fondo y una salida suave.
Se respeta `prefers-reduced-motion`. No se añadieron dependencias.

Referencias: [Suspense de React](https://react.dev/reference/react/Suspense),
[animaciones eficientes de web.dev](https://web.dev/articles/animations-guide) y
[movimiento reducido de W3C](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions).
Pruebas: `frontend/e2e/navigation.spec.ts` cubre descargas lentas, cambios de destino,
precarga por mouse/teclado, historial, foco y seis anchos de 320 a 1440 px.

## Ejecutar en este equipo

Desde esta carpeta, abre dos terminales PowerShell:

```powershell
# Terminal 1: instala las dependencias bloqueadas y ejecuta el frontend.
./scripts/Start-Frontend.ps1

# Terminal 2: restaura y ejecuta la API.
./scripts/Start-Backend.ps1
```

Los scripts buscan primero herramientas instaladas en PATH y, en este equipo, también
los runtimes de Codex y el SDK ubicado en `$env:USERPROFILE/.dotnet`. No cambian el PATH
del sistema. Detén cada servidor con Ctrl+C.

- Frontend: <http://127.0.0.1:5173/login>
- API: <http://localhost:5080/api/status>
- Salud del proceso: <http://localhost:5080/health>
- Swagger UI en Development: <http://localhost:5080/swagger/index.html>
- Documento OpenAPI en Development: <http://localhost:5080/openapi/v1.json>

## Ejecutar con herramientas instaladas

Requisitos: Node.js 22.12 o superior, pnpm 11.25.0 y SDK .NET 10. El archivo
`global.json` acepta versiones estables del SDK 10 con actualización de feature band.
Las versiones de los paquetes están fijadas en los manifiestos y lockfiles.

```powershell
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

En otra terminal, desde la raíz:

```powershell
dotnet restore backend/TutoriaUNAS.slnx --locked-mode
dotnet run --project backend/TutoriaUNAS.Api --launch-profile http
```

No necesitas copiar `.env.example` para probar la demostración. Su URL se reserva para la
integración futura y la demostración no envía solicitudes de autenticación a la API.

## Desplegar en Vercel

El proyecto `tutoriaunas` se despliega desde la carpeta local `frontend` y usa
**Root Directory** en `.` (sin subcarpeta), el preset **Vite**,
`pnpm run build` como comando de compilación y `dist` como directorio de salida.
`frontend/vercel.json` conserva estos ajustes de compilación y las rutas de la SPA.
La raíz del repositorio no contiene un `package.json`.

Desde la raíz del repositorio, entra al frontend antes de desplegar:

```powershell
cd frontend
npx vercel --prod
```

Si vinculas otro proyecto en Vercel desde `frontend`, deja **Root Directory** en
`.` (sin subcarpeta). Vercel instala las dependencias usando el
lockfile de pnpm del frontend. Este despliegue publica únicamente el frontend.

## Cuentas de prueba

Selecciona el rol antes de ingresar. La contraseña pública de las tres cuentas es
`tutoria2026`. No utilices credenciales reales.

| Rol          | Usuario                |
| ------------ | ---------------------- |
| Estudiante   | `2023010456`           |
| Tutor        | `DOC-0421`             |
| Coordinación | `coordinacion.tutoria` |

«Mantener mi sesión» conserva solo el ID de la cuenta ficticia en `sessionStorage` de
esa pestaña; no usa `localStorage` ni almacena la contraseña. Si se desmarca, el acceso
se mantiene en memoria hasta recargar. Cerrar sesión borra el ID y la caché de consultas.
Los controles de rutas y el almacenamiento son demostrativos y se pueden manipular desde
el navegador: no constituyen una frontera de seguridad.

## Qué puedes probar

Los tres portales usan nombres sencillos y consistentes: **Estudiantes**, **Formularios**,
**Solicitudes de apoyo**, **Semestres y fechas** e **Historial de cambios**. Los encabezados
explican en una frase qué se puede hacer. Los códigos y títulos oficiales de los formatos
01–12 se conservan; el estado «Observado» de un formulario se muestra como **Por corregir**.
Las instrucciones de cada pantalla están visibles, sin abrir un panel adicional de ayuda.

- Interfaz inspirada en **Falcon**, con paleta verde clara y Manrope local,
  iconos Font Awesome y fotografía real de bosque en el login. Sin patrón de hojas.
- Textos, iconos, gráficos y contornos con tonos más intensos en los tres roles;
  menú lateral con letras de mayor peso e iconos más vivos. El fondo claro, los tamaños
  y la distribución se conservan.
- Sidebar clara con submenús, modo reducido, drawer móvil, breadcrumbs y preferencias.
- Inicio del tutor con ondas suaves por semana o día, barras y comparación por tipo;
  cantidades exactas del periodo y estados de formularios en barras. Los otros roles conservan
  el área acumulada y la distribución radial. Reportes combina ondas, barras y distribución
  por modalidad. Filtros de semestre, periodo y alcance por rol; en coordinación también
  se puede filtrar por tutor. Tablas con ordenación, filas por
  página y menús de acciones que se abren encima del área desplazable.
- **Portal del tutorado**: panel, mis sesiones con calendario, mi docente tutor,
  mis instrumentos (entrevistas 03–05 y evaluaciones 10–11), expediente académico de la DIAA,
  mis derivaciones, salud y bienestar, documentos, avisos y perfil.
- **Portal del docente tutor**: panel, mis tutorados, expediente del tutorado con
  seis pestañas, sesiones y asistencia con calendario, derivaciones (formato 12), instrumentos
  (01, 02, 06, 07, 08, 09 y 12), programación desde Sesiones con avisos de cruce, reportes con
  conteos separados y avisos.
- **Portal de coordinación**: asignaciones con aviso de aforo, padrón de tutores y
  tutorados, plan de acción tutorial, revisión de informes, reportes por escuela, sesiones,
  avisos, y la gestión institucional de instrumentos y versiones, campos y reglas, roles y
  permisos, integraciones de datos, semestres e hitos y auditoría.
- **Doce instrumentos** de la Resolución N.º 500-2022-CU-R-UNAS con sus secciones, campos y
  visaciones; su vigencia se muestra como pendiente de confirmación.
- **Seguimiento al SIS** (expediente de solo lectura con fuente y fecha de corte), consultas
  médicas y derivaciones a Bienestar, Salud, Psicología y Psicopedagogía, con datos ficticios y
  sin detalle clínico.
- Calendario mensual con eventos y agenda, bandeja de avisos con plantillas y destinatarios,
  filtros, ventanas de detalle, estados vacíos y descargas CSV.
- Navegación real, páginas 404, rechazo de rutas de otro rol y cierre de sesión.

### Paneles renovados · 16 de octubre de 2026

Los paneles del docente tutor y de coordinación usan una retícula adaptable, Manrope local,
tarjetas con cifras y contexto, y pendientes accionables por prioridad. La próxima sesión
destaca fecha, hora, lugar y convocatoria. Coordinación muestra todas las escuelas con
estudiantes atendidos/asignados y porcentaje de cobertura.

La composición analítica toma como referencias visuales [Falcon Analytics](https://prium.github.io/falcon/v3.26.0/dashboard/analytics.html),
[Tabler](https://preview.tabler.io/) y [shadcn Charts](https://ui.shadcn.com/charts/area).
Los gráficos aparecen antes de los bloques operativos en docente y coordinación. Las pestañas
alternan entre ondas/barras/por tipo en el tutor y área acumulada/por tipo en los otros roles;
los formularios ofrecen estados y avance por formato.
Los componentes compartidos también mejoran el panel del estudiante. Se usan Manrope y
JetBrains Mono locales, tooltips y tablas accesibles. Las sesiones reprogramadas se incluyen
en la serie programada y en la próxima sesión elegible. No se añadieron dependencias.

## Estructura

```text
tutoria-unas/
  frontend/
    src/
      assets/          escudo, fotografía, botánica y Font Awesome vendorizado
      components/
        ui/            sistema de diseño: tarjetas, métricas, tablas, calendario, iconos…
        panels/        barras de filtros, campos y formularios de instrumentos
        layout/        estructura del portal (barra lateral + barra superior)
        navigation/    barra lateral por rol
        forms/         campos y selector de rol del acceso
      data/            catálogos, personas, tutoría, expediente, instrumentos,
                       derivaciones, bienestar, configuración institucional y navegación
      hooks/           sesión (useAuth) y alcance por rol (usePortal)
      pages/           auth, estudiante, tutor, coordinacion, común y 404
      routes/          navegación y protecciones de interfaz
      services/        autenticación de demostración y cliente API reservado
      styles/          sistema de diseño (app.css, ui.css) y acceso (auth.css)
      types/           contratos de dominio y de autenticación
      utils/           fechas, CSV de reportes y roles
    e2e/               flujos, geometría, adaptación y accesibilidad
    tools/qa/          utilidades del equipo de QA
  backend/
    TutoriaUNAS.Api/    Controllers, Services, DTOs, Configuration, Data y Entities
    TutoriaUNAS.Api.Tests/
  scripts/             arranque local y preparación de cobertura
  docs/                migración, validación, SonarQube y pedidos de QA
```

La autenticación de demostración reside en `AuthService`; los datos ficticios viven en
`src/data` y las páginas los consumen con `usePortal()`, que resuelve el alcance de cada rol
(tutorados del docente, expediente del estudiante, ámbito de la coordinación). Ese hook es el
punto que se sustituirá por la API institucional cuando la DIAA, Recursos Humanos y Bienestar
habiliten sus servicios. Los componentes no acceden directamente a los fixtures.

## API y variables de entorno

La API usa controladores, servicios por inyección de dependencias, DTOs, Problem Details,
CORS con orígenes explícitos, OpenAPI y proveedor EF Core PostgreSQL. No crea tablas ni
ejecuta migraciones automáticamente. `/health` comprueba el proceso, no la conexión a PostgreSQL.

| Variable                     | Uso                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `ASPNETCORE_ENVIRONMENT`     | `Development` habilita Swagger y el resumen ficticio de `/api/demo/overview` |
| `ASPNETCORE_URLS`            | Dirección del servidor al ejecutar sin launch profile                        |
| `Database__Enabled`          | `true` registra `TutoriaDbContext`; por defecto es `false`                   |
| `ConnectionStrings__Tutoria` | Conexión a PostgreSQL, requerida si se habilita la base                      |
| `Cors__AllowedOrigins__0`    | Origen permitido, con esquema y puerto, sin ruta ni comodín                  |
| `Authentication__Enabled`    | Habilita la configuración de un proveedor de identidad real                  |
| `Authentication__Authority`  | Authority HTTPS del proveedor OIDC/JWT                                       |
| `Authentication__Audience`   | Audience esperado de la API                                                  |
| `AllowedHosts`               | Hosts explícitos del despliegue, separados por punto y coma                  |

No guardes conexiones, contraseñas o tokens en archivos versionados. Utiliza variables de
entorno o un gestor de secretos. La configuración inválida falla al arrancar.

`/api/access/me` exige identidad verificada y un claim `role` permitido (`estudiante`,
`tutor` o `coordinacion`). Con autenticación sin configurar responde 401. El backend no
acepta las cuentas de demostración, no emite tokens y no usa el selector visual para
conceder permisos. En producción se ocultan Swagger y el endpoint ficticio, y se habilitan
redirección HTTPS y HSTS.

## Verificación y calidad

```powershell
cd frontend
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
pnpm audit
```

Desde la raíz:

```powershell
dotnet build backend/TutoriaUNAS.slnx -warnaserror
dotnet test backend/TutoriaUNAS.slnx --collect:"XPlat Code Coverage" --settings backend/coverage.runsettings --results-directory artifacts/backend-tests
dotnet format backend/TutoriaUNAS.slnx --verify-no-changes
dotnet list backend/TutoriaUNAS.slnx package --vulnerable --include-transitive
```

En Windows, el proyecto de pruebas configura `MSTest.EnableParentProcessQuery=false`
mediante la opción de MSBuild del TestHost instalado. Evita el `Acceso denegado` que
aborta VSTest al intentar vigilar el proceso padre; no omite pruebas ni cambia la API.
`ApiTestFactory` excluye únicamente el proveedor EventLog durante las pruebas de Windows,
para que comprobar un error HTTP 500 no dependa de permisos sobre el registro de eventos.
Los otros proveedores de logging siguen activos. No requiere paquetes adicionales.
Referencia de la opción: [código de VSTest](https://source.dot.net/testhost.x86/DefaultEngineInvoker.cs.html).

Si Coverlet genera un reporte sin hits por permisos en el temporal de Windows, ejecuta
`powershell -ExecutionPolicy Bypass -File scripts/medir-cobertura-backend.ps1`. Usa temporales
locales del proyecto solo durante la ejecución y comprueba que la cobertura sea válida.
El resumen diferencia código fuente propio de código generado en `obj/`.

`pnpm check` comprueba formato, ESLint sin advertencias, pruebas unitarias con umbrales,
TypeScript estricto y build. La cobertura unitaria local se concentra en autenticación,
selección de rol, control de rutas, alcance de datos y utilidades; no representa toda la
aplicación. Los flujos visuales se verifican con Playwright y axe en Chromium.
Los anchos comprobados son 320, 375, 390, 768, 1024 y 1440 px.

La auditoría integral del 27 de octubre de 2026 obtuvo gate PASS 7/7, 131 pruebas unitarias
frontend y 36 backend aprobadas. La batería completa de navegador obtuvo **82 PASS y 41 FAIL**;
incluye expectativas antiguas y defectos reproducidos. El sistema sigue siendo una demostración:
faltan persistencia/API de negocio, autoría de F01, documentos oficiales e integraciones.
Consulta la matriz de formatos y evidencias actuales en [el registro de validación](docs/VALIDACION.md).

La migración posterior del motor de instrumentos a React Hook Form + Zod conserva el diseño
y los borradores existentes. Usa precarga que respeta los cambios pendientes y `useFieldArray`
para las tablas de participantes. Pasa **157 pruebas unitarias y 24 E2E del flujo afectado**;
el plan y los límites de la integración están en [MIGRACION.md](docs/MIGRACION.md).

Consulta [la preparación para SonarQube](docs/SONARQUBE.md) y
[el registro de validación](docs/VALIDACION.md). SonarQube no se ha ejecutado contra un
servidor; su Quality Gate depende del perfil y la configuración que utilices.

## Pendiente para la integración institucional

1. Validar la vigencia de los anexos recibidos y las reglas institucionales de asignación, seguimiento y reportes.
2. Definir entidades, constraints, retención y permisos por recurso con la universidad.
3. Crear y revisar migraciones EF Core sobre PostgreSQL de desarrollo.
4. Integrar el proveedor de identidad, mapeo de claims, renovación y cierre de sesión real.
5. Implementar consultas y operaciones con autorización por estudiante y tutor en el servidor.
6. Reemplazar los adaptadores de demostración por servicios API con contratos validados.
7. Incorporar recuperación real, contactos verificados y política institucional aprobada.

No hay entidades institucionales definitivas ni migraciones vacías para simular avance.
`IDesignTimeDbContextFactory` está preparado para EF Core; exige la conexión por variable
de entorno cuando se defina el modelo. El proyecto `login-unas` permanece intacto.

## Adaptación Falcon · 14 de octubre de 2026

El HTML adjunto y su carpeta `_files` se usaron como referencia local. La aplicación conserva
React/TypeScript y .NET; no depende del sitio de demostración de Falcon. El tema está
centralizado en `frontend/src/styles/global.css`. `fonts.css` carga Manrope local desde el
inicio; `PortalCharts.tsx` carga el ECharts vendorizado. Font Awesome 6.5.1 ya estaba instalado;
se mantienen sus equivalencias `calendar-days`, `file-lines`, `magnifying-glass` y `chart-pie`.

Las rutas de instrumentos admiten `?estado=pendiente` y `?estado=observado`; sesiones admite
`?vista=historial` y derivaciones `?estado=seguimiento`. Los filtros sobreviven a recarga y la
navegación marca el enlace correspondiente. La búsqueda general de coordinación abre
`/coordinacion/tutorados?buscar=CODIGO`; la tabla aplica esa búsqueda.

Las preferencias de presentación se guardan en el navegador. Sesiones, asistencia,
derivaciones y formularios mantienen el comportamiento demostrativo anterior. No se han
conectado nuevas APIs ni convertido los datos ficticios en registros persistentes de .NET.
Las exportaciones CSV existentes sí generan archivos. La recuperación de acceso indica
que su envío es simulado.

Verificación de esta adaptación: `scripts/verify-falcon.mjs` (Playwright) y resultados en
`artifacts/falcon/verification.json`. Ejecutar el script requiere el frontend en el puerto 5173.

### Corrección de fidelidad · 15 de octubre

Ahora se usa la **hoja de estilos original de Falcon v3.26.0**, incluida en
`src/assets/vendor/falcon-theme.css`, con la misma estructura de contenedor, navegación,
tarjetas y botones. La paleta verde y los contenidos de tutoría son la adaptación UNAS.

El servidor de `login-unas/server.js` abre el build actualizado en
`http://localhost:8080/login`. Para actualizar lo que sirve, ejecutar primero el build de
`frontend`. Vite continúa disponible en `http://127.0.0.1:5173/login` durante desarrollo.
Las propuestas antiguas se conservan en `http://localhost:8080/index.html`.
