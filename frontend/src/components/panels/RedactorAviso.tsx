import { useId, useState } from 'react';
import { useSistema } from '../../hooks/useSistema';
import { usePermiso } from '../../hooks/usePermiso';
import { mutarSistema } from '../../services/apiSistema';
import { semestreActual } from '../../data/catalogos';
import type { MensajePersistido } from '../../types/sistema';
import { Sheet } from '../ui/Sheet';
import { FormularioPersistente, EliminarPersistente } from './OperacionPersistente';

export function RedactorAviso({
  aviso,
  copiar = false,
  onCerrar,
}: {
  aviso?: MensajePersistido;
  copiar?: boolean;
  onCerrar(): void;
}) {
  const sistema = useSistema();
  const puedeEliminar = usePermiso('comunicacion', 'eliminar');
  const id = useId();
  const [version] = useState(aviso?.version ?? 0);
  const [asunto, setAsunto] = useState(aviso?.asunto ?? '');
  const [cuerpo, setCuerpo] = useState(aviso?.cuerpo ?? '');
  const [destinatarios, setDestinatarios] = useState<string[]>(aviso?.destinatarioIds ?? []);
  const [estado, setEstado] = useState<'borrador' | 'enviado' | 'programado'>(
    aviso?.estado === 'programado' && !copiar ? 'programado' : 'borrador',
  );
  const [canal, setCanal] = useState(aviso?.canal ?? 'sistema');
  const [programado, setProgramado] = useState(() =>
    aviso?.programadoPara && !copiar
      ? new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Lima',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        })
          .format(new Date(aviso.programadoPara))
          .replace(' ', 'T')
      : '',
  );
  const opciones = sistema?.destinatariosDisponibles ?? [];
  const editando = aviso?.editable && !copiar;
  return (
    <Sheet
      title={editando ? 'Editar aviso' : 'Redactar aviso'}
      description={`Tutoría · ${semestreActual}`}
      onClose={onCerrar}
      wide
    >
      <FormularioPersistente
        guardar={() =>
          mutarSistema(
            `mensajes${editando ? `/${encodeURIComponent(aviso!.id)}` : ''}`,
            editando ? 'PUT' : 'POST',
            {
              version: editando ? version : 0,
              asunto,
              cuerpo,
              destinatarios,
              estado,
              canal,
              plantilla: aviso?.plantilla ?? 'redaccion-libre',
              programadoPara:
                estado === 'programado' && programado
                  ? new Date(`${programado}-05:00`).toISOString()
                  : null,
            },
          )
        }
        alGuardar={onCerrar}
        etiqueta={
          estado === 'borrador'
            ? 'Guardar borrador'
            : estado === 'programado'
              ? 'Programar aviso'
              : 'Publicar aviso'
        }
      >
        <div className="field">
          <label htmlFor={`${id}-dest`}>Destinatarios</label>
          <select
            id={`${id}-dest`}
            className="select"
            multiple
            required
            size={Math.min(8, Math.max(3, opciones.length))}
            value={destinatarios}
            onChange={(e) => setDestinatarios(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre} · {o.rol}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-link"
          onClick={() =>
            setDestinatarios(opciones.filter((o) => o.rol === 'estudiante').map((o) => o.id))
          }
        >
          Seleccionar estudiantes de mi ámbito
        </button>
        <div className="field">
          <label htmlFor={`${id}-plantilla`}>Plantilla</label>
          <select
            id={`${id}-plantilla`}
            className="select"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                setAsunto(e.target.value);
                setCuerpo(
                  `${e.target.value} · semestre ${semestreActual}. Revisa las actividades pendientes en tu portal de tutoría y comunícate con tu docente tutor si necesitas orientación.`,
                );
              }
            }}
          >
            <option value="">Redacción libre</option>
            <option>Recordatorio de tutoría</option>
            <option>Formularios pendientes</option>
            <option>Cierre del semestre</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-asunto`}>Asunto</label>
          <input
            id={`${id}-asunto`}
            className="input"
            required
            minLength={3}
            maxLength={200}
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-cuerpo`}>Mensaje</label>
          <textarea
            id={`${id}-cuerpo`}
            className="textarea"
            required
            minLength={3}
            maxLength={10000}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
          />
        </div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor={`${id}-canal`}>Canal</label>
            <select
              id={`${id}-canal`}
              className="select"
              value={canal}
              onChange={(e) => {
                setCanal(e.target.value as typeof canal);
                if (e.target.value === 'correo') setEstado('borrador');
              }}
            >
              <option value="sistema">Dentro del sistema</option>
              <option value="correo">Borrador de correo</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-estado`}>Acción</label>
            <select
              id={`${id}-estado`}
              className="select"
              value={estado}
              onChange={(e) => setEstado(e.target.value as typeof estado)}
            >
              <option value="borrador">Guardar borrador</option>
              <option value="enviado" disabled={canal !== 'sistema'}>
                Publicar ahora
              </option>
              <option value="programado" disabled={canal !== 'sistema'}>
                Programar publicación
              </option>
            </select>
          </div>
        </div>
        {estado === 'programado' && (
          <div className="field">
            <label htmlFor={`${id}-fecha`}>Publicar el (hora de Lima)</label>
            <input
              id={`${id}-fecha`}
              className="input"
              type="datetime-local"
              required
              value={programado}
              onChange={(e) => setProgramado(e.target.value)}
            />
          </div>
        )}
        {canal === 'correo' && (
          <p className="small muted">
            El correo institucional requiere su proveedor. Puedes conservar el borrador o publicar
            dentro del sistema.
          </p>
        )}
      </FormularioPersistente>
      {editando && puedeEliminar && (
        <EliminarPersistente
          eliminar={() =>
            mutarSistema(`mensajes/${encodeURIComponent(aviso!.id)}?version=${version}`, 'DELETE')
          }
          alEliminar={onCerrar}
        />
      )}
    </Sheet>
  );
}
