import { useMemo, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import {
  BadgeCheck,
  Ban,
  Check,
  Download,
  Eye,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Scale,
  ShieldCheck,
  Trash,
  UserRound,
  Users,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Stat } from '../../components/ui/Stat';
import { Badge } from '../../components/ui/StatusBadge';
import { TabPanel, Tabs } from '../../components/ui/Tabs';
import { permisos } from '../../data/institucional';
import { abreviaturaEscuela } from '../../data/personas';
import { usePortal } from '../../hooks/usePortal';
import type { AccionPermiso, PermisoRol } from '../../types/domain';
import { downloadCsv } from '../../utils/csv';

const ROLES: Array<PermisoRol['rol']> = ['estudiante', 'tutor', 'coordinacion', 'administracion'];

const ACCIONES: AccionPermiso[] = [
  'ver',
  'crear',
  'editar',
  'revisar',
  'aprobar',
  'descargar',
  'eliminar',
];

/** Etiqueta legible del rol del sistema. */
function etiquetaRol(rol: PermisoRol['rol']): string {
  if (rol === 'estudiante') return 'Estudiante';
  if (rol === 'tutor') return 'Docente tutor';
  if (rol === 'coordinacion') return 'Coordinación';
  return 'Administración';
}

/** Etiqueta corta del rol para las pestañas. */
function etiquetaRolCorta(rol: PermisoRol['rol']): string {
  if (rol === 'estudiante') return 'Estudiante';
  if (rol === 'tutor') return 'Tutor';
  if (rol === 'coordinacion') return 'Coordinación';
  return 'Administración';
}

/** Etiqueta legible de la acción permitida. */
function etiquetaAccion(accion: AccionPermiso): string {
  if (accion === 'ver') return 'Ver';
  if (accion === 'crear') return 'Crear';
  if (accion === 'editar') return 'Editar';
  if (accion === 'revisar') return 'Revisar';
  if (accion === 'aprobar') return 'Aprobar';
  if (accion === 'descargar') return 'Descargar';
  return 'Eliminar';
}

/** Icono de cada acción del sistema. */
function iconoAccion(accion: AccionPermiso) {
  if (accion === 'ver') return <Eye aria-hidden="true" />;
  if (accion === 'crear') return <Plus aria-hidden="true" />;
  if (accion === 'editar') return <Pencil aria-hidden="true" />;
  if (accion === 'revisar') return <ShieldCheck aria-hidden="true" />;
  if (accion === 'aprobar') return <BadgeCheck aria-hidden="true" />;
  if (accion === 'descargar') return <Download aria-hidden="true" />;
  return <Trash aria-hidden="true" />;
}

/**
 * Tabla de roles y permisos del sistema: recursos por rol con las acciones
 * permitidas (ver, crear, editar, revisar, aprobar, descargar y eliminar),
 * el detalle de acciones por rol y las notas de protección de datos personales.
 */
export function CoordPermissions() {
  const portal = usePortal();
  const [pestana, setPestana] = useState<PermisoRol['rol'] | 'matriz'>('matriz');

  const porRol = useMemo(
    () =>
      ROLES.map((rol) => ({
        rol,
        filas: permisos.filter((permiso) => permiso.rol === rol),
      })),
    [],
  );

  const recursos = useMemo(() => [...new Set(permisos.map((permiso) => permiso.recurso))], []);

  const permisoDe = (rol: PermisoRol['rol'], recurso: string): PermisoRol | undefined =>
    permisos.find((permiso) => permiso.rol === rol && permiso.recurso === recurso);

  const totalAcciones = permisos.reduce((total, permiso) => total + permiso.acciones.length, 0);
  const conEliminar = permisos.filter((permiso) => permiso.acciones.includes('eliminar')).length;
  const conDescarga = permisos.filter((permiso) => permiso.acciones.includes('descargar')).length;
  const conAprobacion = permisos.filter((permiso) => permiso.acciones.includes('aprobar')).length;

  function exportarTabla() {
    const filas: string[][] = [
      ['Tabla de roles y permisos · Sistema de Tutoría UNAS'],
      [
        'Nota',
        'Los datos personales se tratan conforme a la Ley N.º 29733 y al principio de minimización.',
      ],
      [],
      ['Recurso', ...ROLES.map((rol) => etiquetaRol(rol))],
    ];
    for (const recurso of recursos) {
      filas.push([
        recurso,
        ...ROLES.map((rol) => {
          const permiso = permisoDe(rol, recurso);
          return permiso
            ? permiso.acciones.map((accion) => etiquetaAccion(accion)).join(' | ')
            : '—';
        }),
      ]);
    }
    filas.push([]);
    filas.push(['Rol', 'Recurso', 'Acciones']);
    for (const permiso of permisos) {
      filas.push([
        etiquetaRol(permiso.rol),
        permiso.recurso,
        permiso.acciones.map((accion) => etiquetaAccion(accion)).join(' | '),
      ]);
    }
    downloadCsv(filas, 'matriz-roles-permisos.csv');
  }

  return (
    <>
      <PageHeading
        eyebrow={`Gestión institucional · Roles y permisos · ${abreviaturaEscuela(portal.escuelaId)}`}
        title="Accesos y permisos"
        description="Consulta qué información puede ver y qué acciones puede realizar cada perfil."
        actions={
          <>
            <Badge tone="info">{permisos.length} asignaciones</Badge>
            <button type="button" className="btn btn-falcon-default" onClick={exportarTabla}>
              <Download aria-hidden="true" /> Descargar tabla de accesos
            </button>
          </>
        }
      />

      <div className="grid grid--4">
        <Stat
          label="Roles del sistema"
          value={ROLES.length}
          note="Estudiante, tutor, coordinación y administración"
          icon={<Users aria-hidden="true" />}
        />
        <Stat
          label="Secciones con acceso"
          value={recursos.length}
          note={`${totalAcciones} acciones concedidas en total`}
          icon={<KeyRound aria-hidden="true" />}
          tone="info"
        />
        <Stat
          label="Con aprobación y revisión"
          value={conAprobacion}
          note="Solo coordinación y administración aprueban"
          icon={<ShieldCheck aria-hidden="true" />}
          tone="violeta"
        />
        <Stat
          label="Con descarga habilitada"
          value={conDescarga}
          note={`${conEliminar} recursos permiten eliminar`}
          icon={<Download aria-hidden="true" />}
          tone={conDescarga ? 'dorado' : 'verde'}
        />
      </div>

      <Alert tone="info" title="Protección de datos personales (Ley N.º 29733)">
        <Scale aria-hidden="true" /> El acceso se limita a lo necesario para la finalidad tutorial:
        el tutor ve a sus estudiantes asignados y el estudiante, su propio expediente. No se expone
        historia clínica ni diagnóstico; solo el estado de la atención y la recomendación
        comunicable autorizada por el área. Toda descarga queda registrada en la auditoría.
      </Alert>

      <Card>
        <CardHead
          title="Qué puede hacer cada perfil"
          description="Una marca indica que la acción está permitida. Un guion indica que no lo está."
          actions={<Badge tone="alerta">Requiere validación de la autoridad</Badge>}
        />
        <CardBody>
          <div className="stack">
            <Tabs
              etiqueta="Vistas de accesos y permisos"
              activo={pestana}
              onChange={(id) => setPestana(id as typeof pestana)}
              items={[
                { id: 'matriz', label: 'Tabla de accesos' },
                ...ROLES.map((rol) => ({
                  id: rol,
                  label: etiquetaRolCorta(rol),
                  count: porRol.find((fila) => fila.rol === rol)?.filas.length ?? 0,
                })),
              ]}
            />

            <TabPanel id="matriz" activo={pestana}>
              <div
                className="table-wrap"
                role="region"
                aria-label="Tabla de secciones y perfiles"
                tabIndex={0}
              >
                <table className="data-table">
                  <caption>
                    Tabla de secciones y perfiles con las acciones permitidas en el Sistema de
                    Tutoría UNAS
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Sección</th>
                      {ROLES.map((rol) => (
                        <th key={rol} scope="col">
                          {etiquetaRol(rol)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recursos.map((recurso) => (
                      <tr key={recurso}>
                        <th scope="row" style={{ textTransform: 'none' }}>
                          {recurso}
                        </th>
                        {ROLES.map((rol) => {
                          const permiso = permisoDe(rol, recurso);
                          return (
                            <td key={`${rol}-${recurso}`}>
                              {permiso ? (
                                <span className="ui-row ui-row--tight ui-row--wrap">
                                  {permiso.acciones.map((accion) => (
                                    <Badge
                                      key={accion}
                                      tone={accion === 'eliminar' ? 'riesgo' : 'ok'}
                                    >
                                      <span aria-hidden="true">{iconoAccion(accion)}</span>
                                      {etiquetaAccion(accion)}
                                    </Badge>
                                  ))}
                                </span>
                              ) : (
                                <span className="muted" aria-label="Sin acceso">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted">
                Acciones del sistema: {ACCIONES.map((accion) => etiquetaAccion(accion)).join(' · ')}
                . La acción «eliminar» solo se concede a la administración y nunca sobre expedientes
                académicos.
              </p>
            </TabPanel>

            {ROLES.map((rol) => (
              <TabPanel key={rol} id={rol} activo={pestana}>
                <Card flat>
                  <CardHead
                    title={`Acciones del rol: ${etiquetaRol(rol)}`}
                    description={`${porRol.find((fila) => fila.rol === rol)?.filas.length ?? 0} recursos accesibles`}
                  />
                  <CardBody flush>
                    <ul className="list">
                      {(porRol.find((fila) => fila.rol === rol)?.filas ?? []).map((permiso) => (
                        <li className="list__item" key={permiso.id}>
                          <span
                            className={`list__icon list__icon--${rol === 'administracion' ? 'violet' : rol === 'coordinacion' ? 'info' : 'ok'}`}
                            aria-hidden="true"
                          >
                            <UserRound />
                          </span>
                          <span className="list__body">
                            <strong>{permiso.recurso}</strong>
                            <p>
                              {permiso.acciones.map((accion) => etiquetaAccion(accion)).join(' · ')}
                            </p>
                            <span className="list__meta">
                              <span className="mono">{permiso.id}</span>
                              <span>
                                {permiso.acciones.length} de {ACCIONES.length} acciones
                              </span>
                            </span>
                            <span className="list__meta">
                              {ACCIONES.map((accion) => (
                                <Badge
                                  key={accion}
                                  tone={permiso.acciones.includes(accion) ? 'ok' : 'neutro'}
                                >
                                  {permiso.acciones.includes(accion) ? (
                                    <Check aria-hidden="true" />
                                  ) : (
                                    <Ban aria-hidden="true" />
                                  )}
                                  {etiquetaAccion(accion)}
                                </Badge>
                              ))}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                  <CardFoot>
                    <span>
                      El rol {etiquetaRol(rol).toLowerCase()} no accede a recursos fuera de su
                      ámbito declarado.
                    </span>
                  </CardFoot>
                </Card>
              </TabPanel>
            ))}
          </div>
        </CardBody>
        <CardFoot>
          <span>
            Toda ampliación de permisos requiere la aprobación de Tutoría y Capacitación Docente y
            queda registrada en la auditoría del sistema.
          </span>
          <span className="ui-row ui-row--tight">
            <Lock aria-hidden="true" /> La sesión de demostración no aplica restricciones reales de
            seguridad.
          </span>
        </CardFoot>
      </Card>

      <div className="grid grid--2">
        <Card accent>
          <CardHead
            title="Información visible para cada perfil"
            description="Cada persona accede solo a los datos que le corresponden."
          />
          <CardBody>
            <dl className="def-list">
              <div>
                <dt>Estudiante</dt>
                <dd>
                  Ve su expediente, sus formularios, sus sesiones, sus avisos y las recomendaciones
                  comunicables de sus solicitudes de apoyo. No ve información de otros estudiantes.
                </dd>
              </div>
              <div>
                <dt>Docente tutor</dt>
                <dd>
                  Ve a sus estudiantes asignados y el estado de la atención de las solicitudes de
                  apoyo que registró. No accede a historia clínica ni a diagnósticos.
                </dd>
              </div>
              <div>
                <dt>Coordinación de tutoría</dt>
                <dd>
                  Ve las asignaciones, los informes y los reportes de su facultad o escuela; revisa
                  y aprueba los formatos 01 y 02 de su ámbito.
                </dd>
              </div>
              <div>
                <dt>Administración</dt>
                <dd>
                  Configura formularios, versiones, roles, catálogos y consulta la auditoría
                  institucional.
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Controles de privacidad" description="Reglas verificables del sistema" />
          <CardBody flush>
            <ul className="list">
              <li className="list__item">
                <span className="list__icon list__icon--danger" aria-hidden="true">
                  <Ban />
                </span>
                <span className="list__body">
                  <strong>Bloqueo de consultas no autorizadas</strong>
                  <p>
                    Un intento de acceder a datos de salud sin autorización queda registrado como
                    acceso bloqueado en la auditoría.
                  </p>
                </span>
              </li>
              <li className="list__item">
                <span className="list__icon list__icon--warn" aria-hidden="true">
                  <Download />
                </span>
                <span className="list__body">
                  <strong>Historial de descargas</strong>
                  <p>
                    Cada descarga de reportes o formularios se registra con su autor, fecha e IP de
                    origen.
                  </p>
                </span>
              </li>
              <li className="list__item">
                <span className="list__icon list__icon--ok" aria-hidden="true">
                  <Eye />
                </span>
                <span className="list__body">
                  <strong>Información autorizada</strong>
                  <p>
                    El tutor solo ve el estado de la atención y la recomendación autorizada, con su
                    vigencia, de las solicitudes de apoyo de sus estudiantes.
                  </p>
                </span>
              </li>
              <li className="list__item">
                <span className="list__icon list__icon--info" aria-hidden="true">
                  <Lock />
                </span>
                <span className="list__body">
                  <strong>Consentimiento y finalidad</strong>
                  <p>
                    La ficha de derivación consigna si el estudiante autoriza la comunicación de la
                    información necesaria.
                  </p>
                </span>
              </li>
            </ul>
          </CardBody>
          <CardFoot>
            <span>
              Base normativa: Ley N.º 29733 de Protección de Datos Personales y Resolución N.º
              500-2022-CU-R-UNAS.
            </span>
          </CardFoot>
        </Card>
      </div>
    </>
  );
}
