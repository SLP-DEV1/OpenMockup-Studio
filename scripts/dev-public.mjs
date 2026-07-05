import { spawn } from "node:child_process";
import { appendFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const APP_PORT = String(process.env.OPENMOCKUP_PORT || process.env.PORT || "5173");
const LOCAL_URL = (process.env.OPENMOCKUP_LOCAL_URL || `http://127.0.0.1:${APP_PORT}`).replace(/\/+$/, "");
const CLOUD_FLARED = findCloudflared();
const PID_FILE = join(process.cwd(), ".openmockup-pids.bat");
const URL_FILE = join(process.cwd(), ".openmockup-public-url.txt");
const LOG_FILE = join(process.cwd(), ".openmockup-public.log");
const tunnelUrlRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi;

const LOCAL_WAIT_MS = Number(process.env.OPENMOCKUP_LOCAL_WAIT_MS || 20_000);
const TUNNEL_CONNECT_WAIT_MS = Number(process.env.OPENMOCKUP_TUNNEL_CONNECT_WAIT_MS || 20_000);
const RETRY_MS = Number(process.env.OPENMOCKUP_RETRY_MS || 750);
const OPEN_DELAY_MS = Number(process.env.OPENMOCKUP_OPEN_DELAY_MS || 1500);
const TUNNEL_PROTOCOL = process.env.OPENMOCKUP_TUNNEL_PROTOCOL || "http2";

let viteProcess;
let tunnelProcess;
let shuttingDown = false;
let browserOpened = false;
let publicUrlStarted = false;
let tunnelConnected = false;
let tunnelConnectedResolver;

const tunnelConnectedPromise = new Promise((resolve) => {
  tunnelConnectedResolver = resolve;
});

function writeLauncherLog(message = "") {
  try {
    appendFileSync(LOG_FILE, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {
    // Logging must never break the launcher.
  }
}

function log(message = "") {
  const line = `[openmockup] ${message}`;
  console.log(line);
  writeLauncherLog(line);
}

function warn(message = "") {
  const line = `[openmockup] ${message}`;
  console.warn(line);
  writeLauncherLog(line);
}

function findCloudflared() {
  if (process.env.CLOUDFLARED_BIN) return process.env.CLOUDFLARED_BIN;
  if (process.platform !== "win32") return "cloudflared";

  const candidates = [
    "cloudflared.exe",
    "C:\\Program Files\\cloudflared\\cloudflared.exe",
    "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
    join(process.cwd(), "tools", "cloudflared.exe"),
  ];

  return candidates.find((candidate) => candidate !== "cloudflared.exe" && existsSync(candidate)) ?? "cloudflared.exe";
}

function removeRuntimeFiles() {
  for (const file of [PID_FILE, URL_FILE]) {
    try {
      rmSync(file, { force: true });
    } catch {
      // Ignore cleanup errors.
    }
  }
}

function writeRuntimeFiles(publicBaseUrl) {
  const lines = ["@echo off"];
  if (viteProcess?.pid) lines.push(`set OPENMOCKUP_VITE_PID=${viteProcess.pid}`);
  if (tunnelProcess?.pid) lines.push(`set OPENMOCKUP_TUNNEL_PID=${tunnelProcess.pid}`);
  lines.push(`set OPENMOCKUP_PUBLIC_URL=${publicBaseUrl}`);
  writeFileSync(PID_FILE, `${lines.join("\r\n")}\r\n`, "utf8");
  writeFileSync(URL_FILE, `${publicBaseUrl}\r\n`, "utf8");
}

function openBrowser(url) {
  if (browserOpened || process.env.OPENMOCKUP_OPEN_BROWSER === "0") return;
  browserOpened = true;

  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

function stopAll(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (viteProcess && !viteProcess.killed) viteProcess.kill("SIGTERM");
  if (tunnelProcess && !tunnelProcess.killed) tunnelProcess.kill("SIGTERM");

  removeRuntimeFiles();
  setTimeout(() => process.exit(code), 250);
}

function printCloudflaredHelp() {
  console.error(`\n[openmockup] cloudflared was not found.\n\nInstall it first, then run this command again:\n\nWindows:\n  winget install Cloudflare.cloudflared\n\nmacOS:\n  brew install cloudflared\n\nManual fallback:\n  1. npm run dev\n  2. cloudflared tunnel --url ${LOCAL_URL}\n  3. restart Vite with OPENMOCKUP_PUBLIC_BASE_URL=<the https trycloudflare URL>\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLocalUrl(url, timeoutMs, label) {
  const startedAt = Date.now();
  let lastError = "not ready";

  while (Date.now() - startedAt < timeoutMs) {
    if (shuttingDown) return false;

    try {
      const response = await fetch(`${url}/?openmockup_ready=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(2500),
      });

      if (response.status < 500) {
        log(`${label} is ready: ${url}`);
        return true;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }

    await sleep(RETRY_MS);
  }

  warn(`${label} did not become reachable in time (${lastError}).`);
  return false;
}

async function waitForTunnelRegistration(timeoutMs) {
  if (tunnelConnected) return true;

  const timeout = sleep(timeoutMs).then(() => false);
  const connected = tunnelConnectedPromise.then(() => true);
  return Promise.race([connected, timeout]);
}

function startVite(publicBaseUrl) {
  const viteBin = join(process.cwd(), "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(viteBin)) {
    console.error("[openmockup] Vite was not found. Run npm install first.");
    stopAll(1);
    return false;
  }

  log(`Using public Photopea asset base: ${publicBaseUrl}`);
  log(`The app UI will open locally: ${LOCAL_URL}`);

  viteProcess = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", APP_PORT, "--strictPort"], {
    stdio: "inherit",
    env: {
      ...process.env,
      OPENMOCKUP_PUBLIC_BASE_URL: publicBaseUrl,
    },
  });

  viteProcess.on("exit", (code) => {
    if (!shuttingDown) stopAll(code ?? 0);
  });

  return true;
}

