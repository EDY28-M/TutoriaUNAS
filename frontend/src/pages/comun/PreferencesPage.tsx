import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import { PageHeading } from '../../components/ui/PageHeading';
import {
  DISPLAY_PREFERENCES_KEY as PREFERENCES_KEY,
  defaultDisplayPreferences as defaults,
  parseDisplayPreferences,
  serializeDisplayPreferences,
} from '../../utils/displayPreferences';
import type { DisplayPreferences as Preferences } from '../../utils/displayPreferences';

function readPreferences(): Preferences {
  try {
    return parseDisplayPreferences(localStorage.getItem(PREFERENCES_KEY));
  } catch {
    return { ...defaults };
  }
}

export function PreferencesPage() {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [mensaje, setMensaje] = useState('');

  function guardar(nuevas: Preferences) {
    localStorage.setItem(PREFERENCES_KEY, serializeDisplayPreferences(nuevas));
    setPreferences(nuevas);
    setMensaje('Ajustes guardados en este navegador.');
    window.dispatchEvent(new Event('unas:preferences'));
  }

  const opciones: Array<{ id: keyof Preferences; label: string; description: string }> = [
    {
      id: 'sidebarMini',
      label: 'Mostrar solo iconos en el menú',
      description: 'Oculta los nombres del menú para dejar más espacio al contenido.',
    },
    {
      id: 'compactTables',
      label: 'Filas de tabla más pequeñas',
      description: 'Reduce la altura de las filas para ver más registros en pantalla.',
    },
    {
      id: 'fullWidth',
      label: 'Usar todo el ancho de la pantalla',
      description: 'Aprovecha todo el ancho disponible en pantallas grandes.',
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow="Cuenta · Apariencia"
        title="Ajustes de pantalla"
        description="Elige cómo quieres ver el menú, las tablas y el contenido."
      />
      {mensaje && (
        <Alert tone="ok" title="Cambios aplicados">
          {mensaje}
        </Alert>
      )}
      <Card>
        <CardHead
          title="Vista del portal"
          description="Los cambios se aplican al instante y se conservan en este navegador."
        />
        <CardBody>
          <div className="preferences-options">
            {opciones.map((opcion) => (
              <label className="preferences-option" key={opcion.id}>
                <span>
                  <strong>{opcion.label}</strong>
                  <small id={`hint-${opcion.id}`}>{opcion.description}</small>
                </span>
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={preferences[opcion.id]}
                    onChange={(evento) =>
                      guardar({ ...preferences, [opcion.id]: evento.target.checked })
                    }
                    aria-label={opcion.label}
                    aria-describedby={`hint-${opcion.id}`}
                  />
                </span>
              </label>
            ))}
          </div>
        </CardBody>
        <CardFoot>
          <span>Estos ajustes se aplican a todos tus perfiles en este navegador.</span>
          <button
            type="button"
            className="btn btn-falcon-default btn-sm"
            onClick={() => guardar(defaults)}
          >
            Restablecer vista
          </button>
        </CardFoot>
      </Card>
    </>
  );
}
