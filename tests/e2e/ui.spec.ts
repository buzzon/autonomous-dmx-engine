import { test, expect } from "@playwright/test";

test.describe("Web UI E2E", () => {
  test("should load dashboard and connect to websocket", async ({ page }) => {
    // 1. Navigate to Dashboard
    await page.goto("/");
    await expect(page).toHaveTitle(/Autonomous DMX Engine/);

    // 2. Check Initial Status (Disconnected)
    const statusText = page.locator("#statusText");
    await expect(statusText).toContainText("Disconnected");

    // 3. Connect to Server
    await page.click("#connectBtn");

    // 4. Verify Connection
    // Connection might take a moment
    await expect(statusText).toContainText("Connected", { timeout: 10000 });
    await expect(page.locator("#connectionDetails")).toContainText(
      /Connected to WebSocket server/,
    );

    // 5. Test Control Interaction
    // Change Global Intensity
    await page.fill("#intensitySlider", "50");
    // Trigger input event to ensure change is registered
    await page.dispatchEvent("#intensitySlider", "input");

    // 6. Verify Log Entry
    const logContainer = page.locator("#logContainer");
    await expect(logContainer).toContainText(/Command sent: setIntensity/);

    // 7. Test Mode Switching
    await page.selectOption("#modeSelect", "party");
    await expect(logContainer).toContainText(/Command sent: setMode/);

    // Verify UI update (if possible, though this depends on server response which is now real)
    // The real server echoes state updates.
    // Wait for state update is hard without inspecting ws frames, but we can verify log confirms success
    // app.js handles 'commandResponse' and logs success/fail.
    await expect(logContainer).toContainText(/Command executed successfully/);
  });
});
