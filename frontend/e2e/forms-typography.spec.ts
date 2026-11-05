import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

async function tipografia(elemento: Locator) {
  await elemento.first().waitFor();
  return elemento.first().evaluate((e) => {
    const css = getComputedStyle(e);
    return {
      familia: css.fontFamily,
      tamano: css.fontSize,
      peso: css.fontWeight,
      espaciado: css.letterSpacing,
    };
  });
}

for (const cuenta of [
  { rol: 'estudiante', etiqueta: 'Estudiante', usuario: '2023010456' },
  { rol: 'tutor', etiqueta: 'Tutor', usuario: 'DOC-0421' },
]) {
  for (const ancho of [375, 1440]) {
    test(`${cuenta.rol}: formularios con la tipografía de los demás módulos a ${ancho}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: ancho, height: 1000 });
      await page.goto('/login');

      await page.locator('#identifier').fill(cuenta.usuario);
      await page.locator('#password').fill('tutoria2026');
      await page.locator('.d01__form .d01__cta').click();
      await expect(page).toHaveURL(/dashboard/);
      await page.goto(`/${cuenta.rol}/sesiones`);
      await page.evaluate(() => document.fonts.ready);
      const titulo = await tipografia(page.locator('.page-head h1'));
      // Sesiones ya no muestra insignias: la referencia se mide en el perfil.
      await page.goto(`/${cuenta.rol}/perfil`);
      const estado = await tipografia(page.locator('.badge'));
      const tarjeta = await tipografia(page.locator('.card__head h2'));
      const boton = await tipografia(page.locator('.btn-primary'));
      const campo = await tipografia(page.locator('.input'));
      await page.goto(`/${cuenta.rol}/instrumentos`);
      await expect(
        page.getByRole('heading', { name: 'Mis formularios', exact: true }),
      ).toBeVisible();
      if (cuenta.rol === 'estudiante')
        await expect(page.getByLabel('Momento del semestre')).toHaveCount(0);
      const tutor = cuenta.rol === 'tutor';
      expect(
        await tipografia(page.locator(tutor ? '.forms-panel__header h1' : '.page-head h1')),
      ).toEqual(titulo);
      expect(
        await tipografia(page.locator(tutor ? '.teacher-task h3' : '.sf-entrevista__titulo')),
      ).toMatchObject({ familia: tarjeta.familia, espaciado: tarjeta.espaciado });
      expect(
        await tipografia(page.locator(tutor ? '.teacher-task .btn' : '.sf-entrevista .btn')),
      ).toMatchObject({ familia: boton.familia, espaciado: boton.espaciado });
      expect(
        await tipografia(page.locator(tutor ? '.teacher-task .badge' : '.sf-panel .badge')),
      ).toMatchObject({ familia: estado.familia, peso: estado.peso, espaciado: estado.espaciado });
      if (cuenta.rol === 'tutor') {
        expect(
          await tipografia(page.getByRole('searchbox', { name: 'Buscar', exact: true })),
        ).toMatchObject({ familia: campo.familia, espaciado: campo.espaciado });
        await page.getByRole('button', { name: 'Completar formato 08', exact: true }).click();
        const buscador = page
          .getByRole('dialog')
          .getByRole('combobox', { name: 'Estudiante', exact: true });
        expect(await tipografia(buscador)).toMatchObject({
          familia: campo.familia,
          espaciado: campo.espaciado,
        });
        await buscador.fill('2023010456');
        await buscador.press('Enter');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Continuar', exact: true })
          .click();
      } else {
        await page.getByRole('link', { name: /Entrevista inicial/ }).click();
      }
      // El tutor completa en un diálogo; el tutorado, en su propia página.
      const formulario = tutor ? page.getByRole('dialog') : page.locator('.sf-llenado');
      expect(await tipografia(formulario.locator('.tutoring-field .input'))).toMatchObject({
        familia: campo.familia,
        espaciado: campo.espaciado,
      });
      const fuentes = await formulario
        .locator('h1, h2, h3, p, label, input, select, textarea, button')
        .evaluateAll((elementos) => elementos.map((e) => getComputedStyle(e).fontFamily));
      expect(fuentes.every((familia) => familia.includes('Manrope Variable'))).toBe(true);
    });
  }
}
