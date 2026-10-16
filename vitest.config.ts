import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    env: {
      SKIP_DB_TESTS: process.env.SKIP_DB_TESTS ?? "0",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
