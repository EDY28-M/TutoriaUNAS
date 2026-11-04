# Sistema de Tutoría Universitaria · UNAS

Sistema local de desarrollo con React, TypeScript, Vite, ASP.NET Core .NET 10 y PostgreSQL.
Las cuentas de demostración son ficticias. La base local contiene además el padrón real
importado del Excel autorizado por el usuario. Los formularios reproducen los anexos 01–12
de la Resolución N.º 500-2022-CU-R-UNAS y los responsables/momentos de la guía de llenado
proporcionada. En modo API los envíos y borradores se persisten en PostgreSQL. Los datos
de demostración siguen identificados como tales; las integraciones de las áreas universitarias necesitan su acceso real.

## Aspecto de los portales · 4 de noviembre de 2026

Estudiante, tutor y coordinación comparten las superficies de Reportes: tarjetas sin bordes
ni sombras, tablas con separadores suaves e indicadores con iconos oficiales de Font Awesome
sobre fondo transparente. Los listados de coordinación tienen espacio interior para títulos,
filtros, filas y notas. Los accesos de formularios usan iconos más grandes.

El menú compacto conserva la elección mediante las preferencias de la API. Las vistas de la
gráfica de formularios mantienen su posición al alternarlas; el avance por formato alinea
los porcentajes en una columna. Evidencia y verificaciones en [VALIDACION.md](docs/VALIDACION.md).

## Cuentas institucionales y correo SMTP · 4 de noviembre de 2026

En **Coordinación → Accesos y permisos → Cuentas** se pueden crear accesos de estudiante,
docente tutor y coordinación, buscar personas del padrón o registrar sus datos de identidad.
Las listas **Estudiantes → Crear estudiante** y **Tutores → Crear docente** abren el mismo
formulario con el perfil elegido. **Nueva persona (fuera del padrón)** permite registrar a
alguien que no aparece en el Excel; **Persona del padrón** permite seleccionarlo sin duplicar
sus datos. Al guardar se actualizan la lista y sus filtros. **Gestionar cuentas** lleva
directamente a las verificaciones, habilitación y vinculaciones pendientes.
La operación respeta la escuela de quien administra. Genera una contraseña temporal aleatoria,
válida por 48 horas y visible una vez; la invitación se encola para el correo institucional.
El primer ingreso permite únicamente verificar el correo mediante un código y elegir una
contraseña personal. No concede acceso al portal mientras esa activación esté pendiente.

El login ofrece **Crear cuenta** para alumnos y docentes del padrón con correo `@unas.edu.pe`:
correo → código → contraseña → portal, sin pedir otra verificación después del alta.
Coordinación se crea desde el panel autorizado. Un docente cuyo padrón no informa escuela
queda verificado y pendiente de vinculación por coordinación antes de acceder al portal.
**Recuperar acceso** usa también un código; cambiar la contraseña revoca las sesiones previas.

Se aplicó la migración `007-cuentas-correo.sql`, con respaldo previo. Las contraseñas se
guardan como hash PBKDF2; los códigos tienen seis dígitos, caducan en diez minutos, permiten
cinco intentos y se invalidan al reenviar. La confirmación entrega una autorización de cinco
minutos y un solo uso. Hay límites por correo/IP, bloqueo de intentos de login y controles de
versión. La cola PostgreSQL conserva el cuerpo cifrado, reintenta entregas y borra su contenido
al enviarlo o cancelarlo. Los perfiles se determinan en el servidor.

SMTP Gmail está configurado localmente con STARTTLS en el puerto 587. La autenticación TLS
se comprobó sin enviar mensajes a personas reales; la entrega a una bandeja institucional
real todavía no se ha ensayado. La contraseña de aplicación está cifrada con ASP.NET Data
Protection/DPAPI, en `backend/TutoriaUNAS.Api/smtp-password.local.json`; ese archivo y la
configuración local se excluyen de Git y del contenido publicado. Las claves permanecen en
el perfil de Windows y deben conservarse para descifrar la cola y los tokens tras un reinicio.
No se incorporaron dependencias.

