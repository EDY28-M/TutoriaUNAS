import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardHead } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/StatusBadge';
import { Progress } from '../../components/ui/Progress';
import { VistaPreviaHojas } from '../../components/formatos/FormatoOficial';
import { PortadaCierre } from '../../components/formatos/PortadaCierre';
import { docentePorId, nombreCompleto } from '../../data/personas';
import type { Asignacion, Instrumento, Sesion } from '../../types/domain';
import type { MomentoTutoria } from '../../utils/instrumentos';
import { esCierre, etiquetaAmbito, resumenCierre } from '../../utils/cierreSemestre';
import type { RequisitoCierre, ResumenCierre } from '../../utils/cierreSemestre';
import { hojasDe, nombreEscuela } from '../../utils/exportFormatos';
import { fechaActualLima } from '../../utils/fechas';

/** Cuántos pendientes se listan en pantalla; la portada exportada los incluye todos. */
const PENDIENTES_VISIBLES = 8;

function RequisitoItem({ requisito }: { requisito: RequisitoCierre }) {
  const { esperados, completos, pendientes, porRevisar, obligatorio } = requisito;
  // Sin registros esperados la barra queda vacía: «0/0» no es un requisito cumplido a la vista.
  const valor = esperados ? (100 * completos) / esperados : 0;
  return (
    <li className="fx-requisito">
      <Progress
        valor={valor}
        etiqueta={`${requisito.etiqueta} · ${completos}/${esperados}`}
        variante={!pendientes.length ? 'verde' : obligatorio ? 'alerta' : 'dorado'}
        mostrarValor={false}
      />
      <small>
        Formatos {requisito.formatos}
        {porRevisar > 0 && ` · ${porRevisar} por revisar`}
        {!obligatorio && ' · informativo, no bloquea el cierre'}
        {esperados === 0 && ' · no hay registros esperados en este ámbito'}
      </small>
      {pendientes.length > 0 && (
        <details className="fx-requisito__pendientes">
          <summary>{pendientes.length} pendiente(s)</summary>
          <ul>
            {pendientes.slice(0, PENDIENTES_VISIBLES).map((pendiente, i) => (
              <li key={i}>
                <span>{pendiente.referencia}</span>
                <small>{pendiente.situacion}</small>
              </li>
            ))}
          </ul>
          {pendientes.length > PENDIENTES_VISIBLES && (
            <p className="compact-note">
              Y {pendientes.length - PENDIENTES_VISIBLES} más: la portada del PDF los lista todos.
            </p>
          )}
        </details>
      )}
    </li>
  );
}

interface Props {
  semestreId: string;
  momento: MomentoTutoria;
  asignaciones: Asignacion[];
  sesiones: Sesion[];
  instrumentos: Instrumento[];
  onExportar(resumen: ResumenCierre, titulo: string): void;
}

/**
 * Paquete de cierre del semestre por escuela o tutor: avance de lo que exige
 * la resolución, detalle de pendientes y exportación con portada.
 */
