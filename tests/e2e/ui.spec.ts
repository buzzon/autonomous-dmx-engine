import { test, expect } from "@playwright/test";
import { spawn } from "child_process";
import path from "path";

let serverProcess: any;

test.beforeAll(async () => {
  // Start the server
  console.log("Starting server for E2E tests...");
  serverProcess = spawn("npx", ["ts-node", "src/main.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: "3002" }, // Use a different port to avoid conflicts
    stdio: "pipe",
  });

  // Wait for server to be ready
  await new Promise<void>((resolve, reject) => {
    serverProcess.stdout.on("data", (data: any) => {
      const output = data.toString();
      console.log(`[Server]: ${output}`);
      if (output.includes("Starting WebSocketAPI")) {
        resolve();
      }
    });

    serverProcess.stderr.on("data", (data: any) => {
      console.error(`[Server Error]: ${data}`);
    });

    setTimeout(() => reject(new Error("Server start timeout")), 10000);
  });
});

test.afterAll(() => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

test("should load Imgui dashboard and initialize canvas", async ({ page }) => {
  // Navigate to Imgui page (now at root)
  await page.goto("http://localhost:3002/index.html");

  // Check title
  await expect(page).toHaveTitle("Autonomous DMX Engine - Imgui Control");

  // Check for canvas
  const canvas = page.locator("#canvas");
  await expect(canvas).toBeVisible();

  // Check validation of WebGL context (implicit if no error loop)
  // We can check logs
  const logs: string[] = [];
  page.on("console", (msg) => logs.push(msg.text()));

  // Wait for ImGui Version log which indicates WASM/JS loaded
  await expect(async () => {
    expect(logs.some((l) => l.includes("ImGui Version:"))).toBeTruthy();
  }).toPass({ timeout: 5000 });

  // Check for WebSocket connection log
  await expect(async () => {
    expect(logs.some((l) => l.includes("Connected to WebSocket"))).toBeTruthy();
  }).toPass({ timeout: 5000 });
});
