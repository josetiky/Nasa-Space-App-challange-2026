import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Standalone config so unit tests do not load the TanStack Start / Nitro plugins.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    reporters: ["default"],
  },
});
