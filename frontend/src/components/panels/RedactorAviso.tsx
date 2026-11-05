import { useId, useState } from 'react';
import { useSistema } from '../../hooks/useSistema';
import { usePermiso } from '../../hooks/usePermiso';
import { mutarSistema } from '../../services/apiSistema';
import { semestreActual } from '../../data/catalogos';
import type { MensajePersistido } from '../../types/sistema';
import { Sheet } from '../ui/Sheet';
import { FormularioPersistente, EliminarPersistente } from './OperacionPersistente';
import { normalizar } from '../../utils/busqueda';
import '../../styles/coord-modals.css';

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
  const [buscarDestinatario, setBuscarDestinatario] = useState('');
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
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
  const visibles = opciones.filter((opcion) =>
    normalizar(`${opcion.nombre} ${opcion.rol}`).includes(normalizar(buscarDestinatario.trim())),
  );
  const editando = aviso?.editable && !copiar;
  return (
    <Sheet
      title={editando ? 'Editar aviso' : 'Redactar aviso'}
      description={`Tutoría · ${semestreActual}`}
      onClose={onCerrar}
      wide
      className="coord-form-sheet coord-notice-sheet"
    >
      <FormularioPersistente
        deshabilitado={destinatarios.length === 0}
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
        <div className="field coord-recipients">
          <label htmlFor={`${id}-dest`}>
            Destinatarios · {destinatarios.length}{' '}
            {destinatarios.length === 1 ? 'seleccionado' : 'seleccionados'}
          </label>
          <div
            className="coord-recipient-search"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                setBusquedaAbierta(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && busquedaAbierta) {
                e.preventDefault();
                e.stopPropagation();
                setBusquedaAbierta(false);
              }
            }}
          >
            <input
              id={`${id}-dest`}
              className="input"
              type="search"
              placeholder="Buscar por nombre o perfil"
              value={buscarDestinatario}
              onFocus={() => setBusquedaAbierta(true)}
              onClick={() => setBusquedaAbierta(true)}
              onChange={(e) => setBuscarDestinatario(e.target.value)}
            />
            {busquedaAbierta && (
              <div
                className="coord-recipient-list"
                role="group"
                aria-label="Destinatarios disponibles"
              >
                {visibles.map((o) => (
                  <label className="coord-recipient" key={o.id}>
                    <input
                      type="checkbox"
                      checked={destinatarios.includes(o.id)}
                      onChange={(e) =>
                        setDestinatarios((actuales) =>
                          e.target.checked
                            ? [...actuales, o.id]
                            : actuales.filter((id) => id !== o.id),
                        )
                      }
                    />
                    <span>
                      {o.nombre}
                      <small>{o.rol}</small>
                    </span>
                  </label>
                ))}
                {!visibles.length && <p className="small muted">Sin coincidencias.</p>}
              </div>
            )}
          </div>
          <div className="coord-recipient-actions">
            <button
              type="button"
              className="btn btn-link"
              onClick={() =>
                setDestinatarios(opciones.filter((o) => o.rol === 'estudiante').map((o) => o.id))
              }
            >
              Seleccionar estudiantes
            </button>
            {destinatarios.length > 0 && (
              <button type="button" className="btn btn-link" onClick={() => setDestinatarios([])}>
                Limpiar selección
              </button>
            )}
          </div>
        </div>
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
