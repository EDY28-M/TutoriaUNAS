import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const baseURL = process.env.PORTAL_BASE_URL ?? "http://localhost:8080";
const output = new URL("../artifacts/tema-consistente/", import.meta.url);
const source = await readFile(
  new URL("../frontend/src/routes/AppRoutes.tsx", import.meta.url),
  "utf8",
);
const routes = [
  ...source.matchAll(
    /<Route path="(\/(?:estudiante|tutor|coordinacion)\/[^"\s]+)"/g,
  ),
].map((match) => match[1]);
const widths = [320, 375, 390, 768, 1024, 1440, 1920];
const accounts = [
  { role: "estudiante", label: "Estudiante", id: "2023010456" },
  { role: "tutor", label: "Tutor", id: "DOC-0421" },
  { role: "coordinacion", label: "Coordinación", id: "coordinacion.tutoria" },
];
const report = {
  baseURL,
  widths,
  passed: false,
  cases: [],
  findings: [],
  errors: [],
  network: [],
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch();

async function appearance(page) {
  await page.locator(".page-head h1").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  );
  return page.evaluate(() => {
    const smallText = [];
    let minimumTextSize = Infinity;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      if (
        !node.textContent.trim() ||
        !element ||
        element.closest(
          '.sr-only, [aria-hidden="true"], script, style, option, svg, canvas',
        )
      )
        continue;
      const css = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      if (
        css.visibility === "hidden" ||
        box.width <= 1 ||
        box.height <= 1 ||
        box.right < 0 ||
        box.left > innerWidth
      )
        continue;
      const size = parseFloat(css.fontSize);
      minimumTextSize = Math.min(minimumTextSize, size);
      if (size < 13.9)
        smallText.push({ text: node.textContent.trim().slice(0, 80), size });
    }
    const style = (selector) => {
      const css = getComputedStyle(document.querySelector(selector));
      return [
        css.fontFamily,
        css.fontSize,
        css.fontWeight,
        css.color,
        css.backgroundColor,
      ];
    };
    const rect = (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return [box.x, box.y, box.width, box.height];
    };
    return {
      theme: {
        body: style("body"),
        brand: style(".sidebar__brand-text strong"),
        menu: style(".sidebar__link-label"),
        heading: style(".page-head h1"),
        description: style(".page-head__text > p:not(.sr-only)"),
        topbar: style(".topbar"),
        brandBounds: rect(".sidebar__brand"),
        sidebarBounds: rect(".sidebar"),
        topbarBounds: rect(".topbar"),
        searchBounds: rect(".topbar__search"),
      },
      fontLoaded: document.fonts.check('600 16px "Manrope Variable"'),
      minimumTextSize,
      smallText,
      overflow: document.documentElement.scrollWidth - innerWidth,
      headingOffset:
        document.querySelector(".page-head h1").getBoundingClientRect().x -
        document.querySelector(".workspace").getBoundingClientRect().x,
    };
  });
}

try {
  for (const account of accounts) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      report.errors.push({ role: account.role, message: error.message }),
    );
    page.on("response", (response) => {
      if (response.status() >= 400) {
        report.network.push({ url: response.url(), status: response.status() });
      }
    });
    await page.goto(`${baseURL}/login`);
    await page.locator("#identifier").fill(account.id);
    await page.locator("#password").fill("tutoria2026");
    await page.locator('.d01__form button[type="submit"]').click();
    await page.waitForURL(`**/${account.role}/dashboard`);
    await page.goto(`${baseURL}/${account.role}/calendario`);
    const baseline = new Map();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      baseline.set(width, (await appearance(page)).theme);
    }
    for (let route of routes.filter((path) =>
      path.startsWith(`/${account.role}/`),
    )) {
      if (route.includes(":estudianteId")) {
        await page.goto(`${baseURL}/tutor/tutorados`);
        route = await page
          .locator('a[href^="/tutor/tutorados/"]')
          .first()
          .getAttribute("href");
      }
      await page.goto(`${baseURL}${route}`);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        const current = await appearance(page);
        const flags = [];
        if (
          JSON.stringify(current.theme) !== JSON.stringify(baseline.get(width))
        )
          flags.push("theme");
        if (!current.fontLoaded) flags.push("font");
        if (current.smallText.length) flags.push("small-text");
        if (current.overflow > 1) flags.push("overflow");
        if (Math.abs(current.headingOffset) > 1) flags.push("alignment");
        report.cases.push({ route, width, ...current, flags });
        if (flags.length) report.findings.push({ route, width, flags });
        if (
          /\/(dashboard|calendario)$/.test(route) &&
          [375, 1440].includes(width)
        ) {
          if (route.endsWith("/dashboard")) {
            await page.locator(".portal-chart canvas").nth(1).waitFor();
          }
          await page.screenshot({
            path: fileURLToPath(
              new URL(
                `${account.role}-${route.split("/").at(-1)}-${width}.png`,
                output,
              ),
            ),
            fullPage: route.endsWith("/dashboard"),
          });
        }
      }
    }
    await context.close();
  }
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.network, []);
  report.passed = true;
} finally {
  await writeFile(
    new URL("revision.json", output),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  console.log(
    JSON.stringify({
      passed: report.passed,
      routes: new Set(report.cases.map((entry) => entry.route)).size,
      cases: report.cases.length,
      findings: report.findings,
      errors: report.errors,
      network: report.network,
    }),
  );
}
