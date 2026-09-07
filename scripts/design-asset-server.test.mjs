import { afterEach, describe, expect, it } from "vitest";
import { createDesignAssetServer } from "./design-asset-server.mjs";

const openServers = [];

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((assetServer) => assetServer.close()));
});

async function startServer(options = {}) {
  const assetServer = createDesignAssetServer({ token: "test-token", ...options });
  openServers.push(assetServer);
  const localUrl = await assetServer.listen(0);
  assetServer.setPublicBaseUrl("https://assets.example.test");
  return { assetServer, localUrl };
}

describe("isolated design asset server", () => {
  it("does not expose an application root and rejects unauthenticated uploads", async () => {
    const { localUrl } = await startServer();

    expect((await fetch(`${localUrl}/`)).status).toBe(404);
    expect((await fetch(`${localUrl}/design`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: Buffer.from([1, 2, 3]),
    })).status).toBe(403);
  });

  it("publishes only token-authorized image assets with public GET access", async () => {
    const { localUrl } = await startServer();
    const source = Buffer.from([137, 80, 78, 71]);
    const upload = await fetch(`${localUrl}/design`, {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        "X-OpenMockup-Token": "test-token",
      },
      body: source,
    });

    expect(upload.status).toBe(200);
    const value = await upload.json();
    const publicUrl = new URL(value.url);
    expect(publicUrl.origin).toBe("https://assets.example.test");
    expect(publicUrl.pathname).toMatch(/^\/design\/[0-9a-f-]+\.png$/i);

    const asset = await fetch(`${localUrl}${publicUrl.pathname}`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("access-control-allow-origin")).toBe("*");
    expect(Buffer.from(await asset.arrayBuffer())).toEqual(source);
  });

  it("enforces the configured upload size limit", async () => {
    const { localUrl } = await startServer({ maxDesignBytes: 3 });
    const response = await fetch(`${localUrl}/design`, {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        "X-OpenMockup-Token": "test-token",
      },
      body: Buffer.from([1, 2, 3, 4]),
    });
    expect(response.status).toBe(413);
  });
});
