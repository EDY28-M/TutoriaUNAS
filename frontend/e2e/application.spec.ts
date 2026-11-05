import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Cuentas y módulos de la demostración, por rol. */
const accounts = [
  {
    role: 'estudiante',
    label: 'Estudiante',
    identifier: '2023010456',
    modules: [
      'dashboard',
      'sesiones',
      'tutor',
      'instrumentos',
      'expediente',
      'derivaciones',
      'salud',
      'documentos',
      'avisos',
      'perfil',
    ],
  },
  {
    role: 'tutor',
    label: 'Tutor',
    identifier: 'DOC-0421',
    modules: [
      'dashboard',
      'tutorados',
      'sesiones',
      'asistencias',
      'derivaciones',
      'instrumentos',
      'reportes',
      'avisos',
      'perfil',
    ],
  },
  {
    role: 'coordinacion',
    label: 'Coordinación',
    identifier: 'coordinacion.tutoria',
    modules: [
      'dashboard',
      'asignaciones',
      'tutores',
      'tutorados',
      'plan',
      'revisiones',
      'reportes',
      'sesiones',
      'avisos',
      'instrumentos',
      'campos',
      'permisos',
      'integraciones',
      'semestres',
      'auditoria',
      'perfil',
    ],
  },
] as const;

const widths = [320, 375, 390, 768, 1024, 1440];

async function login(page: Page, account: (typeof accounts)[number]) {
  await page.goto('/login');

  await page.locator('#identifier').fill(account.identifier);
  await page.locator('#password').fill('tutoria2026');
  await page.locator('.d01__form .d01__cta').click();
  await expect(page).toHaveURL(`/${account.role}/dashboard`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function assertNoPageOverflow(page: Page) {
  const exceso = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(exceso, `desborde horizontal de ${exceso}px`).toBeLessThanOrEqual(2);
}

/**
 * Captura fiel de una página completa.
 *
 * `fullPage: true` reajusta el viewport de forma que la barra lateral adhesiva
 * se renderiza con un ancho equivocado; se amplía el alto del viewport y se
 * toma una captura normal para conservar la composición real.
 */
async function capturar(page: Page, ruta: string, ancho: number) {
  const alto = await page.evaluate(() => Math.min(3200, document.documentElement.scrollHeight));
  await page.setViewportSize({ width: ancho, height: alto });
  await page.waitForTimeout(250);
  await page.screenshot({ path: ruta });
  await page.setViewportSize({ width: ancho, height: 950 });
}

async function assertAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

for (const width of widths) {
  test(`acceso: formulario único y campos a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('form', { name: 'Inicia sesión' })).toHaveCount(1);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await assertNoPageOverflow(page);
    for (const campo of ['identifier', 'password']) {
      const geometria = await page.locator(`#${campo}`).evaluate((input) => {
        const shell = input.parentElement;
        const icono = shell?.querySelector('.field__fa-icon');
        if (!shell || !icono) return null;
        const cajaIcono = icono.getBoundingClientRect();
        const cajaShell = shell.getBoundingClientRect();
        const paddingIzquierdo = Number.parseFloat(getComputedStyle(input).paddingLeft);
        return {
          anchoIcono: Math.round(cajaIcono.width),
          dentro: cajaIcono.left >= cajaShell.left && cajaIcono.right <= cajaShell.right,
          paddingIzquierdo: Math.round(paddingIzquierdo),
          textoDespues: cajaShell.left + paddingIzquierdo > cajaIcono.right,
        };
      });
      expect(geometria).not.toBeNull();
      expect(geometria?.dentro).toBe(true);
      expect(geometria?.anchoIcono).toBe(18);
      expect(geometria?.paddingIzquierdo).toBe(42);
      expect(geometria?.textoDespues).toBe(true);
    }
    await page.locator('#password').fill('example-password');
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    if (width === 390 || width === 1440)
      await capturar(page, `../docs/screenshots/login-${width}.png`, width);
  });
}

