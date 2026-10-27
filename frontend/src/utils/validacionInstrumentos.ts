import { z } from 'zod';
import type { CampoFormato, DefinicionFormato } from '../types/domain';

export type RespuestasInstrumento = Record<string, string>;
export interface ValoresFormularioInstrumento {
  respuestas: RespuestasInstrumento;
  tablas: Record<string, RespuestasInstrumento[]>;
}

export const OPCIONES_EXCLUSIVAS = [
  'Ninguna',
  'Ninguno',
  'Solo estudio',
  'Aún ninguno',
  'No he tenido',
  'No',
  'Prefiero conversarlo con mi tutor',
];
const listaSchema = z.array(z.string());
const filasSchema = z.array(z.record(z.string(), z.string()));

export function listaRespuesta(valor: string): string[] {
  try {
    const resultado = listaSchema.safeParse(JSON.parse(valor));
    return resultado.success ? resultado.data : [];
  } catch {
    return valor ? [valor] : [];
  }
}

export function filasRespuesta(valor: string): RespuestasInstrumento[] {
  try {
    const resultado = filasSchema.safeParse(JSON.parse(valor));
    return resultado.success ? resultado.data : [];
  } catch {
    return [];
  }
}

export function campoVisible(campo: CampoFormato, valores: RespuestasInstrumento): boolean {
  return !campo.visibleSi || campo.visibleSi.valores.includes(valores[campo.visibleSi.campo] ?? '');
}
export function camposVisibles(definicion: DefinicionFormato, valores: RespuestasInstrumento) {
  return definicion.secciones.flatMap((s) => s.campos).filter((c) => campoVisible(c, valores));
}
export function fechaTutoria(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' }).format(new Date());
}

const fechaSchema = z.iso.date({ error: 'Selecciona una fecha válida.' });
const horaSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Selecciona una hora válida.');
const numeroSchema = z
  .string()
  .refine(
    (v) => Boolean(v.trim()) && Number.isFinite(Number(v)) && Number(v) >= 0,
    'Ingresa un número válido, igual o mayor que cero.',
  );

/** Mismas reglas para el resolver de la UI, el progreso y el adaptador de guardado. */
export function crearEsquemaRespuestas(definicion: DefinicionFormato) {
  return z.record(z.string(), z.string()).superRefine((valores, ctx) => {
    const error = (codigo: string, mensaje: string) => {
      ctx.addIssue({ code: 'custom', path: [codigo], message: mensaje });
    };
    const visibles = camposVisibles(definicion, valores);
    for (const campo of visibles) {
      const valor = valores[campo.codigo]?.trim() ?? '';
      if (!valor) {
        if (campo.obligatorio) error(campo.codigo, 'Completa esta respuesta para enviar.');
        continue;
      }
      let esquema: z.ZodType<string> = z.string();
      if (campo.tipo === 'numero') esquema = numeroSchema;
      else if (campo.tipo === 'fecha') esquema = fechaSchema;
      else if (campo.tipo === 'hora') esquema = horaSchema;
      else if (campo.codigo === 'correo')
        esquema = z.email({ error: 'Revisa el correo electrónico.' });
      else if (campo.tipo === 'texto-largo')
        esquema = z.string().max(1000, 'Usa como máximo 1000 caracteres.');
      else if (campo.tipo === 'texto')
        esquema = z.string().max(200, 'Usa como máximo 200 caracteres.');
      const validado = esquema.safeParse(valor);
      if (!validado.success) error(campo.codigo, validado.error.issues[0]!.message);
      if (campo.codigo === 'promedioSecundaria' && Number(valor) > 20)
        error(campo.codigo, 'El promedio debe estar entre 0 y 20.');
      if (campo.codigo === 'horasEstudio' && Number(valor) > 24)
        error(campo.codigo, 'Un día tiene como máximo 24 horas.');
      const opciones = campo.tipo === 'booleano' ? ['Sí', 'No'] : campo.opciones;
      let lista: string[] = [];
      if (campo.tipo === 'multiple') {
        try {
          const resultado = listaSchema.safeParse(JSON.parse(valor));
          if (!resultado.success) error(campo.codigo, 'Selecciona las opciones de la lista.');
          else lista = resultado.data;
        } catch {
          // Las primeras versiones guardaban una selección múltiple como texto simple.
          lista = [valor];
        }
        if (campo.obligatorio && !lista.length)
          error(campo.codigo, 'Completa esta respuesta para enviar.');
        if (
          new Set(lista).size !== lista.length ||
          (lista.length > 1 && lista.some((v) => OPCIONES_EXCLUSIVAS.includes(v)))
        )
          error(
            campo.codigo,
            'Revisa las opciones: no combines respuestas excluyentes ni las repitas.',
          );
      }
      if (
        opciones?.length &&
        campo.tipo !== 'tabla' &&
        (campo.tipo === 'multiple'
          ? lista.some((v) => !opciones.includes(v))
          : !opciones.includes(valor))
      )
        error(campo.codigo, 'Selecciona una opción válida de la lista.');
      if (campo.tipo === 'tabla') {
        let filas: RespuestasInstrumento[] = [];
        try {
          const resultado = filasSchema.safeParse(JSON.parse(valor));
          if (!resultado.success) error(campo.codigo, 'Revisa los registros de la tabla.');
          else filas = resultado.data;
        } catch {
          error(campo.codigo, 'Revisa los registros de la tabla.');
        }
        if (
          (campo.obligatorio && !filas.length) ||
          filas.some((fila) =>
            campo.columnas?.some((col) => {
              const contenido = fila[col.codigo]?.trim() ?? '';
              return (
                !contenido ||
                (col.tipo === 'numero' && !numeroSchema.safeParse(contenido).success) ||
                (col.tipo === 'fecha' && !fechaSchema.safeParse(contenido).success) ||
                (col.tipo === 'seleccion' && !col.opciones?.includes(contenido))
              );
            }),
          )
        )
          error(campo.codigo, 'Completa las columnas de cada fila o elimina la fila vacía.');
        if (
          campo.codigo === 'administracionTiempo' &&
          filas.reduce((total, fila) => total + Number(fila.horas || 0), 0) > 24
        )
          error(campo.codigo, 'Revisa las horas: el total de un día no puede superar 24.');
        if (campo.codigo === 'asistentes') {
          const ids = filas.map((f) => f.estudianteId || f.nombre?.trim()).filter(Boolean);
          if (new Set(ids).size !== ids.length)
            error(campo.codigo, 'No repitas al mismo estudiante en la asistencia.');
        }
      }
      if (opciones?.includes('Otro') && (valor === 'Otro' || lista.includes('Otro'))) {
        const otro = valores[`${campo.codigo}__otro`]?.trim() ?? '';
        if (!otro) error(`${campo.codigo}__otro`, 'Indica brevemente tu otra respuesta.');
        else if (otro.length > 200)
          error(`${campo.codigo}__otro`, 'Usa como máximo 200 caracteres.');
      }
    }
    const codigos = new Set(visibles.map((c) => c.codigo));
    if (
      codigos.has('horaFin') &&
      valores.horaInicio &&
      valores.horaFin &&
      valores.horaFin <= valores.horaInicio
    )
      error('horaFin', 'La hora de fin debe ser posterior al inicio.');
    if (valores.resultado === 'Se programa nueva cita para seguimiento') {
      if (valores.proximaCita && valores.proximaCita < fechaTutoria())
        error('proximaCita', 'La cita de seguimiento no puede estar en el pasado.');
      if (valores.horaCita && valores.horaFinCita && valores.horaFinCita <= valores.horaCita)
        error('horaFinCita', 'La hora de fin debe ser posterior al inicio.');
    }
    if (
      ['F06', 'F07', 'F08', 'F12'].includes(definicion.codigo) &&
      valores.fecha &&
      valores.fecha > fechaTutoria()
    )
      error('fecha', 'Registra una atención ya realizada; la fecha no puede ser futura.');
  });
}

