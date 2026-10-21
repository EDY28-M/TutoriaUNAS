export type AuthModalId = 'soporte' | 'privacidad';
export type AuthVariant = 'login' | 'recovery';

export interface ModalRow {
  label: string;
  value?: string;
  link?: { href: string; text: string; external?: boolean };
}

interface ModalCopy {
  eyebrow: string;
  title: string;
  sub: string;
  rows: ModalRow[];
  action: string;
}

export interface ModalDefinition extends ModalCopy {
  id: AuthModalId;
}

/**
 * Contenido literal de los modales institucionales de los diseños
 * `01-selva.html` (login) y `01-recuperar.html` (recuperación).
 */
const modalCopy: Record<AuthVariant, Record<AuthModalId, ModalCopy>> = {
  login: {
    soporte: {
      eyebrow: 'Acceso institucional',
      title: 'Soporte y Mesa de Ayuda',
      sub: 'Oficina de Tutoría · UNAS Tingo María',
      rows: [
        {
          label: 'Correo',
          link: { href: 'mailto:tutoria@unas.edu.pe', text: 'tutoria@unas.edu.pe' },
        },
        {
          label: 'WhatsApp',
          link: { href: 'https://wa.me/51962000000', text: '+51 962 000 000', external: true },
        },
        { label: 'Horario', value: 'Lun – Vie · 8:00 a. m. a 5:00 p. m.' },
        { label: 'Ubicación', value: 'Pabellón Central · 2.° piso' },
      ],
      action: 'Entendido',
    },
    privacidad: {
      eyebrow: 'Protección de datos',
      title: 'Política de Privacidad',
      sub: 'Tratamiento de información según Ley N.° 29733',
      rows: [
        {
          label: 'Finalidad',
          value: 'Los registros se usan únicamente para el acompañamiento tutorial del estudiante.',
        },
        {
          label: 'Reserva',
          value: 'Las sesiones y acuerdos entre tutor y tutorado son estrictamente confidenciales.',
        },
        {
          label: 'Seguridad',
          value: 'Acceso institucional seguro bajo protocolos y cifrado de la UNAS.',
        },
      ],
      action: 'Aceptar y cerrar',
    },
  },
  recovery: {
    soporte: {
      eyebrow: 'Acceso institucional',
      title: 'Soporte y Mesa de Ayuda',
      sub: 'Oficina de Tutoría · UNAS Tingo María',
      rows: [
        {
          label: 'Correo',
          link: { href: 'mailto:tutoria@unas.edu.pe', text: 'tutoria@unas.edu.pe' },
        },
        {
          label: 'WhatsApp',
          link: { href: 'https://wa.me/51962000000', text: '+51 962 000 000', external: true },
        },
        { label: 'Horario', value: 'Lun – Vie · 8:00 a. m. a 5:00 p. m.' },
      ],
      action: 'Entendido',
    },
    privacidad: {
      eyebrow: 'Protección de datos',
      title: 'Política de Privacidad',
      sub: 'Tratamiento de información según Ley N.° 29733',
      rows: [
        {
          label: 'Finalidad',
          value: 'Los registros se usan únicamente para el acompañamiento tutorial del estudiante.',
        },
        {
          label: 'Reserva',
          value: 'Las sesiones entre tutor y tutorado son estrictamente confidenciales.',
        },
      ],
      action: 'Aceptar y cerrar',
    },
  },
};

export function modalDefinitions(variant: AuthVariant): ModalDefinition[] {
  const copy = modalCopy[variant];
  return [
    { id: 'soporte', ...copy.soporte },
    { id: 'privacidad', ...copy.privacidad },
  ];
}
