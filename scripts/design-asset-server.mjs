import { randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

function extensionForContentType(contentType) {
  const normalized = String(contentType || "").toLowerCase();
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
  if (normalized.includes("webp")) return ".webp";
  return ".png";
}

function hasValidToken(value, expectedToken) {
  const received = Array.isArray(value) ? value[0] : value || "";
  const left = Buffer.from(String(received));
  const right = Buffer.from(String(expectedToken));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createDesignAssetServer({
  token,
  maxDesignBytes = 50 * 1024 * 1024,
  ttlMs = 30 * 60 * 1000,
} = {}) {
  if (!token) throw new Error("Design asset server requires an access token.");

  const designs = new Map();
  let publicBaseUrl = "";

  function cleanupDesigns() {
    const expiresBefore = Date.now() - ttlMs;
    for (const [id, item] of designs) {
      if (item.createdAt < expiresBefore) designs.delete(id);
    }
  }

  function setPublicBaseUrl(value) {
    const parsed = new URL(String(value || ""));
    if (parsed.protocol !== "https:") {
      throw new Error("Public design asset URL must use HTTPS.");
    }
    publicBaseUrl = parsed.href.replace(/\/+$/, "");
  }

  const server = createServer((req, res) => {
    cleanupDesigns();
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    const method = req.method || "GET";

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");

    if (method === "GET" && requestUrl.pathname.startsWith("/design/")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      const id = decodeURIComponent(requestUrl.pathname.slice("/design/".length));
      const item = designs.get(id);
      if (!item) {
        res.statusCode = 404;
        res.end("not found");
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", item.contentType);
      res.setHeader("Content-Length", item.buffer.byteLength);
      res.end(item.buffer);
      return;
    }

    if (method === "POST" && requestUrl.pathname === "/design") {
      if (!hasValidToken(req.headers["x-openmockup-token"], token)) {
        res.statusCode = 403;
        res.end("forbidden");
        return;
      }
      if (!publicBaseUrl) {
        res.statusCode = 503;
        res.end("public asset URL is not ready");
        return;
      }

      const contentTypeHeader = req.headers["content-type"] || "application/octet-stream";
      const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;
      if (!String(contentType).toLowerCase().startsWith("image/")) {
        res.statusCode = 415;
        res.end("design must be an image");
        return;
      }

      const contentLength = Number(req.headers["content-length"] || 0);
      if (Number.isFinite(contentLength) && contentLength > maxDesignBytes) {
        res.statusCode = 413;
        res.end("design is too large");
        return;
      }

      const chunks = [];
      let receivedBytes = 0;
      let tooLarge = false;

      req.on("data", (chunk) => {
        if (tooLarge) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        receivedBytes += buffer.byteLength;
        if (receivedBytes > maxDesignBytes) {
          tooLarge = true;
          chunks.length = 0;
          return;
        }
        chunks.push(buffer);
      });

      req.on("end", () => {
        if (tooLarge) {
          res.statusCode = 413;
          res.end("design is too large");
          return;
        }

        const id = `${randomUUID()}${extensionForContentType(contentType)}`;
        const buffer = Buffer.concat(chunks);
        designs.set(id, { buffer, contentType, createdAt: Date.now() });
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ url: `${publicBaseUrl}/design/${encodeURIComponent(id)}` }));
      });

      req.on("error", () => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("upload failed");
        }
      });
      return;
    }

    if (requestUrl.pathname === "/design" || requestUrl.pathname.startsWith("/design/")) {
      res.statusCode = 405;
      res.setHeader("Allow", requestUrl.pathname === "/design" ? "POST" : "GET");
      res.end("method not allowed");
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  async function listen(port = 0, host = "127.0.0.1") {
    await new Promise((resolve, reject) => {
      const handleError = (error) => {
        server.off("listening", handleListening);
        reject(error);
      };
      const handleListening = () => {
        server.off("error", handleError);
        resolve();
      };
      server.once("error", handleError);
      server.once("listening", handleListening);
      server.listen(port, host);
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Could not resolve design asset server address.");
    return `http://${host}:${address.port}`;
  }

  async function close() {
    if (!server.listening) return;
    await new Promise((resolve) => server.close(() => resolve()));
  }

  return { close, listen, server, setPublicBaseUrl };
}
