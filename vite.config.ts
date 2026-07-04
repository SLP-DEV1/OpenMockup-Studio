import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

type StoredDesign = {
  buffer: Buffer;
  contentType: string;
};

function normalizePublicBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/\/+$/, "");
}

function extensionForContentType(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("webp")) return ".webp";
  return ".png";
}

function openMockupDesignServer() {
  const designs = new Map<string, StoredDesign>();
  const publicBaseUrl = normalizePublicBaseUrl(
    process.env.OPENMOCKUP_PUBLIC_BASE_URL || process.env.VITE_OPENMOCKUP_PUBLIC_BASE_URL,
  );

  function middleware(req, res, next) {
    const url = req.url ?? "/";

    if (!url.startsWith("/__openmockup/design")) {
      return next();
    }

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
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      req.on("end", () => {
        const contentType = req.headers["content-type"] ?? "application/octet-stream";
        const normalizedContentType = Array.isArray(contentType) ? contentType[0] : contentType;
        const id = `${crypto.randomUUID()}${extensionForContentType(normalizedContentType)}`;
        designs.set(id, { buffer: Buffer.concat(chunks), contentType: normalizedContentType });
        const path = `/__openmockup/design/${id}`;
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ url: publicBaseUrl ? `${publicBaseUrl}${path}` : path }));
      });
      req.on("error", () => {
        res.statusCode = 500;
        res.end("upload failed");
      });
      return;
    }

    if (method === "GET") {
      const id = url.replace(/^\/__openmockup\/design\//, "").split("?")[0];
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
