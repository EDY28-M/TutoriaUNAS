import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const baseURL = process.env.PORTAL_BASE_URL ?? "http://127.0.0.1:5187";
const output = fileURLToPath(
  new URL(
    "../artifacts/analisis-tutoria/auditoria-actual/reproducciones/",
    import.meta.url,
  ),
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const hallazgos = [];
const errores = [];
page.on("pageerror", (error) => errores.push(error.message));

async function login(label, identifier) {
  await page.goto(`${baseURL}/login`);
  await page.locator("#identifier").fill(identifier);
  await page.locator("#password").fill("tutoria2026");
  await page.locator('button[type="submit"]').click();
  await page.locator(".page-head h1").waitFor();
}
async function storage() {
  return page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
}

try {
  await page.setViewportSize({ width: 320, height: 950 });
  await page.goto(`${baseURL}/login`);
  await page.evaluate(() => document.fonts.ready);
  hallazgos.push({ id: "login-320", formularios: await page.getByRole("form").count() });
  await page.screenshot({ path: `${output}/login-320.png` });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await login("Tutor", "DOC-0421");
  await page.goto(`${baseURL}/tutor/tutorados/EST-2023010456`);
  await page
    .getByRole("button", { name: "Registrar sesión", exact: true })
    .click();
  const antesSesion = await storage();
  await page
    .getByRole("dialog")
    .screenshot({ path: `${output}/sesion-sin-guardar.png` });
  await page
    .getByRole("button", { name: "Registrar (demostración)", exact: true })
    .click();
  hallazgos.push({
    id: "ficha-registro-sesion",
    modalCerrado: (await page.getByRole("dialog").count()) === 0,
    almacenamientoSinCambios:
      JSON.stringify(antesSesion) === JSON.stringify(await storage()),
  });

  await page.goto(`${baseURL}/tutor/derivaciones`);
  await page
    .getByRole("button", { name: "Nueva solicitud de apoyo", exact: true })
    .click();
  await page
    .locator("#nueva-motivo")
    .fill("Caso ficticio de auditoría: técnicas de estudio");
  const antesFicha = await storage();
  await page
    .getByRole("button", {
      name: "Registrar ficha (demostración)",
      exact: true,
    })
    .click();
  hallazgos.push({
    id: "solicitud-apoyo-sin-guardar",
    modalCerrado: (await page.getByRole("dialog").count()) === 0,
    almacenamientoSinCambios:
      JSON.stringify(antesFicha) === JSON.stringify(await storage()),
    casoVisible: await page
      .getByText("Caso ficticio de auditoría: técnicas de estudio")
      .count(),
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/tutor/dashboard`);
  await page
    .getByRole("button", { name: "Expandir menú", exact: true })
    .click();
  await page.locator(".sidebar--open").waitFor();
  const fondo = await page.locator(".sidebar-scrim").evaluate((element) => ({
    caja: element.getBoundingClientRect().toJSON(),
    objetivo380: document.elementFromPoint(380, 500)?.className,
    anchoViewport: innerWidth,
  }));
  await page.mouse.click(380, 500);
  hallazgos.push({
    id: "fondo-menu-movil",
    ...fondo,
    cerrado: (await page.locator(".sidebar--open").count()) === 0,
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Origen Vite: inspección de los adaptadores públicos de demostración.
  // El contexto es aislado; no modifica los datos del navegador del usuario.
  hallazgos.push(
    await page.evaluate(async () => {
      const { obtenerWorkspace } =
        await import("/src/services/instrumentWorkspace.ts");
      const { programarSesion, consultarSesiones } =
        await import("/src/services/sessionWorkspace.ts");
      const { guardarAsistencia } =
        await import("/src/services/sessionAttendance.ts");
      const registros = obtenerWorkspace().registros;
      const tutor = { id: "DOC-0421", role: "tutor" };
      const futura = new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      const sesion = programarSesion(
        tutor,
        {
          tipo: "individual",
          fecha: futura,
          horaInicio: "02:00",
          horaFin: "03:00",
          modalidad: "virtual",
          lugar: "Sala ficticia",
          tema: "Caso de auditoría",
          objetivo: "Verificar enlace de asistencia con formato 06",
          estudiantes: ["EST-2023010456"],
        },
        registros,
      );
      const antes = registros.filter((r) => r.formato === "F06").length;
      const reloj = Date.now;
      let resultado;
      try {
        Date.now = () => Date.parse(`${futura}T10:00:00-05:00`);
        guardarAsistencia(
          tutor,
          sesion,
          sesion.asistentes.map((a) => ({
            ...a,
            estado: "asistio",
            horaRegistro: "02:00",
            observacion: null,
          })),
          "",
        );
        resultado = consultarSesiones(obtenerWorkspace().registros).find(
          (s) => s.id === sesion.id,
        );
      } finally {
        Date.now = reloj;
      }
      return {
        id: "asistencia-no-genera-f06",
        asistenciaConfirmada: resultado.asistenciaConfirmada,
        instrumentoId: resultado.instrumentoId,
        cantidadF06Antes: antes,
        cantidadF06Despues: obtenerWorkspace().registros.filter(
          (r) => r.formato === "F06",
        ).length,
      };
    }),
  );

  await context.clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await login("Coordinación", "coordinacion.tutoria");
  await page.goto(`${baseURL}/coordinacion/asignaciones`);
  await page
    .getByPlaceholder("Buscar por estudiante, código o tutor…")
    .fill("2023010456");
  const filaInicial = await page.locator("tbody tr").first().innerText();
  await page
    .getByRole("button", { name: /^Acciones del registro ASG-/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: /^Cambiar tutor de la asignación/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("select").selectOption({ index: 1 });
  await dialog
    .getByLabel("Motivo del cambio")
    .fill("CAMBIO-FICTICIO-AUDITORIA-2026");
  await dialog.getByRole("button", { name: /Registrar cambio/ }).click();
  const mensajeAntes = await page
    .getByText("Cambio guardado en esta prueba", { exact: true })
    .count();
  const filaModificada = await page.locator("tbody tr").first().innerText();
  await page.reload();
  await page.locator(".page-head h1").waitFor();
  await page
    .getByPlaceholder("Buscar por estudiante, código o tutor…")
    .fill("2023010456");
  const filaRecargada = await page.locator("tbody tr").first().innerText();
  hallazgos.push({
    id: "asignacion-perdida-recarga",
    mensajeAntes,
    filaInicial,
    filaModificada,
    filaRecargada,
    cambioVisible: filaModificada !== filaInicial,
    vuelveAlOriginal: filaRecargada === filaInicial,
  });
} finally {
  await writeFile(
    `${output}/resultado.json`,
    JSON.stringify({ baseURL, hallazgos, errores }, null, 2),
  );
  await browser.close();
  console.log(JSON.stringify({ hallazgos, errores, output }, null, 2));
}
