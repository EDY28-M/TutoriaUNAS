import type {
  CampoFormato,
  CodigoFormato,
  DefinicionFormato,
  Instrumento,
  Sesion,
} from '../types/domain';
import { definicionPorCodigo } from '../data/formatos';
import { asignaciones, sesiones } from '../data/tutoria';
import { docentePorId, estudiantePorId, escuelaDe, nombreCompleto } from '../data/personas';
import { semestreActual } from '../data/catalogos';

export type MomentoTutoria = 'inicio' | 'durante' | 'cierre';
export function formatoInicial(ciclo: number): CodigoFormato {
  return ciclo <= 1 ? 'F03' : ciclo <= 7 ? 'F04' : 'F05';
}
export function listaRespuesta(valor: string): string[] {
  try {
    const lista: unknown = JSON.parse(valor);
    return Array.isArray(lista)
      ? lista.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return valor ? [valor] : [];
  }
}
export function filasRespuesta(valor: string): Record<string, string>[] {
  try {
    const filas: unknown = JSON.parse(valor);
    return Array.isArray(filas)
      ? filas.filter(
          (fila): fila is Record<string, string> =>
            Boolean(fila) &&
            typeof fila === 'object' &&
            Object.values(fila).every((v) => typeof v === 'string'),
        )
      : [];
  } catch {
    return [];
  }
}
export function campoVisible(campo: CampoFormato, valores: Record<string, string>): boolean {
  return !campo.visibleSi || campo.visibleSi.valores.includes(valores[campo.visibleSi.campo] ?? '');
}
export function camposVisibles(definicion: DefinicionFormato, valores: Record<string, string>) {
  return definicion.secciones
    .flatMap((seccion) => seccion.campos)
    .filter((campo) => campoVisible(campo, valores));
}
export function erroresInstrumento(
  definicion: DefinicionFormato,
  valores: Record<string, string>,
): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const campo of camposVisibles(definicion, valores)) {
    const valor = valores[campo.codigo]?.trim() ?? '';
    const filas = campo.tipo === 'tabla' ? filasRespuesta(valor) : [];
    const lista = campo.tipo === 'multiple' ? listaRespuesta(valor) : [];
    if (
      campo.obligatorio &&
      (!valor ||
        (campo.tipo === 'tabla' && !filas.length) ||
        (campo.tipo === 'multiple' && !lista.length))
    )
      errores[campo.codigo] = 'Completa esta respuesta para enviar.';
    if (!valor) continue;
    if (campo.tipo === 'numero' && (!Number.isFinite(Number(valor)) || Number(valor) < 0))
      errores[campo.codigo] = 'Ingresa un número válido, igual o mayor que cero.';
    if (
      ['promedioSecundaria', 'horasEstudio'].includes(campo.codigo) &&
      Number(valor) > (campo.codigo === 'horasEstudio' ? 24 : 20)
    )
      errores[campo.codigo] =
        campo.codigo === 'horasEstudio'
          ? 'Un día tiene como máximo 24 horas.'
          : 'El promedio debe estar entre 0 y 20.';
    if (
      campo.tipo === 'fecha' &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(valor)))
    )
      errores[campo.codigo] = 'Selecciona una fecha válida.';
    if (campo.codigo === 'correo' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor))
      errores[campo.codigo] = 'Revisa el correo electrónico.';
    if (campo.tipo === 'tabla') {
      if (
        !filas.length ||
        filas.some((fila) =>
          campo.columnas?.some(
            (columna) =>
              !fila[columna.codigo]?.trim() ||
              (columna.tipo === 'numero' &&
                (!Number.isFinite(Number(fila[columna.codigo])) ||
                  Number(fila[columna.codigo]) < 0)),
          ),
        )
      )
        errores[campo.codigo] = 'Completa las columnas de cada fila o elimina la fila vacía.';
      if (
        campo.codigo === 'administracionTiempo' &&
        filas.reduce((total, fila) => total + Number(fila.horas || 0), 0) > 24
      )
        errores[campo.codigo] = 'Revisa las horas: el total de un día no puede superar 24.';
    }
    if (
      campo.opciones?.includes('Otro') &&
      (valor === 'Otro' || lista.includes('Otro')) &&
      !valores[`${campo.codigo}__otro`]?.trim()
    )
      errores[`${campo.codigo}__otro`] = 'Indica brevemente tu otra respuesta.';
  }
  if (valores.horaInicio && valores.horaFin && valores.horaFin <= valores.horaInicio)
    errores.horaFin = 'La hora de fin debe ser posterior al inicio.';
  if (valores.resultado === 'Se programa nueva cita para seguimiento') {
    if (valores.proximaCita && valores.proximaCita < fechaTutoria())
      errores.proximaCita = 'La cita de seguimiento no puede estar en el pasado.';
    if (valores.horaCita && valores.horaFinCita && valores.horaFinCita <= valores.horaCita)
      errores.horaFinCita = 'La hora de fin debe ser posterior al inicio.';
  }
  if (
    ['F06', 'F07', 'F08', 'F12'].includes(definicion.codigo) &&
    valores.fecha &&
    valores.fecha > fechaTutoria()
  )
    errores.fecha = 'Registra una atención ya realizada; la fecha no puede ser futura.';
  return errores;
}
export function avanceInstrumento(
  definicion: DefinicionFormato,
  valores: Record<string, string>,
): number {
  const campos = camposVisibles(definicion, valores).filter((campo) => campo.obligatorio);
  const errores = erroresInstrumento(definicion, valores);
  return campos.length
    ? Math.round(
        (100 *
          campos.filter((campo) => !errores[campo.codigo] && !errores[`${campo.codigo}__otro`])
            .length) /
          campos.length,
      )
    : 100;
}
export function respuestasVisibles(
  definicion: DefinicionFormato,
  valores: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    camposVisibles(definicion, valores).flatMap((campo) => {
      const valor = valores[campo.codigo] ?? '';
      const entries = [[campo.codigo, valor]];
      if (valor === 'Otro' || listaRespuesta(valor).includes('Otro'))
        entries.push([`${campo.codigo}__otro`, valores[`${campo.codigo}__otro`] ?? '']);
      return entries;
    }),
  );
}
export function puedeEnviarFormato(codigo: CodigoFormato, momento: MomentoTutoria): boolean {
  return !['F01', 'F02', 'F09', 'F10', 'F11'].includes(codigo) || momento === 'cierre';
}
export function fechaTutoria(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' }).format(new Date());
}
export function precargarInstrumento(
  instrumento: Instrumento,
  sesionesActuales: Sesion[] = sesiones,
): Record<string, string> {
  const estudiante = instrumento.estudianteId ? estudiantePorId(instrumento.estudianteId) : null;
  const docente = docentePorId(instrumento.tutorId);
  const asignacion = asignaciones.find(
    (item) => item.estudianteId === estudiante?.id && item.semestreId === instrumento.semestreId,
  );
  const grupo = asignacion?.grupo ?? '';
  const tutorados = asignaciones.filter(
    (item) =>
      item.tutorId === instrumento.tutorId &&
      item.semestreId === instrumento.semestreId &&
      item.estado === 'activa',
  );
  const realizadas = sesionesActuales.filter(
    (item) =>
      item.tutorId === instrumento.tutorId &&
      item.semestreId === instrumento.semestreId &&
      item.estado === 'realizada',
  );
  const sesion = realizadas.find((item) => item.id === instrumento.sesionId);
  const asistentesDe = (tipo: Sesion['tipo']) => [
    ...new Set(
      realizadas
        .filter((item) => item.tipo === tipo)
        .flatMap((item) =>
          item.asistentes
            .filter((a) => ['asistio', 'tarde'].includes(a.estado))
            .map((a) => a.estudianteId),
        ),
    ),
  ];
  const ciclosDe = (tipo: Sesion['tipo']) =>
    [...new Set(asistentesDe(tipo).map((id) => estudiantePorId(id)?.ciclo))]
      .filter((ciclo): ciclo is number => ciclo !== undefined)
      .sort((a, b) => a - b)
      .join(', ') || 'Sin atenciones';
  const identidad: Record<string, string> = {
    nombreTutor: docente ? nombreCompleto(docente) : '',
    telefonoTutor: docente?.telefono ?? '',
    semestre: instrumento.semestreId || semestreActual,
    fecha: instrumento.enviado ?? fechaTutoria(),
    ...(estudiante
      ? {
          nombreEstudiante: nombreCompleto(estudiante),
          codigo: estudiante.codigo,
          correo: estudiante.correo,
          telefono: estudiante.telefono,
          ciclo: String(estudiante.ciclo),
          escuela: escuelaDe(estudiante.escuelaId),
          grupo,
        }
      : {}),
    ...(instrumento.formato === 'F09'
      ? {
          gruposAsignados: String(new Set(tutorados.map((a) => a.grupo).filter(Boolean)).size),
          estudiantesAsignados: String(tutorados.length),
        }
      : {}),
    ...(instrumento.formato === 'F02'
      ? {
          individuales: String(realizadas.filter((item) => item.tipo === 'individual').length),
          grupales: String(realizadas.filter((item) => item.tipo === 'grupal').length),
          atendidosIndividual: String(asistentesDe('individual').length),
          atendidosGrupal: String(asistentesDe('grupal').length),
          ciclosIndividual: ciclosDe('individual'),
          ciclosGrupal: ciclosDe('grupal'),
          atendidos: String(
            new Set(
              realizadas.flatMap((item) =>
                item.asistentes
                  .filter((a) => ['asistio', 'tarde'].includes(a.estado))
                  .map((a) => a.estudianteId),
              ),
            ).size,
          ),
          ciclos: [...new Set(tutorados.map((a) => estudiantePorId(a.estudianteId)?.ciclo))]
            .filter(Boolean)
            .sort((a, b) => a! - b!)
            .join(', '),
        }
      : {}),
    ...(sesion
      ? {
          fecha: sesion.fecha,
          tema: sesion.tema,
          horaInicio: sesion.horaInicio,
          horaFin: sesion.horaFin,
          grupo:
            grupo ||
            tutorados.find((a) => sesion.asistentes.some((p) => p.estudianteId === a.estudianteId))
              ?.grupo ||
            '',
          asistentes: JSON.stringify(
            sesion.asistentes
              .filter((a) => ['asistio', 'tarde'].includes(a.estado))
              .map((a) => {
                const e = estudiantePorId(a.estudianteId);
                return {
                  nombre: e ? nombreCompleto(e) : '',
                  ciclo: String(e?.ciclo ?? ''),
                  grupo: asignaciones.find((as) => as.estudianteId === a.estudianteId)?.grupo ?? '',
                  tipo: 'Académica',
                };
              }),
          ),
        }
      : {}),
  };
  const valores = { ...identidad, ...instrumento.respuestas };
  if (
    instrumento.formato === 'F08' &&
    valores.motivo &&
    !definicionPorCodigo('F08')
      ?.secciones.flatMap((s) => s.campos)
      .find((c) => c.codigo === 'motivo')
      ?.opciones?.includes(valores.motivo)
  ) {
    valores.motivo__otro = valores.motivo;
    valores.motivo = 'Otro';
  }
  if (
    instrumento.formato === 'F12' &&
    valores.motivo &&
    !definicionPorCodigo('F12')
      ?.secciones.flatMap((s) => s.campos)
      .find((c) => c.codigo === 'motivo')
      ?.opciones?.includes(valores.motivo)
  ) {
    valores.motivo__otro = valores.motivo;
    valores.motivo = 'Otro';
  }
  // Los campos identificativos proceden siempre del padrón de la sesión, no de otro formulario.
  for (const codigo of [
    'nombreEstudiante',
    'codigo',
    'nombreTutor',
    'ciclo',
    'escuela',
    'semestre',
  ])
    if (identidad[codigo]) valores[codigo] = identidad[codigo];
  if (instrumento.formato === 'F02' && !['enviado', 'aprobado'].includes(instrumento.estado)) {
    for (const codigo of [
      'individuales',
      'grupales',
      'atendidosIndividual',
      'atendidosGrupal',
      'ciclosIndividual',
      'ciclosGrupal',
    ])
      valores[codigo] = identidad[codigo] ?? '';
  }
  const definicion = definicionPorCodigo(instrumento.formato);
  return definicion ? respuestasVisibles(definicion, valores) : valores;
}
