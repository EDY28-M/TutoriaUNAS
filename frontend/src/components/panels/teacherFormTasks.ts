import type { CodigoFormato } from '../../types/domain';
import { tituloEntrevista } from '../../utils/entrevistas';
import { FileText, HandHeart, ListChecks, Send, UserCheck, UsersRound } from '../ui/icons';
import type { Icono } from '../ui/icons';

interface TareaTutor {
  codigo: CodigoFormato;
  titulo: string;
  icono: Icono;
  cierre: boolean;
}

export const tareasTutor: TareaTutor[] = [
  { codigo: 'F06', titulo: 'Tutoría individual', icono: UserCheck, cierre: false },
  { codigo: 'F07', titulo: 'Tutoría grupal', icono: UsersRound, cierre: false },
  { codigo: 'F08', titulo: 'Atención personalizada', icono: HandHeart, cierre: false },
  { codigo: 'F12', titulo: 'Derivación', icono: Send, cierre: false },
  { codigo: 'F09', titulo: 'Autoevaluación', icono: ListChecks, cierre: true },
  { codigo: 'F02', titulo: 'Informe del semestre', icono: FileText, cierre: true },
];

export function tituloFormulario(codigo: CodigoFormato) {
  return (
    tareasTutor.find((tarea) => tarea.codigo === codigo)?.titulo ??
    (codigo === 'F10'
      ? 'Evaluación individual'
      : codigo === 'F11'
        ? 'Evaluación grupal'
        : tituloEntrevista(codigo))
  );
}
