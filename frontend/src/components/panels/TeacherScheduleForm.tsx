import { useState } from 'react';
import type { FormEvent } from 'react';
import { z } from 'zod';
import { Sheet } from '../ui/Sheet';
import { calendarInputSchema } from '../../types/calendar';
import type { CalendarInput, TeacherCalendarBlock } from '../../types/calendar';
import { semestres } from '../../data/catalogos';
import { DIAS_SEMANA, HOY_ISO } from '../../utils/fechas';

export function TeacherScheduleForm({
  kind,
  semesterId,
  existing,
  onSave,
  onClose,
}: {
  kind: CalendarInput['kind'];
  semesterId: string;
  existing?: TeacherCalendarBlock;
  onSave(input: CalendarInput, id?: string): Promise<unknown>;
  onClose(): void;
}) {
  const semester = semestres.find((item) => item.id === semesterId)!;
  const first =
    semester.fin < HOY_ISO
      ? semester.inicio
      : semester.inicio > HOY_ISO
        ? semester.inicio
        : HOY_ISO;
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      const input = calendarInputSchema.parse({
        kind,
        semesterId,
        title: kind === 'tutoria' ? 'Tutoría' : form.get('title'),
        days: form.getAll('days').map(Number),
        dateFrom: form.get('dateFrom'),
        dateTo: form.get('dateTo'),
        startTime: form.get('startTime'),
        endTime: form.get('endTime'),
        location: form.get('location'),
        modality: form.get('modality'),
        capacity: kind === 'tutoria' ? Number(form.get('capacity')) : undefined,
      });
      setSaving(true);
      await onSave(input, existing?.id);
      onClose();
    } catch (failure) {
      setError(
        failure instanceof z.ZodError
          ? failure.issues[0]!.message
          : failure instanceof Error
            ? failure.message
            : 'No se pudo guardar el horario.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet
      title={`${existing ? 'Editar' : 'Registrar'} ${kind === 'curso' ? 'curso' : 'horario de tutoría'}`}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn btn-falcon-default"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            type="submit"
            form="teacher-schedule-form"
            disabled={saving}
          >
            {saving ? 'Guardando…' : 'Guardar horario'}
          </button>
        </>
      }
    >
      <form id="teacher-schedule-form" className="stack" onSubmit={submit} noValidate>
        {error && (
          <p className="schedule-form-error" role="alert">
            {error}
          </p>
        )}
        {kind === 'curso' && (
          <label className="field">
            <span>Nombre del curso</span>
            <input
              className="input"
              name="title"
              required
              maxLength={100}
              defaultValue={existing?.title}
              autoFocus
            />
          </label>
        )}
        <fieldset className="schedule-days">
          <legend>Días</legend>
          {DIAS_SEMANA.map((day, index) => (
            <label key={day}>
              <input
                type="checkbox"
                name="days"
                value={index + 1}
                defaultChecked={existing ? existing.days.includes(index + 1) : index === 0}
              />
              <span>{day.slice(0, 3)}</span>
            </label>
          ))}
        </fieldset>
        <div className="field-grid">
          <label className="field">
            <span>Hora de inicio</span>
            <input
              className="input"
              type="time"
              name="startTime"
              required
              defaultValue={existing?.startTime ?? '08:00'}
            />
          </label>
          <label className="field">
            <span>Hora de fin</span>
            <input
              className="input"
              type="time"
              name="endTime"
              required
              defaultValue={existing?.endTime ?? '10:00'}
            />
          </label>
          <label className="field">
            <span>Desde</span>
            <input
              className="input"
              type="date"
              name="dateFrom"
              required
              min={semester.inicio}
              max={semester.fin}
              defaultValue={existing?.dateFrom ?? first}
            />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input
              className="input"
              type="date"
              name="dateTo"
              required
              min={semester.inicio}
              max={semester.fin}
              defaultValue={existing?.dateTo ?? semester.fin}
            />
          </label>
          <label className="field">
            <span>Modalidad</span>
            <select
              className="select"
              name="modality"
              defaultValue={existing?.modality ?? 'presencial'}
            >
              <option value="presencial">Presencial</option>
              <option value="virtual">Virtual</option>
              <option value="mixta">Mixta</option>
            </select>
          </label>
          {kind === 'tutoria' && (
            <label className="field">
              <span>Cupos</span>
              <input
                className="input"
                type="number"
                name="capacity"
                min={1}
                max={200}
                required
                defaultValue={existing?.capacity ?? 12}
              />
            </label>
          )}
        </div>
        <label className="field">
          <span>Aula o enlace</span>
          <input
            className="input"
            name="location"
            required
            maxLength={180}
            defaultValue={existing?.location}
          />
        </label>
        <p className="small muted">Se repite cada semana durante el rango indicado.</p>
      </form>
    </Sheet>
  );
}
