import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.spec.ts"],
    setupFiles: ["test/setup.vitest.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  resolve: {
    alias: {
      mocha: "vitest",
    },
  },
});
