import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["source/slash/**/*.test.ts"],
    environment: "node",
    globals: true,
  },
});
