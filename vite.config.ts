import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

type StoredDesign = {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
};

const DESIGN_TTL_MS = Number(process.env.OPENMOCKUP_DESIGN_TTL_MS ?? 30 * 60 * 1000);
const MAX_DESIGN_BYTES = Math.max(1, Number(process.env.OPENMOCKUP_MAX_DESIGN_MB ?? 50)) * 1024 * 1024;
const ALLOW_PUBLIC_UPLOADS = process.env.OPENMOCKUP_ALLOW_PUBLIC_UPLOADS === "1";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function normalizePublicBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/\/+$/, "");
}

function extensionForContentType(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("webp")) return ".webp";
  return ".png";
}

function isLoopbackHostname(value: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(`http://${value}`).hostname);
  } catch {
    return false;
  }
}

function acceptsUpload(req: IncomingMessage): boolean {
  if (ALLOW_PUBLIC_UPLOADS) return true;
  const host = req.headers.host ?? "";
  const origin = req.headers.origin;
  if (!isLoopbackHostname(host)) return false;
  if (!origin) return true;
  try {
    return LOOPBACK_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function openMockupDesignServer(): Plugin {
  const designs = new Map<string, StoredDesign>();
  const publicBaseUrl = normalizePublicBaseUrl(
    process.env.OPENMOCKUP_PUBLIC_BASE_URL || process.env.VITE_OPENMOCKUP_PUBLIC_BASE_URL,
  );

  function cleanupDesigns(): void {
    const expiresBefore = Date.now() - DESIGN_TTL_MS;
    for (const [id, item] of designs) {
      if (item.createdAt < expiresBefore) designs.delete(id);
    }
  }

  function middleware(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    const url = req.url ?? "/";

    if (!url.startsWith("/__openmockup/design")) {
      next();
      return;
    }

    cleanupDesigns();

    const method = req.method ?? "GET";
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (method === "POST") {
      if (!acceptsUpload(req)) {
        res.statusCode = 403;
        res.end("Design uploads are restricted to the local app.");
        return;
      }

      const chunks: Buffer[] = [];
      let receivedBytes = 0;
      let tooLarge = false;

      req.on("data", (chunk) => {
        if (tooLarge) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        receivedBytes += buffer.byteLength;
        if (receivedBytes > MAX_DESIGN_BYTES) {
          tooLarge = true;
          res.statusCode = 413;
          res.end(`Design upload is larger than ${Math.round(MAX_DESIGN_BYTES / 1024 / 1024)} MB.`);
          req.destroy();
          return;
        }
        chunks.push(buffer);
      });

      req.on("end", () => {
        if (tooLarge) return;
        const contentType = req.headers["content-type"] ?? "application/octet-stream";
        const normalizedContentType = Array.isArray(contentType) ? contentType[0] : contentType;
        const id = `${randomUUID()}${extensionForContentType(normalizedContentType)}`;
        designs.set(id, {
          buffer: Buffer.concat(chunks),
          contentType: normalizedContentType,
          createdAt: Date.now(),
        });
        const path = `/__openmockup/design/${id}`;
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ url: publicBaseUrl ? `${publicBaseUrl}${path}` : path }));
      });

      req.on("error", () => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("upload failed");
        }
      });
      return;
    }

    if (method === "GET") {
      const id = decodeURIComponent(url.replace(/^\/__openmockup\/design\//, "").split("?")[0] || "");
      const item = designs.get(id);
      if (!item) {
        res.statusCode = 404;
        res.end("not found");
        return;
      }

      res.statusCode = 200;
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", item.contentType);
      res.setHeader("Content-Length", item.buffer.byteLength);
      res.end(item.buffer);
      return;
    }

    next();
  }

  return {
    name: "openmockup-design-server",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  server: {
    allowedHosts: [".trycloudflare.com"],
  },
  plugins: [react(), openMockupDesignServer()],
});