async function startPublicApp(publicBaseUrl) {
  if (publicUrlStarted) return;
  publicUrlStarted = true;

  if (!startVite(publicBaseUrl)) return;

  log("Waiting for the local Vite server...");
  const localReady = await waitForLocalUrl(LOCAL_URL, LOCAL_WAIT_MS, "Local server");
  if (!localReady) {
    console.error("[openmockup] The local Vite server did not start. Check the error above.");
    stopAll(1);
    return;
  }

  log("Waiting for the Cloudflare tunnel connection to register...");
  const connected = await waitForTunnelRegistration(TUNNEL_CONNECT_WAIT_MS);
  if (!connected) {
    warn("Cloudflare did not print a registration confirmation yet. Opening local app anyway; if PSD asset loading fails, wait a few seconds and refresh.");
  }

  writeRuntimeFiles(publicBaseUrl);
  log(`Public Photopea asset base: ${publicBaseUrl}`);
  log(`OpenMockup Studio app: ${LOCAL_URL}`);
  log("Keep this terminal open while using PSD/Photopea mode.");

  await sleep(OPEN_DELAY_MS);
  openBrowser(LOCAL_URL);
}

function markTunnelConnected() {
  if (tunnelConnected) return;
  tunnelConnected = true;
  tunnelConnectedResolver?.();
}

function handleTunnelOutput(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);
  writeLauncherLog(text.trimEnd());

  if (/Registered tunnel connection/i.test(text)) {
    markTunnelConnected();
  }

  const matches = text.match(tunnelUrlRegex);
  if (!matches || publicUrlStarted) return;

  const publicBaseUrl = matches[0].replace(/\/+$/, "");
  log(`Temporary Cloudflare asset URL detected: ${publicBaseUrl}`);
  void startPublicApp(publicBaseUrl);
}

removeRuntimeFiles();
log("Starting Cloudflare Tunnel for Photopea asset loading...");
log(`Tunnel target: ${LOCAL_URL}`);
log(`Tunnel protocol: ${TUNNEL_PROTOCOL}`);

// The Cloudflare URL is only used as a public asset URL for Photopea.
// The browser UI opens locally on 127.0.0.1 to avoid trycloudflare DNS/browser issues.
tunnelProcess = spawn(CLOUD_FLARED, ["tunnel", "--url", LOCAL_URL, "--protocol", TUNNEL_PROTOCOL, "--no-autoupdate"], {
  stdio: ["ignore", "pipe", "pipe"],
});

tunnelProcess.stdout.on("data", handleTunnelOutput);
tunnelProcess.stderr.on("data", handleTunnelOutput);

tunnelProcess.on("error", (error) => {
  if (error && error.code === "ENOENT") {
    printCloudflaredHelp();
  } else {
    console.error("[openmockup] Could not start cloudflared:", error);
  }
  stopAll(1);
});

tunnelProcess.on("exit", (code) => {
  if (!shuttingDown) {
    console.error("[openmockup] Cloudflare Tunnel stopped. PSD/Photopea asset loading is no longer available.");
    stopAll(code ?? 1);
  }
});

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
