import { DirectorySearch } from '../../components/ui/DirectoryToolbar';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { CompactPage } from '../../components/ui/CompactPage';
import { PageHeading } from '../../components/ui/PageHeading';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { Card } from '../../components/ui/Card';
import { Sheet } from '../../components/ui/Sheet';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { definicionesFormato } from '../../data/formatos';
import { reglasTutoria } from '../../data/institucional';
import type { CampoFormato, ReglaTutoria } from '../../types/domain';
import { normalizar } from '../../utils/busqueda';
import { downloadCsv } from '../../utils/csv';

export function CoordFields() {
  const formatoId = useId();
  const [tab, setTab] = useState('preguntas');
  const [codigo, setCodigo] = useState('F01');
  const [buscar, setBuscar] = useState('');
  const [pregunta, setPregunta] = useState<CampoFormato | null>(null);
  const [regla, setRegla] = useState<ReglaTutoria | null>(null);
  const formato = definicionesFormato.find((f) => f.codigo === codigo);
  const campos =
    formato?.secciones.flatMap((s) => s.campos.map((campo) => ({ campo, seccion: s.titulo }))) ??
    [];
  const visibles = campos.filter(({ campo, seccion }) =>
    normalizar(`${campo.codigo} ${campo.etiqueta} ${seccion}`).includes(normalizar(buscar)),
  );
  const reglas = reglasTutoria.filter((r) =>
    normalizar(`${r.codigo} ${r.descripcion} ${r.valor}`).includes(normalizar(buscar)),
  );
  function exportar() {
    downloadCsv(
      tab === 'preguntas'
        ? [
            [
              'Formato',
              'Sección',
              'Código',
              'Pregunta',
              'Tipo',
              'Obligatorio',
              'Opciones',
              'Ayuda',
              'Columnas',
              'Condición',
            ],
            ...definicionesFormato.flatMap((f) =>
              f.secciones.flatMap((s) =>
                s.campos.map((c) => [
                  f.codigo,
                  s.titulo,
                  c.codigo,
                  c.etiqueta,
                  c.tipo,
                  c.obligatorio ? 'Sí' : 'No',
                  c.opciones?.join(' | ') ?? '',
                  c.ayuda ?? '',
                  c.columnas ? JSON.stringify(c.columnas) : '',
                  c.visibleSi ? JSON.stringify(c.visibleSi) : '',
                ]),
              ),
            ),
          ]
        : [
            ['Código', 'Regla', 'Valor', 'Estado', 'Fuente'],
            ...reglasTutoria.map((r) => [r.codigo, r.descripcion, r.valor, r.estado, r.fuente]),
          ],
      tab === 'preguntas' ? 'preguntas-tutoria.csv' : 'reglas-tutoria.csv',
    );
  }
  return (
    <CompactPage>
      <PageHeading
        eyebrow="Coordinación"
        title="Preguntas y reglas"
        actions={
          <>
            <Link className="btn btn-falcon-default" to="/coordinacion/instrumentos">
              Formularios
            </Link>
            <button className="btn btn-falcon-default" type="button" onClick={exportar}>
              <i className="fa-solid fa-download" aria-hidden="true" /> Descargar
            </button>
          </>
        }
      />
      <Tabs
        etiqueta="Contenido de formularios"
        activo={tab}
        onChange={(t) => {
          setTab(t);
          setBuscar('');
        }}
        items={[
          { id: 'preguntas', label: 'Preguntas' },
          { id: 'reglas', label: 'Reglas', count: reglasTutoria.length },
        ]}
      />
      <div className="compact-toolbar">
        {tab === 'preguntas' && (
          <div className="field">
            <label htmlFor={formatoId}>Formulario</label>
            <select
              id={formatoId}
              className="select"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            >
              {definicionesFormato.map((f) => (
                <option key={f.codigo} value={f.codigo}>
                  {f.numero} · {f.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <DirectorySearch
          value={buscar}
          onChange={setBuscar}
          label={tab === 'preguntas' ? 'Buscar pregunta' : 'Buscar regla'}
        />
      </div>
      <TabPanel id="preguntas" activo={tab}>
        <Card>
          {visibles.length ? (
            <ul className="compact-list" aria-label="Preguntas del formulario">
              {visibles.map(({ campo, seccion }) => (
                <li key={campo.codigo}>
                  <button
                    type="button"
                    className="compact-list__row"
                    onClick={() => setPregunta(campo)}
                  >
                    <span className="compact-list__body">
                      <strong>{campo.etiqueta}</strong>
                      <small>{seccion}</small>
                    </span>
                    <span className="compact-list__end">
                      {campo.obligatorio && <Badge tone="neutro">Obligatoria</Badge>}
                      <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sin coincidencias" />
          )}
        </Card>
      </TabPanel>
      <TabPanel id="reglas" activo={tab}>
        <Card>
          {reglas.length ? (
            <ul className="compact-list">
              {reglas.map((r) => (
                <li key={r.id}>
                  <button type="button" className="compact-list__row" onClick={() => setRegla(r)}>
                    <span className="compact-list__body">
                      <strong>{r.descripcion}</strong>
                      <small>{r.valor}</small>
                    </span>
                    <span className="compact-list__end">
                      <StatusBadge estado={r.estado} />
                      <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sin coincidencias" />
          )}
        </Card>
      </TabPanel>
      {pregunta && (
        <Sheet title={pregunta.etiqueta} onClose={() => setPregunta(null)}>
          <dl className="compact-detail-list">
            <div>
              <dt>Código</dt>
              <dd>{pregunta.codigo}</dd>
            </div>
            <div>
              <dt>Respuesta</dt>
              <dd>
                {pregunta.tipo} · {pregunta.obligatorio ? 'Obligatoria' : 'Opcional'}
              </dd>
            </div>
            {pregunta.ayuda && (
              <div>
                <dt>Ayuda</dt>
                <dd>{pregunta.ayuda}</dd>
              </div>
            )}
            {pregunta.opciones?.length ? (
              <div>
                <dt>Opciones</dt>
                <dd>
                  <ul>
                    {pregunta.opciones.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
            {pregunta.columnas && (
              <div>
                <dt>Columnas</dt>
                <dd>{pregunta.columnas.map((c) => c.etiqueta).join(' · ')}</dd>
              </div>
            )}
            {pregunta.visibleSi && (
              <div>
                <dt>Se muestra cuando</dt>
                <dd>
                  {pregunta.visibleSi.campo}: {pregunta.visibleSi.valores.join(' · ')}
                </dd>
              </div>
            )}
          </dl>
        </Sheet>
      )}
      {regla && (
        <Sheet title={regla.descripcion} onClose={() => setRegla(null)}>
          <dl className="compact-detail-list">
            <div>
              <dt>Valor registrado</dt>
              <dd>{regla.valor}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <StatusBadge estado={regla.estado} />
              </dd>
            </div>
            <div>
              <dt>Fuente</dt>
              <dd>{regla.fuente}</dd>
            </div>
          </dl>
        </Sheet>
      )}
    </CompactPage>
  );
}