Para reconfigurar en este equipo, compila la API con configuración `Accounts` y ejecuta
`scripts/Configurar-Correo.ps1 -Usuario <remitente> -Password (Read-Host -AsSecureString)`.
El script valida SMTP, conserva la clave de códigos y protege la nueva contraseña sin
escribirla en texto plano. El adaptador `ICorreoCuentaSender` mantiene separado el transporte.
En un despliegue: habilita `Cuentas:Enabled`, configura una clave aleatoria `Cuentas:CodigoKey`
de al menos 32 bytes en base64, dominio autorizado, URL HTTPS del login, archivo SMTP protegido
y un keyring persistente y protegido para la identidad del servidor. Ejecuta `--protect-smtp`
bajo esa identidad con el secreto en el entorno del proceso. Desactiva `LocalDevelopment:Enabled`
y `Tutoria:SeedDemo`; aplica las migraciones expresamente. El archivo protegido en este Windows
no se traslada como credencial utilizable a otro servidor.

Verificación: **190 pruebas frontend**, **76 backend con PostgreSQL**, **gate 7/7** y
**54 combinaciones de vista/ancho** con revisión Axe sin infracciones detectadas.
La corrección de altas desde Estudiantes/Tutores añade **36 combinaciones de vista/ancho**
y comprueba aparición inmediata, rechazo conservando los datos y navegación a Cuentas.
Las pruebas de cuentas utilizan transporte simulado y bases aisladas; no crean accesos reales
ni envían invitaciones a alumnos/docentes. Detalle en [VALIDACION.md](docs/VALIDACION.md).
Referencias: [SMTP Gmail](https://support.google.com/mail/answer/7104828?hl=en),
[verificación de correo OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html)
y [Data Protection](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/configuration/overview?view=aspnetcore-10.0).

## Padrón Excel · 4 de noviembre de 2026

Se importaron las dos hojas: **3.686 alumnos**, **337 docentes**, **3.686 matrículas**,
**21.121 inscripciones curso/grupo**, **873 cursos por escuela/código** y **45.618 bloques
de clase**. Se excluyeron 163 filas docentes sin correo, conforme al pedido del usuario.
La conciliación comprobó las 21 columnas y las 45.831 filas de alumnos, y las cinco columnas
con encabezado de cada docente aceptado. Las 195 repeticiones de horario se agrupan sin perder
sus filas de procedencia. Los 18 horarios con duración cero se conservan en la matrícula original.
El código de semestre de los registros es `2026-2`, normalizado como `2026-II`, aunque las pestañas dicen `2026-1`.

En **Coordinación → Padrón importado** se consultan ambas hojas, con búsqueda, filtro por escuela,
paginación y ficha completa de matrícula, cursos, docentes, aulas, código de aula, día, horas,
duración y condición teórica. El panel inicial enlaza el padrón con sus cantidades reales.
La consulta institucional exige rol coordinación y permiso `integraciones/ver`; las operaciones
tutoriales conservan su ámbito por escuela/asignación.

Se retiraron las notas, evaluaciones, aprobados/desaprobados y repitencias calculadas por curso.
Se conservan PPA y TCA suministrados. Ciclo, fecha de ingreso, créditos por curso, total del plan,
categoría docente y escuela tutorial del docente no se deducen. Importar no crea usuarios,
contraseñas ni asignaciones tutoriales; las entrevistas esperan la confirmación del ciclo.
Los datos personales permanecen en PostgreSQL y no se escriben en los recursos públicos del frontend.

Importador sin nuevas dependencias del proyecto: `scripts/importar_padron.py <archivo.xlsx>` valida;
con `--apply` crea un respaldo completo con `pg_dump` y ejecuta una transacción con conciliación.
Repetir el archivo no duplica personas, matrículas ni horarios. Requiere Python y los ejecutables
PostgreSQL locales. Los respaldos y resultados quedan en `%LOCALAPPDATA%/TutoriaUNAS/importaciones/`.

En esta sesión la API actualizada escucha en `http://127.0.0.1:5082`; `frontend/.env.local`
apunta a ese puerto y `scripts/Start-Backend.ps1` lo lee para siguientes arranques.
Los servidores previos se conservan. La aplicación sigue en `http://127.0.0.1:5173`.

## Revisión de los tres portales · 30 de octubre de 2026

Coordinación utiliza listas y filtros compactos, con detalles al abrir. Accesos y permisos
se consulta por perfil; Cuentas tiene una pestaña propia. Reportes, fechas, formularios,
preguntas, avisos, revisiones y datos de otras áreas priorizan su tarea principal. Los tres
roles comparten la ficha de perfil y el editor de contacto. Capturas y validación del diseño:
`artifacts/coordinacion-compacta/` y [VALIDACION.md](docs/VALIDACION.md).

El modo API persiste también contacto, preferencias, avisos internos, lectura de notificaciones,
solicitudes de cambio de tutor, habilitación de cuentas, actividades del plan, configuración
del periodo y seguimiento administrativo de derivaciones e insumos. Los formularios confirman
el guardado del servidor y conservan lo editado ante un rechazo; las versiones antiguas se rechazan.
El tutor puede cancelar o reprogramar convocatorias, conservando el historial.

Se eliminan borradores propios de avisos y F08/F12 sin envío previo, y actividades planificadas
sin ejecución ni informe enviado. Los documentos enviados, asistencias y sesiones históricas
se conservan. Las cuentas se deshabilitan; no se borran sus antecedentes.
F01 reutiliza actividades/metas del plan y F02 resume los casos F08 sin copiar relatos personales.
El estudiante puede consultar sus entrevistas históricas enviadas y exportar sus respuestas en CSV.

La matriz funcional, las pruebas actuales y las limitaciones se encuentran al principio de
[VALIDACION.md](docs/VALIDACION.md). Faltan las conexiones institucionales de las nueve áreas,
el SSO universitario, el correo externo de Avisos y la emisión de documentos oficiales firmados.
La verificación de cuentas y sus invitaciones sí disponen de transporte SMTP.

## Entrevistas por ciclo · 30 de octubre de 2026

Primeros ciclos (1–3): formato 03; intermedios (4–7): 04; finales (8–10): 05.
El estudiante ve la entrevista de su etapa académica y puede recuperar una pendiente
durante el semestre abierto. La precarga se conserva sin mostrar avisos ni bloques de datos
disponibles; solo se pregunta lo que falta. Los datos pueden actualizarse desde la revisión final.
El inicio, desarrollo y cierre del semestre no cambian el tipo de entrevista.

Se revisaron visualmente los doce anexos. El detalle de la reutilización por instrumento
está en [MIGRACION.md](docs/MIGRACION.md). Verificación actual: gate 7/7, 180 pruebas frontend,
66 backend, 20 recorridos demo, 11 API, 44 rutas a seis anchos y 18 combinaciones de ciclo/ancho;
[evidencias y límites](docs/VALIDACION.md).

## Persistencia de tutoría · 28 de octubre de 2026

El modo predeterminado es `VITE_DATA_SOURCE=api`. Formularios, expediente reutilizable,
sesiones, asistencia, revisiones, asignaciones y momento del semestre usan la API. Un error
HTTP no activa la demostración ni guarda una copia local como si la operación hubiera pasado.
La API comprueba identidad habilitada, rol, escuela, asignación vigente, responsable,
versión del registro, ciclo y momento del semestre. No confía en identidades del cuerpo HTTP.

La asistencia requiere una sesión finalizada según el reloj del servidor. Al confirmarla se
actualizan, en una transacción, la sesión y un único formato 06/07 con los participantes
presentes. F10/F11 se habilitan por sesión para quienes figuran como presentes o tardanza,
independientemente de su ciclo. Las evaluaciones enviadas no permiten convertir su asistencia
en falta desde el registro ordinario. F08 genera F12 o una nueva cita de seguimiento en la
misma transacción; un error revierte también el formulario y el expediente.

Preparación local autorizada, sin instalar un servicio de Windows:

```powershell
./scripts/Preparar-Postgres.ps1
./scripts/Start-Backend.ps1
# En otra terminal:
./scripts/Start-Frontend.ps1
```

PostgreSQL portable 18.6 escucha solo en `127.0.0.1:5449`. Las bases son `tutoria_unas` y
`tutoria_unas_tests`; el rol de la aplicación no es superusuario. Los datos y las claves
generadas quedan en `%LOCALAPPDATA%/TutoriaUNAS/postgresql-18.6/`. La conexión se escribe en
`backend/TutoriaUNAS.Api/appsettings.Development.local.json` y la selección del frontend en
`frontend/.env.local`, ambos ignorados por Git. Vuelve a ejecutar el preparador para iniciar
PostgreSQL después de reiniciar el equipo. No borra ni reinicializa una base existente.

Si el login no funciona, comprueba `/health/ready` y `/api/status` en el puerto de
`frontend/.env.local` (actualmente 5082): este último debe indicar `databaseEnabled=true`.
Ejecuta el preparador para levantar la base y usa `scripts/Start-Backend.ps1` para iniciar
la API con su configuración local. Un `dotnet run` sin `TUTORIA_LOCAL_CONFIG` no carga
`appsettings.Development.local.json`. En Development se desactiva únicamente el proveedor
EventLog de Windows para evitar que la falta de permisos interrumpa las respuestas HTTP;
los demás proveedores de logs permanecen activos.

Solo en Development, con `LocalDevelopment:Enabled=true`, `/api/auth/login` acepta las cuentas
ficticias: estudiante `2023010456`, tutor `DOC-0421`, coordinación `coordinacion.tutoria`;
contraseña de prueba `tutoria2026`. Las contraseñas se almacenan como hash y el servidor emite
un token protegido de ocho horas. Este acceso se rechaza fuera de Development. Las cuentas
institucionales verificadas usan su propio esquema protegido y se habilitan expresamente con
`Cuentas:Enabled`. La integración opcional con un proveedor JWT universitario exige configurar
Authority/Audience y vincular su `iss/sub` con usuarios, personas y roles activos de la base;
su SSO sigue pendiente. El padrón real autorizado ya está cargado.

El esquema se aplica con scripts SQL versionados y checksum (`SchemaRunner`); el primer
script proviene del modelo EF Core. Un script ya aplicado no se modifica: los cambios
posteriores requieren otro script. El arranque local aplica migraciones y semilla solo con
las opciones explícitas del archivo Development. En despliegue se ejecuta `--migrate`
expresamente y se mantiene `Tutoria:SeedDemo=false`. La comprobación `/health/ready` consulta
PostgreSQL; `/health` verifica únicamente el proceso.

Verificación repetible: `./scripts/Test-Postgres.ps1` ejecuta la suite .NET con PostgreSQL
real en esquemas aislados de la base `_tests`, incluyendo concurrencia y reinicio del host.
`pnpm exec playwright test --config playwright.api.config.ts` comprueba el flujo entre dos
navegadores contra la API local. La batería demo usa el puerto 5188 y selecciona `demo`
explícitamente. Los avisos internos y las preferencias usan PostgreSQL. El envío de correo
externo de Avisos y las fuentes institucionales requieren sus servicios reales. El correo de
activación/recuperación de cuentas usa la cola SMTP descrita arriba. La API admite bloques
personales de calendario; su editor no forma parte del módulo Sesiones actual.

**Sesiones es el único módulo para consultar y gestionar las sesiones de tutoría en los
tres roles.** Incluye el calendario mensual/semanal y el detalle de cada sesión. No hay
un módulo Calendario o Horarios separado ni bloques de disponibilidad en esta vista;
los enlaces antiguos redirigen a Sesiones.

Sesiones abre en **Semana** para todos los roles. Agenda muestra las sesiones programadas o
reprogramadas; Historial, las realizadas. Seleccionar una fecha conserva el período visible.
El tutor registra la asistencia en **Asistencias**, con columnas Asistió/Faltó y círculos
excluyentes. El acuerdo y la cantidad de asistentes aparecen en el detalle de la sesión,
sin listas de estudiantes. En modo API el registro se envía a .NET y PostgreSQL; en modo
demo se conserva en `localStorage` del navegador de demostración.

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
contactos declarados. La trayectoria y los datos estables de perfil se reutilizan entre semestres; la salud y el contexto del periodo requieren información vigente. Los envíos
rechazados no cambian esa fuente y los enviados conservan su contenido. La versión anterior
de la caché deja de usarse por no registrar semestre; los borradores del workspace permanecen.
La ficha del tutor restringe el acceso a sus asignaciones activas y recibe estados de salud sin
motivo médico. Una identidad estudiantil desconocida ya no muestra otro expediente.
Los controles del flujo persistente se aplican también en .NET; las conexiones institucionales
deben incorporar sus permisos y padrón aprobados antes de usar datos reales.

- Estudiante: **Mi tutoría → Mis formularios**. Entrevista 03 (ciclos 1 a 3), 04 (ciclos 4 a 7)
  o 05 (ciclos 8 a 10) según la etapa académica. Se recomienda completarla al inicio; una entrevista pendiente se puede recuperar durante el semestre abierto. Evaluaciones 10 y 11 por cada sesión
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

El modo `demo` conserva el avance y el momento del semestre en `sessionStorage` de **la misma
pestaña**, al recargar y cambiar de rol. El selector de momento permite probar inicio,
desarrollo y cierre; no representa una apertura institucional. Cerrar la pestaña elimina esa
persistencia. No hay sincronización entre dispositivos, firma electrónica ni envío a servicios
externos. El modo `api` usa PostgreSQL para estos flujos y sincroniza al recargar, recuperar el
foco y cada diez segundos. El cierre oficial, las firmas y los servicios externos siguen pendientes.

En modo API la programación y asistencia se guardan en PostgreSQL. El tutor programa una sesión
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

Para una demostración sin servidor configura `VITE_DATA_SOURCE=demo` explícitamente antes
de iniciar Vite. Para persistencia usa `.env.example` o el preparador local y ejecuta también
la API. Ejecutar `dotnet run` directamente requiere configurar la conexión mediante variables
de entorno; `Start-Backend.ps1` carga el archivo local ignorado durante Development.

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
- Avisos del estudiante con los filtros compartidos de Formularios, lista breve y preferencias
  en una ventana aparte. La lectura se sincroniza con el menú y la campana; el estado y las
  preferencias se guardan por estudiante en este navegador. El correo sigue siendo simulado.
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

`AuthService` selecciona el adaptador de autenticación según el modo. En modo API,
`apiTutoria` carga únicamente el ámbito autorizado por .NET y alimenta `usePortal` y el
workspace; el expediente reutilizable procede del servidor. `src/data` mantiene catálogos
y la demostración explícita. DIAA, Recursos Humanos y Bienestar aún deben habilitar sus fuentes.

## API y variables de entorno

La API usa controladores, servicios por inyección de dependencias, DTOs, Problem Details,
CORS con orígenes explícitos, OpenAPI y EF Core PostgreSQL. `SchemaRunner` aplica scripts
versionados mediante la opción local de Development o `--migrate`. `/health` comprueba el
proceso; `/health/ready` consulta las tablas de PostgreSQL.

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
usa el selector visual para conceder permisos. El login ficticio de desarrollo comprueba la
cuenta y contraseña en PostgreSQL, y emite su token únicamente con la opción local habilitada.
En producción se ocultan Swagger, el resumen ficticio y el login de prueba; se habilitan
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
incluye expectativas antiguas y defectos reproducidos. Esa auditoría es histórica: la
persistencia de tutoría y la autoría persistente de F01 se incorporaron el 28 de octubre.
Los documentos oficiales, las integraciones y los hallazgos ajenos a estos flujos siguen pendientes.
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
2. Acordar retención, acceso de áreas especializadas y distribución del padrón con la universidad.
3. Revisar el esquema y migraciones implementados con TI y preparar copias de seguridad.
4. Conectar el proveedor institucional, vincular `iss/sub` y completar su acceso/renovación/salida.
5. Conectar las fuentes autorizadas de matrícula, RRHH y Bienestar y retirar la semilla ficticia.
6. Completar documentos oficiales, firmas, avisos y demás módulos fuera del flujo persistente.
7. Incorporar recuperación real, contactos verificados y política institucional aprobada.

El modelo actual incluye personas, cuentas, periodos, asignaciones, matrícula, horarios,
sesiones, asistencia, instrumentos, expediente y auditoría. Su uso local se verificó con
PostgreSQL. El contrato y permisos definitivos de las áreas externas requieren validación
institucional. El proyecto `login-unas` permanece intacto.

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

Las preferencias de presentación se guardan en el navegador. Desde el 28 de octubre,
sesiones, asistencia y formularios del modo API usan los registros persistentes de .NET.
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
