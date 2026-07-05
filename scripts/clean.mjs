import { rm } from "node:fs/promises";

const paths = ["dist", "node_modules", "coverage", ".vite", ".cache", ".tmp"];

for (const path of paths) {
  await rm(path, { recursive: true, force: true });
}

console.log("Cleaned generated project files.");
