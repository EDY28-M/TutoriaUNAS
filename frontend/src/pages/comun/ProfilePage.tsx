import { useState } from 'react';
import { Field, TextInput } from '../../components/panels/Field';
import { Alert } from '../../components/ui/Alert';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import {
  BookOpen,
  CalendarRange,
  IdCard,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Stat } from '../../components/ui/Stat';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { Timeline } from '../../components/ui/Timeline';
import { etapaAcademica, semestreActual } from '../../data/catalogos';
import { abreviaturaEscuela, escuelaDe } from '../../data/personas';
import { useAuth } from '../../hooks/useAuth';
import { usePortal } from '../../hooks/usePortal';
import { formatFecha } from '../../utils/fechas';
import { roleDetails } from '../../utils/roles';
import { TutorProfile } from '../tutor/TutorProfile';

/**
 * Perfil de la cuenta en uso. Se adapta al rol de la sesión: muestra los datos
 * del expediente del tutorado, del docente tutor o del ámbito de coordinación,
 * junto con la seguridad del acceso.
 */
export function ProfilePage() {
  const { user } = useAuth();
  const portal = usePortal();
  const { estudiante, docente, tutor, asignacion, escuelaId, sesiones, tutorados, derivaciones } =
    portal;
  const [guardado, setGuardado] = useState(false);

  if (!user) {
    return (
      <Alert tone="riesgo" title="Sesión no disponible">
        No se encontró una sesión activa.
      </Alert>
    );
  }

  const esEstudiante = user.role === 'estudiante';
  const esTutor = user.role === 'tutor';

  if (esTutor) return <TutorProfile user={user} portal={portal} />;

  return (
    <>
      <PageHeading
        eyebrow={`${roleDetails[user.role].label} · Cuenta`}
        title="Mi perfil"
        description="Revisa tus datos y actualiza tu información de contacto."
        actions={<Badge tone="dorado">Cuenta de prueba</Badge>}
      />

      <Alert tone="info" title="Datos de prueba">
        Estos datos son ficticios y sirven para probar el sistema. No corresponden a una cuenta real
        de la universidad.
      </Alert>

      <div className="grid grid--4">
        <Stat
          label="Rol en el sistema"
          value={roleDetails[user.role].label}
          note={`Sesión iniciada como ${user.identifier}`}
          icon={<ShieldCheck aria-hidden="true" />}
        />
        <Stat
          label="Corresponde a"
          value={
            esEstudiante
              ? abreviaturaEscuela(escuelaId)
              : esTutor
                ? abreviaturaEscuela(escuelaId)
                : 'Institucional'
          }
          note={esEstudiante ? escuelaDe(escuelaId) : 'Vicerrectorado Académico'}
          icon={<BookOpen aria-hidden="true" />}
          tone="info"
        />
        <Stat
          label="Actividad en el sistema"
          value={esEstudiante ? sesiones.length : esTutor ? tutorados.length : sesiones.length}
          note={
            esEstudiante
              ? 'Sesiones de tutoría'
              : esTutor
                ? 'Estudiantes asignados'
                : 'Sesiones registradas'
          }
          icon={<CalendarRange aria-hidden="true" />}
          tone="violeta"
        />
        <Stat
          label="Casos en seguimiento"
          value={derivaciones.length}
          note="Solicitudes de apoyo relacionadas con tu cuenta"
          icon={<UserRound aria-hidden="true" />}
          tone="dorado"
        />
      </div>

      <div className="grid grid--sidebar">
        <div className="stack">
          <Card>
            <CardHead
              title="Datos de la cuenta"
              description="Datos proporcionados por la universidad."
            />
            <CardBody>
              <dl className="def-list">
                <div>
                  <dt>Nombre completo</dt>
                  <dd>{user.name}</dd>
                </div>
                <div>
                  <dt>Identificador de acceso</dt>
                  <dd className="mono">{user.identifier}</dd>
                </div>
                <div>
                  <dt>Correo institucional</dt>
                  <dd>
                    <a href={`mailto:${user.email}`}>{user.email}</a>
                  </dd>
                </div>
                <div>
                  <dt>Rol</dt>
                  <dd>{roleDetails[user.role].label}</dd>
                </div>
                <div>
                  <dt>Semestre</dt>
                  <dd>{semestreActual}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {esEstudiante && estudiante && (
            <Card>
              <CardHead
                title="Datos del estudiante"
                description="Datos académicos y de contacto registrados en la universidad."
              />
              <CardBody>
                <dl className="meta-list">
                  <div>
                    <dt>Código universitario</dt>
                    <dd className="mono">{estudiante.codigo}</dd>
                  </div>
                  <div>
                    <dt>Escuela profesional</dt>
                    <dd>{escuelaDe(estudiante.escuelaId)}</dd>
                  </div>
                  <div>
                    <dt>Ciclo y etapa</dt>
                    <dd>
                      Ciclo {estudiante.ciclo} · {etapaAcademica[estudiante.etapa].etiqueta}
                    </dd>
                  </div>
                  <div>
                    <dt>Estado académico</dt>
                    <dd>
                      <StatusBadge estado={estudiante.estado} />
                    </dd>
                  </div>
                  <div>
                    <dt>Ingreso</dt>
                    <dd>{formatFecha(estudiante.ingreso)}</dd>
                  </div>
                  <div>
                    <dt>Grupo de tutoría</dt>
                    <dd>{asignacion?.grupo ?? 'Sin grupo'}</dd>
                  </div>
                  <div>
                    <dt>Docente tutor</dt>
                    <dd>{tutor ? `${tutor.nombres} ${tutor.apellidos}` : 'Por asignar'}</dd>
                  </div>
                  <div>
                    <dt>Teléfono registrado</dt>
                    <dd>{estudiante.telefono}</dd>
                  </div>
                </dl>
              </CardBody>
              <CardFoot>
                <span>
                  Los datos oficiales se corrigen en el área responsable, no en el sistema de
                  tutoría.
                </span>
              </CardFoot>
            </Card>
          )}

          {esTutor && docente && (
            <Card>
              <CardHead
                title="Datos del docente"
                description="Datos del docente proporcionados por Recursos Humanos."
              />
              <CardBody>
                <dl className="meta-list">
                  <div>
                    <dt>Código de docente</dt>
                    <dd className="mono">{docente.codigo}</dd>
                  </div>
                  <div>
                    <dt>Departamento</dt>
                    <dd>{docente.departamento}</dd>
                  </div>
                  <div>
                    <dt>Categoría y dedicación</dt>
                    <dd>
                      {docente.categoria} · {docente.dedicacion}
                    </dd>
                  </div>
                  <div>
                    <dt>Estado del vínculo</dt>
                    <dd>{docente.activo ? 'Activo y habilitado' : 'Vínculo concluido'}</dd>
                  </div>
                  <div>
                    <dt>Cupos de tutoría</dt>
                    <dd>Hasta {docente.aforoMaximo} estudiantes</dd>
                  </div>
                  <div>
                    <dt>Cursos asignados</dt>
                    <dd>{docente.cursosAsignados.length} curso(s) en el semestre</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHead
              title="Actualizar mis datos de contacto"
              description="Actualiza tu contacto en tutoría. Los datos oficiales los cambia el área responsable."
            />
            <CardBody>
              <div className="field-grid field-grid--2">
                <Field
                  id="perfil-correo"
                  label="Correo de contacto"
                  hint="Se usa para los avisos del sistema."
                >
                  <TextInput id="perfil-correo" type="email" defaultValue={user.email} />
                </Field>
                <Field id="perfil-telefono" label="Teléfono o anexo">
                  <TextInput
                    id="perfil-telefono"
                    type="tel"
                    defaultValue={estudiante?.telefono ?? docente?.telefono ?? ''}
                  />
                </Field>
              </div>
              <div className="ui-row ui-row--between ui-row--wrap" style={{ marginTop: 14 }}>
                <span className="small muted">
                  {guardado
                    ? 'Cambios guardados en la demostración.'
                    : 'En esta demostración los cambios no se persisten.'}
                </span>
                <button type="button" className="btn btn-primary" onClick={() => setGuardado(true)}>
                  Guardar cambios
                </button>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="stack">
          <Card accent>
            <CardHead
              title="Seguridad de la cuenta"
              description="Opciones de acceso a la cuenta."
            />
            <CardBody>
              <ul className="list">
                <li className="list__item">
                  <span className="list__icon list__icon--ok" aria-hidden="true">
                    <ShieldCheck />
                  </span>
                  <span className="list__body">
                    <strong>Sesión de demostración</strong>
                    <p>
                      La contraseña se valida contra las cuentas ficticias y solo el identificador
                      se conserva en la pestaña.
                    </p>
                  </span>
                </li>
                <li className="list__item">
                  <span className="list__icon list__icon--info" aria-hidden="true">
                    <IdCard />
                  </span>
                  <span className="list__body">
                    <strong>Inicio de sesión institucional</strong>
                    <p>El acceso con una cuenta real de la universidad aún no está disponible.</p>
                  </span>
                </li>
                <li className="list__item">
                  <span className="list__icon list__icon--warn" aria-hidden="true">
                    <ShieldCheck />
                  </span>
                  <span className="list__body">
                    <strong>Acceso institucional por habilitar</strong>
                    <p>
                      El área de tecnología debe habilitar el acceso y la recuperación de cuentas.
                    </p>
                  </span>
                </li>
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHead
              title="Actividad reciente de la cuenta"
              description="Últimos accesos y cambios registrados"
            />
            <CardBody>
              <Timeline
                etiqueta="Actividad de la cuenta"
                hitos={[
                  {
                    titulo: 'Inicio de sesión en el portal',
                    descripcion: `Acceso como ${roleDetails[user.role].label} en el entorno de demostración.`,
                    fecha: formatFecha('2026-10-14'),
                    tono: 'ok',
                  },
                  {
                    titulo: 'Consulta del expediente',
                    descripcion: 'Lectura de los datos académicos entregados por la DIAA.',
                    fecha: formatFecha('2026-10-14'),
                    tono: 'info',
                  },
                  {
                    titulo: 'Última actualización de contacto',
                    descripcion: 'Sin cambios registrados en el semestre.',
                    fecha: formatFecha('2026-09-07'),
                    tono: 'neutro',
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card flat>
            <CardBody>
              <p className="small muted">
                <Mail size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {user.email}{' '}
                · <Phone size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
                {estudiante?.telefono ?? docente?.telefono ?? 'sin teléfono'}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
