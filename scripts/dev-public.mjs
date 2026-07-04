import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const LOCAL_URL = process.env.OPENMOCKUP_LOCAL_URL || "http://127.0.0.1:5173";
const CLOUD_FLARED = findCloudflared();
const tunnelUrlRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi;

let viteProcess;
let tunnelProcess;
let shuttingDown = false;

function log(message = "") {
  console.log(`[openmockup] ${message}`);
}

function findCloudflared() {
  if (process.env.CLOUDFLARED_BIN) return process.env.CLOUDFLARED_BIN;
  if (process.platform !== "win32") return "cloudflared";

  const candidates = [
    "cloudflared.exe",
    "C:\\Program Files\\cloudflared\\cloudflared.exe",
    "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
  ];

  return candidates.find((candidate) => candidate !== "cloudflared.exe" && existsSync(candidate)) ?? "cloudflared.exe";
}

function stopAll(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (viteProcess && !viteProcess.killed) viteProcess.kill("SIGTERM");
  if (tunnelProcess && !tunnelProcess.killed) tunnelProcess.kill("SIGTERM");

  setTimeout(() => process.exit(code), 250);
}

function printCloudflaredHelp() {
  console.error(`\n[openmockup] cloudflared was not found.\n\nInstall it first, then run this command again:\n\nWindows:\n  winget install Cloudflare.cloudflared\n\nmacOS:\n  brew install cloudflared\n\nAlternative manual start:\n  1. npm run dev\n  2. cloudflared tunnel --url ${LOCAL_URL}\n  3. restart Vite with OPENMOCKUP_PUBLIC_BASE_URL=<the https trycloudflare URL>\n`);
}

function startVite(publicBaseUrl) {
  const viteBin = join(process.cwd(), "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(viteBin)) {
    console.error("[openmockup] Vite was not found. Run npm install first.");
    stopAll(1);
    return;
  }

  log(`Using public Photopea asset base: ${publicBaseUrl}`);
  log(`Open the app here: ${publicBaseUrl}`);

  viteProcess = spawn(process.execPath, [viteBin, "--host", "127.0.0.1"], {
    stdio: "inherit",
    env: {
      ...process.env,
      OPENMOCKUP_PUBLIC_BASE_URL: publicBaseUrl,
    },
  });

  viteProcess.on("exit", (code) => {
    if (!shuttingDown) stopAll(code ?? 0);
  });
}

function handleTunnelOutput(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);

  const matches = text.match(tunnelUrlRegex);
  if (!matches || viteProcess) return;

  const publicBaseUrl = matches[0].replace(/\/+$/, "");
  startVite(publicBaseUrl);
}

log("Starting Cloudflare Tunnel for Photopea asset loading...");
log(`Tunnel target: ${LOCAL_URL}`);

tunnelProcess = spawn(CLOUD_FLARED, ["tunnel", "--url", LOCAL_URL], {
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
  if (!shuttingDown) stopAll(code ?? 0);
});

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
