import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts"] } },
      {
        extends: true,
        test: {
          name: "spec",
          include: ["spec/**/*.test.ts", "scripts/**/*.test.ts"],
          globalSetup: ["./spec/global-setup.ts"],
        },
      },
    ],
  },
});
