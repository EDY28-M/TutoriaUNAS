import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Field, TextInput } from '../../components/panels/Field';
import { Card, CardBody, CardHead } from '../../components/ui/Card';
import { PageHeading } from '../../components/ui/PageHeading';
import { Badge } from '../../components/ui/StatusBadge';
import { Timeline } from '../../components/ui/Timeline';
import { semestreActual } from '../../data/catalogos';
import { escuelaDe, iniciales } from '../../data/personas';
import type { Portal } from '../../hooks/usePortal';
import type { DemoUser } from '../../types/auth';
import { formatFecha } from '../../utils/fechas';
import '../../assets/vendor/fontawesome.min.css';
import '../../styles/tutor-profile.css';

export function TutorProfile({ user, portal }: { user: DemoUser; portal: Portal }) {
  const [guardado, setGuardado] = useState(false);
  const { docente, tutorados, derivaciones } = portal;
  if (!docente)
    return (
      <PageHeading
        eyebrow="Cuenta docente"
        title="Mi perfil"
        description="No hay una ficha docente asociada a esta cuenta."
      />
    );

  return (
    <div className="tutor-profile">
      <PageHeading
        eyebrow="Docente tutor · Cuenta"
        title="Mi perfil"
        description="Datos de tu cuenta y contacto en tutoría."
        actions={<Badge tone="dorado">Cuenta de prueba</Badge>}
      />
      <section className="profile-identity" aria-label="Identidad del docente">
        <div className="profile-identity__main">
          <span className="profile-avatar" aria-hidden="true">
            {iniciales(docente)}
          </span>
          <div>
            <span className="profile-eyebrow">Docente tutor</span>
            <h2>{user.name}</h2>
            <p>
              {docente.codigo} · {docente.categoria} · {docente.dedicacion}
            </p>
          </div>
          <Badge tone={docente.activo ? 'ok' : 'neutro'}>
            {docente.activo ? 'Activo y habilitado' : 'Vínculo concluido'}
          </Badge>
        </div>
        <div className="profile-contact">
          <a href={`mailto:${user.email}`}>
            <i className="fa-regular fa-envelope" aria-hidden="true" />
            {user.email}
          </a>
          <a href={`tel:${docente.telefono.replace(/\s/g, '')}`}>
            <i className="fa-solid fa-phone" aria-hidden="true" />
            {docente.telefono}
          </a>
          <span>
            <i className="fa-regular fa-calendar" aria-hidden="true" />
            {semestreActual}
          </span>
        </div>
        <div className="profile-activity" aria-label="Resumen de tu tutoría">
          <Link to="/tutor/tutorados">
            <strong>{tutorados.length}</strong>
            <span>Estudiantes asignados</span>
            <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
          <div>
            <strong>{docente.cursosAsignados.length}</strong>
            <span>Cursos del semestre</span>
          </div>
          <Link to="/tutor/derivaciones">
            <strong>{derivaciones.length}</strong>
            <span>Solicitudes de apoyo</span>
            <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="profile-panels">
        <Card>
          <CardHead title="Datos del docente" description="Información de Recursos Humanos" />
          <CardBody>
            <dl className="profile-meta">
              <div className="profile-meta__wide">
                <dt>Departamento</dt>
                <dd>{docente.departamento}</dd>
              </div>
              <div className="profile-meta__wide">
                <dt>Escuela profesional</dt>
                <dd>{escuelaDe(docente.escuelaId)}</dd>
              </div>
              <div>
                <dt>Categoría</dt>
                <dd>{docente.categoria}</dd>
              </div>
              <div>
                <dt>Dedicación</dt>
                <dd>{docente.dedicacion}</dd>
              </div>
              <div>
                <dt>Cupos de tutoría</dt>
                <dd>Hasta {docente.aforoMaximo} estudiantes</dd>
              </div>
              <div>
                <dt>Ámbito institucional</dt>
                <dd>Vicerrectorado Académico</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHead
            title="Contacto en tutoría"
            description="Puedes actualizar estos datos de contacto"
          />
          <CardBody>
            <form
              className="profile-form"
              onChange={() => setGuardado(false)}
              onSubmit={(event) => {
                event.preventDefault();
                setGuardado(true);
              }}
            >
              <Field
                id="perfil-correo"
                label="Correo de contacto"
                hint="Se usa para los avisos del sistema."
              >
                <TextInput id="perfil-correo" type="email" required defaultValue={user.email} />
              </Field>
              <Field id="perfil-telefono" label="Teléfono o anexo">
                <TextInput id="perfil-telefono" type="tel" defaultValue={docente.telefono} />
              </Field>
              <p>Los datos oficiales se corrigen con el área responsable.</p>
              <footer>
                <span role="status">
                  {guardado
                    ? 'Cambios guardados en la demostración.'
                    : 'En esta demostración los cambios no se persisten.'}
                </span>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-check" aria-hidden="true" />
                  Guardar cambios
                </button>
              </footer>
            </form>
          </CardBody>
        </Card>
      </div>

      <details className="profile-details">
        <summary>
          <i className="fa-regular fa-id-card" aria-hidden="true" />
          <span>Datos de la cuenta</span>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </summary>
        <dl className="profile-meta">
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
            <dd>Tutor</dd>
          </div>
          <div>
            <dt>Semestre</dt>
            <dd>{semestreActual}</dd>
          </div>
        </dl>
        <p className="profile-note">
          Datos ficticios para probar el sistema. No corresponden a una cuenta real de la
          universidad.
        </p>
      </details>
      <details className="profile-details">
        <summary>
          <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          <span>Seguridad y acceso</span>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </summary>
        <ul className="profile-security">
          <li>
            <strong>Sesión de demostración</strong>
            <p>
              La contraseña se valida con cuentas ficticias. Solo se conserva el identificador en
              esta pestaña.
            </p>
          </li>
          <li>
            <strong>Inicio de sesión institucional</strong>
            <p>El acceso con una cuenta real de la universidad aún no está disponible.</p>
          </li>
          <li>
            <strong>Acceso y recuperación por habilitar</strong>
            <p>El área de tecnología debe habilitar el acceso y la recuperación de cuentas.</p>
          </li>
        </ul>
      </details>
      <details className="profile-details">
        <summary>
          <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
          <span>Actividad reciente</span>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </summary>
        <Timeline
          etiqueta="Actividad de la cuenta"
          hitos={[
            {
              titulo: 'Inicio de sesión en el portal',
              descripcion: 'Acceso como Tutor en el entorno de demostración.',
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
      </details>
    </div>
  );
}