export function CierreSemestre({
  semestreId,
  momento,
  asignaciones,
  sesiones,
  instrumentos,
  onExportar,
}: Props) {
  const id = useId();
  const [escuelaId, setEscuelaId] = useState('');
  const [tutorId, setTutorId] = useState('');
  const delSemestre = useMemo(
    () => asignaciones.filter((a) => a.semestreId === semestreId && a.estado !== 'reemplazada'),
    [asignaciones, semestreId],
  );
  const escuelasDisponibles = useMemo(
    () =>
      [...new Set(delSemestre.map((a) => a.escuelaId))].sort((a, b) =>
        nombreEscuela(a).localeCompare(nombreEscuela(b)),
      ),
    [delSemestre],
  );
  const tutoresDisponibles = useMemo(
    () =>
      [
        ...new Set(
          delSemestre.filter((a) => !escuelaId || a.escuelaId === escuelaId).map((a) => a.tutorId),
        ),
      ]
        .map((tutor) => {
          const docente = docentePorId(tutor);
          return { id: tutor, nombre: docente ? nombreCompleto(docente) : tutor };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [delSemestre, escuelaId],
  );
  // Un tutor que no pertenece a la escuela elegida deja de aplicar.
  const tutorVigente = tutoresDisponibles.some((t) => t.id === tutorId) ? tutorId : '';

  const resumen = useMemo(
    () =>
      resumenCierre({
        ambito: { semestreId, escuelaId: escuelaId || null, tutorId: tutorVigente || null },
        asignaciones,
        sesiones,
        instrumentos,
        momento,
      }),
    [semestreId, escuelaId, tutorVigente, asignaciones, sesiones, instrumentos, momento],
  );
  const cierre = esCierre(momento);
  const accion = cierre ? 'cierre' : 'avance';
  const titulo = `${cierre ? 'Cierre' : 'Avance'} del semestre ${semestreId}`;

  return (
    <div className="fx-layout">
      <Card className="fx-lista">
        <CardHead
          title="Ámbito"
          description="El cierre se arma por escuela; puedes acotarlo a un tutor."
        />
        <CardBody>
          <div className="fx-ambito">
            <div className="field">
              <label htmlFor={`${id}-escuela`}>Escuela profesional</label>
              <select
                id={`${id}-escuela`}
                className="select"
                value={escuelaId}
                onChange={(evento) => setEscuelaId(evento.target.value)}
              >
                <option value="">Todas las escuelas</option>
                {escuelasDisponibles.map((escuela) => (
                  <option key={escuela} value={escuela}>
                    {nombreEscuela(escuela)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${id}-tutor`}>Tutor</label>
              <select
                id={`${id}-tutor`}
                className="select"
                value={tutorVigente}
                onChange={(evento) => setTutorId(evento.target.value)}
              >
                <option value="">Todos los tutores</option>
                {tutoresDisponibles.map((tutor) => (
                  <option key={tutor.id} value={tutor.id}>
                    {tutor.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!cierre && (
            <Alert tone="info" title="El semestre sigue en curso">
              Puedes exportar un avance. Para exportar el cierre, pasa el semestre a «Cierre» en{' '}
              <Link to="/coordinacion/plan">Plan de tutoría</Link>.
            </Alert>
          )}
        </CardBody>
        {delSemestre.length ? (
          <ul className="fx-requisitos" aria-label="Requisitos del cierre">
            {resumen.requisitos.map((requisito) => (
              <RequisitoItem key={requisito.clave} requisito={requisito} />
            ))}
          </ul>
        ) : (
          <CardBody>
            <p className="compact-note">
              No hay estudiantes asignados en el semestre {semestreId}. Asigna tutores para armar el
              cierre.
            </p>
          </CardBody>
        )}
      </Card>

      <section className="fx-previa" aria-labelledby={`${id}-titulo`}>
        <header className="fx-previa__cabecera">
          <div>
            <h2 id={`${id}-titulo`}>{titulo}</h2>
            <p>
              {etiquetaAmbito(resumen.ambito)} · portada + {resumen.documentos.length} formato(s),{' '}
              {hojasDe(resumen.documentos)} hoja(s)
            </p>
          </div>
          <div className="fx-previa__acciones">
            {resumen.completo ? (
              <Badge tone="ok">Listo para cerrar</Badge>
            ) : (
              <Badge tone="alerta">{resumen.pendientesObligatorios} pendiente(s)</Badge>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!delSemestre.length}
              onClick={() => onExportar(resumen, titulo)}
            >
              <i className="fa-solid fa-file-pdf" aria-hidden="true" /> Exportar {accion}
            </button>
          </div>
        </header>
        <VistaPreviaHojas etiqueta={`Vista previa: portada del ${accion}`}>
          <PortadaCierre resumen={resumen} generado={fechaActualLima()} />
        </VistaPreviaHojas>
        <p className="compact-note">
          La vista previa muestra la portada. El PDF incluye además los formatos enviados del
          ámbito; los no aprobados salen con la marca «Pendiente de revisión».
        </p>
      </section>
    </div>
  );
}
