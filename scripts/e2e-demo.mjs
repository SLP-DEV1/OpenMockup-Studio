import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

const playwrightModule = process.env.OPENMOCKUP_PLAYWRIGHT_MODULE || "playwright";
const playwrightSpecifier = playwrightModule.startsWith("/")
  ? pathToFileURL(playwrightModule).href
  : playwrightModule;
const { chromium } = await import(playwrightSpecifier);

const HOST = "127.0.0.1";
const PORT = 4173;
const BASE_URL = `http://${HOST}:${PORT}`;
const viteBin = join(process.cwd(), "node_modules", "vite", "bin", "vite.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(timeoutMs = 15_000) {
  const startedAt = Date.now();
  let lastError = "not ready";
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(1500) });
      if (response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(250);
  }
  throw new Error(`Vite preview did not become ready: ${lastError}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForDesignsLoaded(page) {
  await page.locator(".status-pill").filter({ hasText: "2 designs loaded" }).waitFor({ state: "visible" });
}

async function waitForGeneratedPreview(page, timeoutMs = 20_000) {
  const preview = page.locator('img[alt="Generated mockup preview"]');
  const status = page.locator(".status-pill");
  const startedAt = Date.now();
  let lastStatus = "";

  while (Date.now() - startedAt < timeoutMs) {
    if (await preview.isVisible().catch(() => false)) return;
    lastStatus = (await status.textContent().catch(() => ""))?.trim() || "";
    if (/failed|could not|error|invalid|unsupported/i.test(lastStatus)) {
      throw new Error(`Preview failed in the UI: ${lastStatus}`);
    }
    await sleep(250);
  }

  throw new Error(`Preview did not appear within ${timeoutMs}ms. Last UI status: ${lastStatus || "<empty>"}`);
}

const previewProcess = spawn(process.execPath, [
  viteBin,
  "preview",
  "--host",
  HOST,
  "--port",
  String(PORT),
  "--strictPort",
], {
  stdio: ["ignore", "pipe", "pipe"],
});

previewProcess.stdout.on("data", (chunk) => process.stdout.write(chunk));
previewProcess.stderr.on("data", (chunk) => process.stderr.write(chunk));

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  page.on("pageerror", (error) => console.error(`[browser pageerror] ${error.message}`));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      console.error(`[browser ${message.type()}] ${message.text()}`);
    }
  });

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "OpenMockup Studio" }).waitFor();
  await page.getByRole("button", { name: "Try sample project" }).click();
  await waitForDesignsLoaded(page);
  await page.getByRole("button", { name: "Use my files" }).click();

  const fileInputs = page.locator('input[type="file"]');
  await fileInputs.nth(0).setInputFiles(join(process.cwd(), "public", "examples", "sample-poster-mockup.png"));
  await fileInputs.nth(1).setInputFiles([
    join(process.cwd(), "public", "examples", "sample-design-sun.png"),
    join(process.cwd(), "public", "examples", "sample-design-leaf.png"),
  ]);

  await waitForDesignsLoaded(page);
  const refreshButton = page.getByRole("button", { name: "Refresh Preview" });
  await refreshButton.waitFor({ state: "visible" });
  await refreshButton.click();
  await waitForGeneratedPreview(page);

  const advancedToolsSummary = page.locator("summary").filter({ hasText: "Advanced Tools" });
  await advancedToolsSummary.waitFor({ state: "visible" });
  await advancedToolsSummary.click();

  const presetButton = page.getByRole("button", { name: "Export Preset JSON" });
  await presetButton.waitFor({ state: "visible" });
  const [presetDownload] = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }),
    presetButton.click(),
  ]);
  const presetPath = await presetDownload.path();
  assert(presetPath, "Preset download did not produce a file.");
  assert(presetDownload.suggestedFilename().endsWith(".json"), "Preset download filename is not JSON.");
  assert((await stat(presetPath)).size > 20, "Preset download is unexpectedly empty.");

  const exportButton = page.getByRole("button", { name: /Export All/ });
  await exportButton.waitFor({ state: "visible" });
  const [zipDownload] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    exportButton.click(),
  ]);
  const zipPath = await zipDownload.path();
  assert(zipPath, "Batch export did not produce a ZIP file.");
  assert(zipDownload.suggestedFilename().endsWith(".zip"), "Batch export filename is not a ZIP.");
  assert((await stat(zipPath)).size > 100, "Batch ZIP is unexpectedly empty.");

  console.log("Browser smoke passed: file selection, preview, preset download and batch ZIP export.");
} finally {
  if (browser) await browser.close();
  if (!previewProcess.killed) previewProcess.kill("SIGTERM");
}
