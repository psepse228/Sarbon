import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // See tests/mocks/server-only.ts for why this is aliased in tests.
      "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
    },
  },
});
