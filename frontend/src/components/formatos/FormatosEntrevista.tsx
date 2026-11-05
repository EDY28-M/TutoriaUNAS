import type { DocumentoFormato } from '../../utils/exportFormatos';
import { filasDe, marcada, rellenar, valorDe, valoresDe } from '../../utils/exportFormatos';
import type { RespuestasInstrumento } from '../../utils/validacionInstrumentos';
import { definicionPorCodigo } from '../../data/formatos';
import { Campo, Guiones, Hoja, Marca, Opcion, Pregunta, Seccion, Val } from './primitivas';

type Props = { documento: DocumentoFormato };
type Fila = Record<string, string>;

/** Datos del tutorado y trayectoria académica: cabecera común a los anexos 03, 04 y 05. */
function Identidad({ r }: { r: RespuestasInstrumento }) {
  return (
    <>
      <tr>
        <td colSpan={3} className="fo-sombra-suave">
          <Campo etiqueta="NOMBRE DEL ESTUDIANTE" valor={r.nombreEstudiante} />
        </td>
      </tr>
      <tr>
        <td>
          <Campo etiqueta="GRUPO" valor={r.grupo} />
        </td>
        <td>
          <Campo etiqueta="CORREO ELECTRÓNICO" valor={r.correo} />
        </td>
        <td>
          <Campo etiqueta="TELÉFONO" valor={r.telefono} />
        </td>
      </tr>
      <tr>
        <td colSpan={3}>
          <Campo etiqueta="NOMBRE DEL PADRE O APODERADO" valor={r.apoderado} />
        </td>
      </tr>
      <Seccion columnas={3} izquierda>
        Trayectoria académica
      </Seccion>
      <tr>
        <td colSpan={3}>
          <Campo etiqueta="COLEGIO DE PROCEDENCIA" valor={r.colegio} />
        </td>
      </tr>
    </>
  );
}

function ColumnasIdentidad() {
  return (
    <colgroup>
      <col style={{ width: '24%' }} />
      <col style={{ width: '46%' }} />
      <col />
    </colgroup>
  );
}

const FORMAS_ESTUDIO = [
  'Individual',
  'En grupo',
  'Haciendo acordeón',
  'En tu cuarto',
  'Al aire libre',
  'Con música',
  'Repasando en silencio',
  'Repasando en voz alta',
  'Generalmente no estudio',
];

function horas(valor: string | undefined): string {
  return valor ? `${valor} ${valor === '1' ? 'hora' : 'horas'}` : '';
}

