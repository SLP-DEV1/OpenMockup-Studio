import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { createDesignAssetServer } from "./design-asset-server.mjs";

const APP_PORT = String(process.env.OPENMOCKUP_PORT || process.env.PORT || "5173");
const parsedAppPort = Number(APP_PORT);
const ASSET_PORT = String(process.env.OPENMOCKUP_ASSET_PORT || (Number.isFinite(parsedAppPort) ? parsedAppPort + 1 : 5174));
const LOCAL_URL = (process.env.OPENMOCKUP_LOCAL_URL || `http://127.0.0.1:${APP_PORT}`).replace(/\/+$/, "");
const ASSET_LOCAL_URL = `http://127.0.0.1:${ASSET_PORT}`;
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
const MAX_DESIGN_BYTES = Math.max(1, Number(process.env.OPENMOCKUP_MAX_DESIGN_MB || 50)) * 1024 * 1024;
const DESIGN_TTL_MS = Number(process.env.OPENMOCKUP_DESIGN_TTL_MS || 30 * 60 * 1000);
const ASSET_TOKEN = randomBytes(32).toString("hex");

const assetServer = createDesignAssetServer({
  token: ASSET_TOKEN,
  maxDesignBytes: MAX_DESIGN_BYTES,
  ttlMs: DESIGN_TTL_MS,
});

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
  void assetServer.close().catch(() => {});

  removeRuntimeFiles();
  setTimeout(() => process.exit(code), 250);
}

function printCloudflaredHelp() {
  console.error(`\n[openmockup] cloudflared was not found.\n\nInstall it first, then run this command again:\n\nWindows:\n  winget install Cloudflare.cloudflared\n\nmacOS:\n  brew install cloudflared\n\nThen use:\n  npm run dev:public\n\nDo not point a public tunnel directly at the Vite app port. OpenMockup Studio intentionally tunnels only its isolated temporary design-asset server.\n`);
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

  log(`Using isolated public Photopea asset base: ${publicBaseUrl}`);
  log(`The app UI stays local: ${LOCAL_URL}`);

  viteProcess = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", APP_PORT, "--strictPort"], {
    stdio: "inherit",
    env: {
      ...process.env,
      OPENMOCKUP_PUBLIC_BASE_URL: publicBaseUrl,
      OPENMOCKUP_ASSET_SERVER_URL: ASSET_LOCAL_URL,
      OPENMOCKUP_ASSET_TOKEN: ASSET_TOKEN,
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
  assetServer.setPublicBaseUrl(publicBaseUrl);

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
  log("Only /design/<random-id> assets are exposed through the tunnel; the UI remains localhost-only.");
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

async function main() {
  removeRuntimeFiles();
  const listeningUrl = await assetServer.listen(Number(ASSET_PORT));
  log(`Isolated design asset server ready: ${listeningUrl}`);
  log("Starting Cloudflare Tunnel for Photopea asset loading...");
  log(`Tunnel target: ${ASSET_LOCAL_URL} (design assets only)`);
  log(`Local UI target: ${LOCAL_URL} (never tunneled)`);
  log(`Tunnel protocol: ${TUNNEL_PROTOCOL}`);

  tunnelProcess = spawn(CLOUD_FLARED, ["tunnel", "--url", ASSET_LOCAL_URL, "--protocol", TUNNEL_PROTOCOL, "--no-autoupdate"], {
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
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

main().catch((error) => {
  console.error("[openmockup] Could not start isolated PSD mode:", error);
  stopAll(1);
});
