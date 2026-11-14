import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests-production",
  timeout: 120000,
  expect: { timeout: 20000 },
  workers: 1,
  use: {
    baseURL: process.env.NETCITY_URL ?? "http://127.0.0.1:18080",
    viewport: { width: 844, height: 650 },
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
      args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    },
  },
});