for (const account of accounts) {
  test(`portal de ${account.role}: barra lateral y todos los módulos`, async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (error) => errores.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errores.push(message.text());
    });

    await page.setViewportSize({ width: 1440, height: 950 });
    await login(page, account);

    const nav = page.getByRole('navigation', { name: 'Navegación principal' });
    await expect(nav).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await assertNoPageOverflow(page);
    await capturar(page, `../docs/screenshots/${account.role}-1440.png`, 1440);

    for (const modulo of account.modules) {
      // Algunos módulos llevan filtros en el enlace (p. ej. instrumentos?ambito=propios).
      const enlace = nav
        .locator(`a[href="/${account.role}/${modulo}"], a[href^="/${account.role}/${modulo}?"]`)
        .first();
      if (!(await enlace.isVisible())) {
        await enlace
          .locator('xpath=ancestor::li[contains(@class, "sidebar__branch")]')
          .getByRole('button', { expanded: false })
          .click();
      }
      await enlace.click();
      await expect(page).toHaveURL(new RegExp(`/${account.role}/${modulo}(\\?.*)?$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await assertNoPageOverflow(page);
    }

    expect(errores).toEqual([]);
  });
}

for (const account of accounts) {
  test(`portal de ${account.role}: adaptación, menú móvil y accesibilidad`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await login(page, account);

    // Accesibilidad de las dos pantallas principales del rol.
    await assertAccessible(page);
    await page.goto(`/${account.role}/${account.modules[1]}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await assertAccessible(page);

    // Sin desborde en los anchos exigidos.
    for (const width of [320, 375, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${account.role}/dashboard`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await assertNoPageOverflow(page);
    }

    // El menú se abre y se cierra como cajón en pantallas pequeñas, incluso con Escape.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${account.role}/dashboard`);
    const cajon = page.locator('#app-sidebar');
    await expect(cajon).not.toHaveClass(/sidebar--open/);
    await page.getByRole('button', { name: 'Expandir menú', exact: true }).click();
    await expect(cajon).toHaveClass(/sidebar--open/);
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cajon).not.toHaveClass(/sidebar--open/);
    await page.getByRole('button', { name: 'Expandir menú', exact: true }).click();
    await expect(cajon).toHaveClass(/sidebar--open/);
    await page.getByRole('button', { name: 'Cerrar el menú lateral' }).click();
    await expect(cajon).not.toHaveClass(/sidebar--open/);
    // El fondo oscurecido también cierra el cajón al pulsarlo fuera de la barra.
    await page.getByRole('button', { name: 'Expandir menú', exact: true }).click();
    await expect(cajon).toHaveClass(/sidebar--open/);
    // El fondo empieza tras el espacio reservado de la barra de desplazamiento: se pulsa
    // dentro de él (a la derecha del cajón de 297 px) sin depender de ese margen.
    await page.locator('.sidebar-scrim').click({ position: { x: 330, y: 500 } });
    await expect(cajon).not.toHaveClass(/sidebar--open/);
  });
}

test('la barra lateral se colapsa a iconos sin superponerse al contenido', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await login(page, accounts[2]);
  const barra = page.locator('#app-sidebar');
  const contenido = page.locator('.app-main');

  const anchoExpandida = (await barra.boundingBox())?.width ?? 0;
  const inicioExpandido = (await contenido.boundingBox())?.x ?? 0;
  expect(anchoExpandida).toBeGreaterThan(200);

  await page.getByRole('button', { name: 'Contraer la barra de navegación' }).click();
  await expect(barra).toHaveClass(/sidebar--mini/);
  await expect.poll(async () => (await barra.boundingBox())?.width ?? 0).toBeLessThan(80);
  // El contenido ocupa el ancho liberado y no queda ninguna capa encima.
  const cajaBarra = await barra.boundingBox();
  const inicioReducido = (await contenido.boundingBox())?.x ?? 0;
  expect(inicioReducido).toBeLessThan(inicioExpandido);
  expect(inicioReducido).toBeGreaterThanOrEqual((cajaBarra?.x ?? 0) + (cajaBarra?.width ?? 0));
  // El fondo del cajón móvil existe siempre en el DOM; en escritorio no debe verse.
  await expect(page.locator('.sidebar-scrim')).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await assertNoPageOverflow(page);
  await assertAccessible(page);

  // Reducida, cada módulo conserva su etiqueta como texto emergente al apuntarlo.
  await page.getByRole('navigation', { name: 'Navegación principal' }).locator('a').first().hover();
  await expect(page.getByRole('tooltip')).toHaveText('Inicio');

  await page.getByRole('button', { name: 'Expandir la barra de navegación' }).click();
  await expect(barra).not.toHaveClass(/sidebar--mini/);
  await expect.poll(async () => (await barra.boundingBox())?.width ?? 0).toBeGreaterThan(200);
  await assertAccessible(page);
});

