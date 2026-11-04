import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardHead } from '../ui/Card';
import { PageHeading } from '../ui/PageHeading';
import { Badge, StatusBadge } from '../ui/StatusBadge';
import { ContactoPersistente } from './ContactoPersistente';
import { Field, TextInput } from './Field';
import { useSistema } from '../../hooks/useSistema';
import type { Portal } from '../../hooks/usePortal';
import type { DemoUser } from '../../types/auth';
import { API_MODE } from '../../services/apiConfig';
import { escuelaDe } from '../../data/personas';
import { semestreActual } from '../../data/catalogos';
import { formatFecha, formatFechaHora } from '../../utils/fechas';
import { roleDetails } from '../../utils/roles';
import '../../styles/tutor-profile.css';

/** Una sola ficha de cuenta; cambian los datos y accesos propios del rol. */
export function AccountProfile({ user, portal }: { user: DemoUser; portal: Portal }) {
  const sistema = useSistema();
  const cuentaDePrueba = !API_MODE || sistema?.accesoLocal === true;
  const [guardado, setGuardado] = useState(false);
  const { estudiante, docente, tutor, asignacion, escuelaId } = portal;
  const nombreRol = roleDetails[user.role].label;
  const correo = sistema?.contacto.correo ?? user.email;
  const telefono = sistema?.contacto.telefono ?? estudiante?.telefono ?? docente?.telefono ?? '';
  const iniciales = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('');
  const datos =
    user.role === 'estudiante' && estudiante
      ? [
          ['Escuela profesional', escuelaDe(escuelaId)],
          ['Ciclo', String(estudiante.ciclo ?? 'Sin informar')],
          ['Grupo de tutoría', asignacion?.grupo ?? 'Por asignar'],
          ['Docente tutor', tutor ? `${tutor.nombres} ${tutor.apellidos}` : 'Por asignar'],
          ['Ingreso', formatFecha(estudiante.ingreso)],
        ]
      : user.role === 'tutor' && docente
        ? [
            ['Escuela profesional', escuelaDe(escuelaId)],
            ['Departamento', docente.departamento],
            ['Categoría', docente.categoria ?? 'Sin informar'],
            ['Dedicación', docente.dedicacion ?? 'Sin informar'],
            ['Cupos de tutoría', String(docente.aforoMaximo ?? 'Sin informar')],
          ]
        : [
            ['Escuela profesional', escuelaDe(escuelaId)],
            ['Área', 'Coordinación de tutoría'],
            ['Ámbito', 'Vicerrectorado Académico'],
          ];
  const actividad = sistema?.actividadCuenta ?? [];
  return (
    <div className="tutor-profile">
      <PageHeading
        eyebrow={`${nombreRol} · Cuenta`}
        title="Mi perfil"
        actions={
          <Badge tone={cuentaDePrueba ? 'dorado' : 'ok'}>
            {cuentaDePrueba ? 'Cuenta de prueba' : 'Cuenta institucional'}
          </Badge>
        }
      />
      <section className="profile-identity" aria-label="Datos de tu perfil">
        <div className="profile-identity__main">
          <span className="profile-avatar" aria-hidden="true">
            {iniciales}
          </span>
          <div>
            <span className="profile-eyebrow">{nombreRol}</span>
            <h2>{user.name}</h2>
            <p>{user.identifier}</p>
          </div>
          {estudiante ? (
            <StatusBadge estado={estudiante.estado} />
          ) : (
            <Badge tone="ok">Habilitada</Badge>
          )}
        </div>
        <div className="profile-contact">
          <a href={`mailto:${correo}`}>
            <i className="fa-regular fa-envelope" aria-hidden="true" />
            {correo}
          </a>
          {telefono && (
            <a href={`tel:${telefono.replace(/\s/g, '')}`}>
              <i className="fa-solid fa-phone" aria-hidden="true" />
              {telefono}
            </a>
          )}
          <span>
            <i className="fa-regular fa-calendar" aria-hidden="true" />
            {semestreActual}
          </span>
        </div>
        <div className="profile-activity" aria-label="Accesos de tu perfil">
          <Link to={`/${user.role}/sesiones`}>
            <strong>{portal.sesiones.length}</strong>
            <span>Sesiones</span>
            <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
          <Link to={`/${user.role}/${user.role === 'estudiante' ? 'instrumentos' : 'tutorados'}`}>
            <strong>
              {user.role === 'estudiante' ? portal.instrumentos.length : portal.tutorados.length}
            </strong>
            <span>{user.role === 'estudiante' ? 'Formularios' : 'Estudiantes'}</span>
            <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
          <Link to={`/${user.role}/avisos`}>
            <i className="fa-regular fa-envelope" aria-hidden="true" />
            <span>Avisos</span>
            <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
        </div>
      </section>
      <div className="profile-panels">
        <Card>
          <CardHead
            title={
              user.role === 'estudiante'
                ? 'Datos académicos'
                : user.role === 'tutor'
                  ? 'Datos del docente'
                  : 'Datos de coordinación'
            }
          />
          <CardBody>
            <dl className="profile-meta">
              {datos.map(([label, value], i) => (
                <div key={label} className={i === 0 ? 'profile-meta__wide' : undefined}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Contacto en tutoría" />
          <CardBody>
            {API_MODE ? (
              <ContactoPersistente />
            ) : (
              <form
                className="profile-form"
                onChange={() => setGuardado(false)}
                onSubmit={(e) => {
                  e.preventDefault();
                  setGuardado(true);
                }}
              >
                <Field id="perfil-correo" label="Correo de contacto">
                  <TextInput id="perfil-correo" type="email" required defaultValue={correo} />
                </Field>
                <Field id="perfil-telefono" label="Teléfono o anexo">
                  <TextInput id="perfil-telefono" type="tel" defaultValue={telefono} />
                </Field>
                <footer>
                  <span role="status">
                    {guardado ? 'Cambios de demostración; no se persisten.' : ''}
                  </span>
                  <button type="submit" className="btn btn-primary">
                    Guardar cambios
                  </button>
                </footer>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
      <details className="profile-details">
        <summary>
          <i className="fa-regular fa-id-card" aria-hidden="true" />
          <span>Cuenta y acceso</span>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </summary>
        <dl className="profile-meta">
          <div>
            <dt>Correo institucional</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Perfil</dt>
            <dd>{nombreRol}</dd>
          </div>
          <div>
            <dt>Acceso</dt>
            <dd>
              {cuentaDePrueba
                ? API_MODE
                  ? 'Cuenta local de desarrollo'
                  : 'Demostración'
                : 'Correo institucional verificado'}
            </dd>
          </div>
          <div>
            <dt>Datos oficiales</dt>
            <dd>Se actualizan con el área responsable.</dd>
          </div>
        </dl>
      </details>
      <details className="profile-details">
        <summary>
          <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
          <span>Actividad reciente</span>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </summary>
        {actividad.length ? (
          <ul className="profile-events">
            {actividad.slice(0, 6).map((a, i) => (
              <li key={`${a.fecha}-${i}`}>
                <strong>{a.titulo}</strong>
                <span>{a.descripcion}</span>
                <time dateTime={a.fecha}>{formatFechaHora(a.fecha)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="profile-note">Sin actividad registrada.</p>
        )}
      </details>
    </div>
  );
}