/** Formato 03 · Entrevista inicial al estudiante ingresante. */
export function Formato03({ documento: d }: Props) {
  const r = d.respuestas;
  const dia = rellenar<Fila>(filasDe(r, 'administracionTiempo'), 4, {});
  return (
    <>
      <Hoja documento={d}>
        <table className="fo-tabla">
          <ColumnasIdentidad />
          <tbody>
            <Identidad r={r} />
            <tr>
              <td colSpan={3}>
                <Campo etiqueta="PROMEDIO GENERAL DE SECUNDARIA" valor={r.promedioSecundaria} />
              </td>
            </tr>
            <Pregunta columnas={3} texto="MATERIAS QUE SE DIFICULTARON EN LA SECUNDARIA">
              <Guiones items={valoresDe(r, 'materiasSecundaria')} minimo={2} />
            </Pregunta>
            <Seccion columnas={3} izquierda>
              Expectativas de la tutoría
            </Seccion>
            <Pregunta columnas={3} texto="¿Sabes qué es una tutoría?">
              <Val>{valorDe(r, 'conoceTutoria')}</Val>
            </Pregunta>
            <Pregunta columnas={3} texto="¿Qué esperas de una tutoría?">
              <Guiones items={valoresDe(r, 'expectativas')} minimo={2} />
            </Pregunta>
            <Seccion columnas={3}>Motivación</Seccion>
            <Pregunta
              columnas={3}
              texto="¿Qué consideras que influyó en la decisión para elegir esta carrera profesional?"
            >
              <Guiones items={valoresDe(r, 'eleccionCarrera')} minimo={2} />
            </Pregunta>
            <Pregunta
              columnas={3}
              texto="¿Cuáles son las expectativas que tienes en esta carrera profesional?"
            >
              <Guiones items={valoresDe(r, 'expectativaCarrera')} minimo={2} />
            </Pregunta>
            <Pregunta columnas={3} texto="¿Qué esperas de la Universidad y tu Facultad?">
              <Guiones items={valoresDe(r, 'expectativaUniversidad')} minimo={2} />
            </Pregunta>
          </tbody>
        </table>
      </Hoja>
      <Hoja documento={d} continuacion>
        <table className="fo-tabla">
          <colgroup>
            <col />
            <col style={{ width: '26%' }} />
          </colgroup>
          <tbody>
            <Seccion columnas={2}>Organización del tiempo</Seccion>
            <tr>
              <td colSpan={2}>Describe un día completo en la universidad y el hogar</td>
            </tr>
            {dia.map((fila, i) => (
              <tr key={i}>
                <td>
                  <Campo etiqueta="Actividad" valor={fila.actividad} />
                </td>
                <td>
                  <Campo etiqueta="Tiempo" valor={horas(fila.horas)} />
                </td>
              </tr>
            ))}
            <Seccion columnas={2}>Estrategias de estudio</Seccion>
            <Pregunta columnas={2} texto="¿Cuánto tiempo dedicas al estudio?">
              <Val>{horas(r.horasEstudio) && `${horas(r.horasEstudio)} al día`}</Val>
            </Pregunta>
            <Pregunta
              columnas={2}
              texto="¿Consideras que el tiempo que utilizas para el estudio es el suficiente?"
            >
              <Val>{valorDe(r, 'tiempoSuficiente')}</Val>
            </Pregunta>
            <tr className="fo-pregunta">
              <td colSpan={2}>
                <p className="fo-pregunta__texto">Cuando estudias, prefieres hacerlo de forma:</p>
                <ul className="fo-opciones">
                  {FORMAS_ESTUDIO.map((forma) => (
                    <li key={forma}>
                      <Opcion activa={marcada(r, 'formaEstudio', forma)}>{forma}</Opcion>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
            <Pregunta columnas={2} texto="Otra forma ¿Cómo?">
              <Val>{marcada(r, 'formaEstudio', 'Otro') ? r.formaEstudio__otro : ''}</Val>
            </Pregunta>
            <Pregunta
              columnas={2}
              alta
              texto="¿Consideras que la forma que estudias te resulta efectiva para resolver los exámenes?"
            >
              <Val>{valorDe(r, 'estudioEfectivo')}</Val>
            </Pregunta>
          </tbody>
        </table>
      </Hoja>
    </>
  );
}

function ListaNumerada({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div className="fo-rasgo">
      <p className="fo-rasgo__titulo">{titulo}</p>
      <ol>
        {rellenar(items, 4, '').map((item, i) => (
          <li key={i}>{item ? <span className="fo-val">{item}</span> : ' '}</li>
        ))}
      </ol>
    </div>
  );
}

function textoLibre(valor: string | undefined): string[] {
  const texto = (valor ?? '').trim();
  return texto ? [texto] : [];
}

/** Formatos 04 y 05: misma estructura; el 05 agrega el campo laboral y renumera. */
function EntrevistaCiclos({ documento: d, final }: Props & { final: boolean }) {
  const r = d.respuestas;
  const dia = rellenar<Fila>(filasDe(r, 'administracionTiempo'), final ? 4 : 5, {});
  const laborales = final
    ? (definicionPorCodigo('F05')
        ?.secciones.find((seccion) => seccion.titulo === 'Campo laboral')
        ?.campos.map((campo) => ({ codigo: campo.codigo, etiqueta: campo.etiqueta })) ?? [])
    : [];
  let n = 0;
  const siguiente = () => ++n;
  const expectativa = valorDe(r, 'expectativas');
  const traslado: string[] = [];
  const medio = valorDe(r, 'transporte');
  if (medio) traslado.push(`Medio: ${medio}`);
  if (r.tiempoTransporte) traslado.push(`Tiempo: ${r.tiempoTransporte} minutos`);

  return (
    <>
      <Hoja documento={d}>
        <table className="fo-tabla">
          <ColumnasIdentidad />
          <tbody>
            <Identidad r={r} />
            <Seccion columnas={3}>Expectativas de la tutoría</Seccion>
            <Pregunta
              columnas={3}
              numero={siguiente()}
              texto="¿La tutoría recibida ha colmado tus expectativas? Sí, no ¿por qué?"
            >
              <Guiones items={[expectativa, r.motivoExpectativas ?? ''].filter(Boolean)} />
            </Pregunta>
            <Pregunta
              columnas={3}
              numero={siguiente()}
              texto="Enumera tres aspectos que aprendiste en las tutorías"
            >
              <Guiones items={valoresDe(r, 'aprendizajes')} minimo={3} />
            </Pregunta>
            <Pregunta
              columnas={3}
              numero={siguiente()}
              texto="¿Qué características de acompañamiento te gustaría encontrar en el Tutor?"
            >
              <Guiones items={valoresDe(r, 'caracteristicasTutor')} />
            </Pregunta>
          </tbody>
        </table>
        {final && (
          <table className="fo-tabla fo-pegada">
            <colgroup>
              <col />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="fo-seccion">
                  Campo laboral
                </th>
                <th scope="col" className="fo-seccion">
                  SÍ
                </th>
                <th scope="col" className="fo-seccion">
                  NO
                </th>
              </tr>
            </thead>
            <tbody>
              {laborales.map((item) => (
                <tr key={item.codigo}>
                  <td>
                    <span className="fo-pregunta__num">{siguiente()}.</span> {item.etiqueta}
                  </td>
                  <Marca activa={r[item.codigo] === 'Sí'} etiqueta={`${item.etiqueta}: sí`} />
                  <Marca activa={r[item.codigo] === 'No'} etiqueta={`${item.etiqueta}: no`} />
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <table className="fo-tabla fo-pegada">
          <tbody>
            <Seccion columnas={1}>Motivación</Seccion>
            <Pregunta
              numero={siguiente()}
              texto={`Tu motivación personal hacia ${final ? 'la carrera' : 'el estudio'} ¿cómo se encuentra?`}
            >
              <Val>{valorDe(r, 'motivacion')}</Val>
            </Pregunta>
            <Seccion columnas={1}>Organización del tiempo</Seccion>
            <Pregunta numero={siguiente()} texto="¿Además de estudiar realizas otras actividades?">
              <Guiones items={valoresDe(r, 'otrasActividades')} />
            </Pregunta>
            <Pregunta
              numero={siguiente()}
              texto="¿Cómo administras tu tiempo? (describe cuánto tiempo le dedicas a cada actividad: asistencia a clases, estudio de materias, deportiva, social, etc.)"
            >
              <ol className="fo-actividades">
                <li className="fo-actividades__cabecera" aria-hidden="true">
                  <span>Actividad:</span>
                  <span>Tiempo:</span>
                </li>
                {dia.map((fila, i) => (
                  <li key={i}>
                    <span>
                      {i + 1}. <Val>{fila.actividad}</Val>
                    </span>
                    <span>
                      <Val>{horas(fila.horas)}</Val>
                    </span>
                  </li>
                ))}
              </ol>
            </Pregunta>
            {!final && (
              <Pregunta
                numero={siguiente()}
                texto="¿Cómo te transportas a la universidad y cuánto tiempo requieres para llegar a tus clases?"
              >
                <Guiones items={traslado} />
              </Pregunta>
            )}
          </tbody>
        </table>
      </Hoja>
      <Hoja documento={d} continuacion>
        <table className="fo-tabla">
          <tbody>
            <Seccion columnas={1}>Estrategias de estudio</Seccion>
            <Pregunta numero={siguiente()} texto="¿En dónde estudias regularmente?">
              <Val>{valorDe(r, 'lugarEstudio')}</Val>
            </Pregunta>
            <Pregunta numero={siguiente()} texto="¿Tienes algún espacio específico para estudiar?">
              <Val>{valorDe(r, 'espacioEstudio')}</Val>
            </Pregunta>
            <Pregunta
              numero={siguiente()}
              texto="¿Cuáles son los cursos que más trabajo te cuestan?"
            >
              <Guiones items={valoresDe(r, 'cursosDificiles')} />
            </Pregunta>
            <Pregunta numero={siguiente()} texto="¿Qué haces para estudiarlos?">
              <Guiones items={valoresDe(r, 'accionesCursos')} />
            </Pregunta>
            <Pregunta
              numero={siguiente()}
              texto="¿Hasta ahora has tenido alguna dificultad con tus estudios?"
            >
              <Guiones items={valoresDe(r, 'dificultades')} />
            </Pregunta>
            <Pregunta numero={siguiente()} texto="¿Qué has hecho para resolverlas?">
              <Guiones items={valoresDe(r, 'soluciones')} />
            </Pregunta>
            <Pregunta
              numero={siguiente()}
              texto="¿Qué materias son las que más te gustan y se te facilitan?"
            >
              <Guiones items={valoresDe(r, 'materiasFaciles')} />
            </Pregunta>
            <Seccion columnas={1}>Área socio emocional</Seccion>
            <Pregunta
              numero={siguiente()}
              texto="Problemas personales que consideras que influyen en tu estudio y en tu aprendizaje"
            >
              <Guiones items={valoresDe(r, 'problemasPersonales')} />
            </Pregunta>
            <Pregunta numero={siguiente()} texto="¿Cómo consideras tu estado actual de salud?">
              <Val>{valorDe(r, 'estadoSalud')}</Val>
            </Pregunta>
            <Pregunta
              numero={siguiente()}
              texto="Tu auto descripción (física, mental, temperamental)"
            >
              <Val>{r.autodescripcion}</Val>
            </Pregunta>
            <Pregunta
              numero={siguiente()}
              texto="¿Hay algo que te preocupe o inquiete en este momento de tu vida?"
            >
              <Guiones items={valoresDe(r, 'preocupaciones')} />
            </Pregunta>
            <Pregunta numero={siguiente()} texto="Escribe dentro de la tabla lo que se te pide:">
              <div className="fo-rasgos">
                <ListaNumerada titulo="Tus cualidades" items={valoresDe(r, 'cualidades')} />
                <ListaNumerada titulo="Tus habilidades" items={valoresDe(r, 'habilidades')} />
                <ListaNumerada titulo="Tus aficiones" items={valoresDe(r, 'aficiones')} />
                <ListaNumerada
                  titulo="Tus adicciones (si existen)"
                  items={textoLibre(r.adicciones)}
                />
                <ListaNumerada titulo="Tus valores" items={valoresDe(r, 'valores')} />
                <ListaNumerada
                  titulo="Tus antivalores (si existen)"
                  items={textoLibre(r.antivalores)}
                />
              </div>
            </Pregunta>
          </tbody>
        </table>
      </Hoja>
    </>
  );
}

/** Formato 04 · Entrevista inicial al estudiante de ciclos intermedios. */
export function Formato04({ documento }: Props) {
  return <EntrevistaCiclos documento={documento} final={false} />;
}

/** Formato 05 · Entrevista inicial al estudiante de ciclos finales. */
export function Formato05({ documento }: Props) {
  return <EntrevistaCiclos documento={documento} final />;
}