export function erroresInstrumento(
  definicion: DefinicionFormato,
  valores: RespuestasInstrumento,
): RespuestasInstrumento {
  const resultado = crearEsquemaRespuestas(definicion).safeParse(valores);
  if (resultado.success) return {};
  const errores: RespuestasInstrumento = {};
  for (const issue of resultado.error.issues) {
    const codigo = String(issue.path[0] ?? 'formulario');
    errores[codigo] ??= issue.message;
  }
  return errores;
}

/** Se normalizan las tablas solo en el editor; el contrato guardado sigue siendo compatible. */
export function deserializarFormulario(
  definicion: DefinicionFormato,
  valores: RespuestasInstrumento,
): ValoresFormularioInstrumento {
  const respuestas = { ...valores };
  const tablas: ValoresFormularioInstrumento['tablas'] = {};
  for (const campo of definicion.secciones.flatMap((s) => s.campos)) {
    if (campo.tipo !== 'tabla') continue;
    tablas[campo.codigo] = filasRespuesta(valores[campo.codigo] ?? '');
    delete respuestas[campo.codigo];
  }
  return { respuestas, tablas };
}
export function serializarFormulario(valores: ValoresFormularioInstrumento): RespuestasInstrumento {
  return {
    ...valores.respuestas,
    ...Object.fromEntries(
      Object.entries(valores.tablas).map(([codigo, filas]) => [
        codigo,
        filas.length ? JSON.stringify(filas) : '',
      ]),
    ),
  };
}
export function crearEsquemaFormulario(definicion: DefinicionFormato) {
  const esquema = crearEsquemaRespuestas(definicion);
  const tablas = new Set(
    definicion.secciones
      .flatMap((s) => s.campos)
      .filter((c) => c.tipo === 'tabla')
      .map((c) => c.codigo),
  );
  return z
    .object({
      respuestas: z.record(z.string(), z.string()),
      tablas: z.record(z.string(), filasSchema),
    })
    .superRefine((valores, ctx) => {
      const resultado = esquema.safeParse(serializarFormulario(valores));
      if (resultado.success) return;
      for (const issue of resultado.error.issues) {
        const codigo = String(issue.path[0]);
        ctx.addIssue({
          code: 'custom',
          path: [tablas.has(codigo) ? 'tablas' : 'respuestas', codigo],
          message: issue.message,
        });
      }
    });
}
