import { DirectorySearch } from '../../components/ui/DirectoryToolbar';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CuentasSistema } from '../../components/panels/GestionCoordinacion';
import { CompactPage } from '../../components/ui/CompactPage';
import { PageHeading } from '../../components/ui/PageHeading';
import { FormsFilters } from '../../components/ui/FormsPanel';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { permisos } from '../../data/institucional';
import { API_MODE } from '../../services/apiConfig';
import { downloadCsv } from '../../utils/csv';
import type { PermisoRol } from '../../types/domain';

const roles: { id: PermisoRol['rol']; nombre: string; alcance: string }[] = [
  {
    id: 'estudiante',
    nombre: 'Estudiante',
    alcance: 'Su expediente, formularios, sesiones y avisos.',
  },
  { id: 'tutor', nombre: 'Docente', alcance: 'Sus estudiantes asignados y su actividad tutorial.' },
  {
    id: 'coordinacion',
    nombre: 'Coordinación',
    alcance: 'Asignaciones, informes y seguimiento de su escuela.',
  },
];
const acciones: Record<string, string> = {
  ver: 'Consultar',
  crear: 'Crear',
  editar: 'Editar',
  revisar: 'Revisar',
  aprobar: 'Aprobar',
  descargar: 'Descargar',
  eliminar: 'Eliminar',
};

export function CoordPermissions() {
  const [parametros, setParametros] = useSearchParams();
  const tab = API_MODE && parametros.get('tab') === 'cuentas' ? 'cuentas' : 'perfiles';
  function setTab(valor: string) {
    const siguientes = new URLSearchParams(parametros);
    if (valor === 'cuentas') siguientes.set('tab', valor);
    else siguientes.delete('tab');
    setParametros(siguientes);
  }
  const [rol, setRol] = useState('estudiante');
  const [buscar, setBuscar] = useState('');
  const disponibles = roles.filter((r) => permisos.some((p) => p.rol === r.id));
  const filas = permisos.filter(
    (p) =>
      p.rol === rol && p.recurso.toLocaleLowerCase('es').includes(buscar.toLocaleLowerCase('es')),
  );
  function exportar() {
    downloadCsv(
      [
        ['Perfil', 'Recurso', 'Acciones'],
        ...permisos.map((p) => [
          roles.find((r) => r.id === p.rol)?.nombre ?? p.rol,
          p.recurso,
          p.acciones.map((a) => acciones[a] ?? a).join(' | '),
        ]),
      ],
      'accesos-por-perfil.csv',
    );
  }
  return (
    <CompactPage>
      <PageHeading
        eyebrow="Coordinación"
        title="Accesos y permisos"
        actions={
          <button type="button" className="btn btn-falcon-default" onClick={exportar}>
            <i className="fa-solid fa-download" aria-hidden="true" /> Descargar
          </button>
        }
      />
      <Tabs
        etiqueta="Accesos"
        activo={tab}
        onChange={setTab}
        items={[
          { id: 'perfiles', label: 'Por perfil' },
          ...(API_MODE ? [{ id: 'cuentas', label: 'Cuentas' }] : []),
        ]}
      />
      <TabPanel id="perfiles" activo={tab}>
        <FormsFilters
          label="Elegir perfil"
          options={disponibles.map((r) => ({
            id: r.id,
            nombre: r.nombre,
            cantidad: permisos.filter((p) => p.rol === r.id).length,
          }))}
          value={rol}
          onChange={setRol}
        />
        <div className="compact-toolbar">
          <p className="compact-note">{roles.find((r) => r.id === rol)?.alcance}</p>
          <DirectorySearch value={buscar} onChange={setBuscar} label="Buscar sección" />
        </div>
        <Card>
          {filas.length ? (
            <ul className="compact-list" aria-label="Permisos del perfil">
              {filas.map((p) => (
                <li className="compact-permissions" key={p.id}>
                  <strong>{p.recurso}</strong>
                  <div className="compact-tags">
                    {p.acciones.map((a) => (
                      <span key={a}>{acciones[a] ?? a}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sin secciones" description="Prueba otra búsqueda." />
          )}
        </Card>
      </TabPanel>
      <TabPanel id="cuentas" activo={tab}>
        <CuentasSistema />
      </TabPanel>
    </CompactPage>
  );
}
