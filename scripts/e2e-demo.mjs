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
  await page.locator('img[alt="Generated mockup preview"]').waitFor({ state: "visible" });

  const presetDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Preset JSON" }).click();
  const presetDownload = await presetDownloadPromise;
  const presetPath = await presetDownload.path();
  assert(presetPath, "Preset download did not produce a file.");
  assert(presetDownload.suggestedFilename().endsWith(".json"), "Preset download filename is not JSON.");
  assert((await stat(presetPath)).size > 20, "Preset download is unexpectedly empty.");

  const exportButton = page.getByRole("button", { name: /Export All/ });
  await exportButton.waitFor({ state: "visible" });
  const zipDownloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await exportButton.click();
  const zipDownload = await zipDownloadPromise;
  const zipPath = await zipDownload.path();
  assert(zipPath, "Batch export did not produce a ZIP file.");
  assert(zipDownload.suggestedFilename().endsWith(".zip"), "Batch export filename is not a ZIP.");
  assert((await stat(zipPath)).size > 100, "Batch ZIP is unexpectedly empty.");

  console.log("Browser smoke passed: file selection, preview, preset download and batch ZIP export.");
} finally {
  if (browser) await browser.close();
  if (!previewProcess.killed) previewProcess.kill("SIGTERM");
}