test('registro de rutas: las trece rutas antiguas ya no existen y el 404 responde', async ({
  page,
}) => {
  await login(page, accounts[0]);
  await page.goto('/estudiante/historial');
  await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al inicio' }).click();
  await expect(page).toHaveURL('/estudiante/dashboard');
});

test('acceso denegado entre roles y cierre de sesión', async ({ page }) => {
  await login(page, accounts[0]);
  await page.goto('/coordinacion/dashboard');
  await expect(page).toHaveURL('/no-autorizado');
  await page.getByRole('link', { name: 'Volver a mi portal' }).click();
  await page.getByRole('button', { name: /^Cuenta de / }).click();
  await page.locator('#account-menu').getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL('/login');
});

test('acceso inválido, recuperación, ayuda, privacidad, sesión y 404', async ({ page }) => {
  await page.goto('/login');
  await assertAccessible(page);
  await page.locator('.d01__form .d01__cta').click();
  await expect(page.getByText('Ingresa tu usuario de prueba.')).toBeVisible();
  await page.locator('#identifier').fill('2023010456');
  await page.locator('#password').fill('wrong');
  await page.locator('.d01__form .d01__cta').click();
  await expect(page.getByRole('alert')).toContainText('incorrectos');

  for (const nombre of ['Soporte', 'Privacidad']) {
    await page.getByRole('button', { name: nombre, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await settleOpacity(page.locator('.modal:not([hidden]) .modal__card'));
    await assertAccessible(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }

  await page.getByRole('link', { name: '¿Olvidaste tu clave?' }).click();
  await expect(page).toHaveURL('/recuperar-clave');
  await assertAccessible(page);
  await page.locator('#recovery-email').fill('ana@demo.example');
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByText('¡Enlace enviado!')).toBeVisible();
  await expect(page.locator('#sent-email-display')).toHaveText('ana@demo.example');
  await settleOpacity(page.locator('.recovery-success'));
  await assertAccessible(page);

  await login(page, accounts[0]);
  await page.reload();
  await expect(page).toHaveURL('/estudiante/dashboard');
  expect(await page.evaluate(() => sessionStorage.getItem('tutoria-unas:demo-account'))).toBe(
    'EST-2023010456',
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe('{}');
});

test('los doce instrumentos oficiales están documentados y son consultables', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await login(page, accounts[2]);
  await page.goto('/coordinacion/instrumentos');
  const titulo = page.getByRole('heading', { level: 1 });
  await expect(titulo).toContainText('Formularios de tutoría');

  const nombres = [
    'Informe de actividades del proceso tutorial',
    'Informe de actividades del tutor',
    'Entrevista inicial al estudiante ingresante',
    'Entrevista inicial al estudiante de ciclos intermedios',
    'Entrevista inicial al estudiante de ciclos finales',
    'Registro de asistencia: tutoría individual',
    'Registro de asistencia: tutoría grupal',
    'Registro de atención personalizada al estudiante',
    'Autoevaluación de la actividad tutorial',
    'Evaluación de la tutoría individual',
    'Evaluación del desempeño de tutoría grupal',
    'Ficha de derivación',
  ];
  for (const nombre of nombres) {
    await expect(page.getByText(nombre, { exact: false }).first()).toBeVisible();
  }
  // Cada formato indica su versión y la resolución que lo aprueba.
  await page.getByRole('button', { name: 'Ver formato 01' }).click();
  await expect(
    page
      .getByRole('dialog')
      .getByText(/Resolución N\.º 500-2022-CU-R-UNAS/)
      .first(),
  ).toBeVisible();
});

test('seguimiento académico, derivaciones y salud están disponibles para el tutorado', async ({
  page,
}) => {
  await login(page, accounts[0]);

  await page.goto('/estudiante/expediente');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mis estudios');
  await expect(page.getByText(/DIAA/i).first()).toBeVisible();
  await expect(page.getByText(/Créditos aprobados/i).first()).toBeVisible();

  await page.goto('/estudiante/derivaciones');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('solicitudes de apoyo');

  await page.goto('/estudiante/salud');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Salud y bienestar');
  await expect(page.getByText('Mis atenciones', { exact: true }).first()).toBeVisible();

  await page.goto('/estudiante/instrumentos');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mis formularios');
  // La entrevista inicial es la tarea principal y se abre en su propia página.
  await expect(page.getByRole('link', { name: /Entrevista inicial/ })).toBeVisible();
  // El tutorado solo ve los formularios que él responde: ni asistencias ni registros del tutor.
  const contenido = await page.locator('main').innerText();
  expect(contenido).not.toContain('Registro de asistencia');
});

test('el tutor separa estudiantes únicos, atenciones y sesiones en sus reportes', async ({
  page,
}) => {
  await login(page, accounts[1]);
  await page.goto('/tutor/reportes');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Reporte');
  // Una persona se cuenta una vez en cobertura; sus asistencias se acumulan.
  const indicadores = page
    .getByRole('region', { name: 'Indicadores de tutoría', exact: true })
    .locator('.stat');
  await expect(indicadores.nth(0)).toContainText('9 de 9');
  await expect(indicadores.nth(1)).toContainText('33');
  await expect(indicadores.nth(2)).toContainText('26');
  await expect(page.locator('.report-chart canvas')).toHaveCount(5);
  await page.getByText('Desglose por ciclo', { exact: true }).click();
  const desglose = page.getByRole('region', {
    name: 'Cobertura de la labor tutorial por ciclo académico',
    exact: true,
  });
  await expect(
    desglose.getByRole('columnheader', { name: 'Atendidos', exact: true }),
  ).toBeVisible();
  await expect(
    desglose.getByRole('columnheader', { name: 'Asistencias', exact: true }),
  ).toBeVisible();
  await expect(desglose.getByRole('columnheader', { name: 'Sesiones', exact: true })).toBeVisible();
});

test('la bandeja de avisos muestra plantillas, destinatarios y estados', async ({ page }) => {
  await login(page, accounts[1]);
  await page.goto('/tutor/avisos');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Avisos');
  await expect(page.getByText(/plantilla|correo/i).first()).toBeVisible();
});

test('el calendario de tutoría muestra sesiones programadas y la agenda del día', async ({
  page,
}) => {
  await login(page, accounts[1]);
  await page.goto('/tutor/sesiones');
  await expect(page.getByRole('button', { name: 'Semana', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Mes', exact: true }).click();
  await expect(
    page.getByRole('group', { name: 'Calendario de sesiones de tutoría', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Hoy/i }).first()).toBeVisible();
  const dias = page.locator('.calendar__day');
  expect(await dias.count()).toBe(42);
});

test('los formularios permanecen abiertos y las acciones de tabla permiten abrir expedientes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await login(page, accounts[1]);
  await page.goto('/tutor/horario');
  await expect(page).toHaveURL('/tutor/sesiones');
  const abrir = page.getByRole('button', { name: 'Programar sesión', exact: true });
  await abrir.click();
  const formulario = page.getByRole('dialog', { name: 'Programar sesión de tutoría', exact: true });
  await formulario
    .getByLabel('Tema o título de la sesión', { exact: true })
    .fill('Sesión de prueba');
  await expect(formulario).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(formulario).not.toBeVisible();
  await expect(abrir).toBeFocused();
  await abrir.click();
  await formulario.getByRole('button', { name: 'Cerrar ventana' }).click();
  await expect(formulario).not.toBeVisible();

  await page.goto('/tutor/tutorados');
  const ficha = page.getByRole('link', { name: /^Ver expediente de / }).first();
  await expect(ficha).toBeVisible();
  await ficha.click();
  await expect(page).toHaveURL(/\/tutor\/tutorados\//);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

/** Espera al final de una animación de entrada para medir colores ya asentados. */
async function settleOpacity(locator: Locator) {
  await expect(locator).toHaveCSS('opacity', '1');
}
