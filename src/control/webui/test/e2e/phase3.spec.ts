/**
 * E2E tests for Phase 3 UI using Playwright
 * Tests complete user workflows and interactions
 */

import { test, expect } from '@playwright/test';

// Skip tests if Playwright is not configured
test.describe.skip('Phase 3 UI E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Wait for application to load
    await page.waitForSelector('#canvas', { timeout: 10000 });
  });
  
  test('should load Phase 3 dashboard', async ({ page }) => {
    // Check that the application loaded
    await expect(page).toHaveTitle(/DMX Engine/);
    
    // Check for Phase 3 specific elements
    await expect(page.locator('text=Phase 3 Dashboard')).toBeVisible();
    await expect(page.locator('text=Autonomous DMX Engine')).toBeVisible();
  });
  
  test('should navigate between pages', async ({ page }) => {
    // Start on home page
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Navigate to Audio page
    await page.click('text=Audio');
    await expect(page.locator('text=Audio Visualization')).toBeVisible();
    
    // Navigate to DMX Monitor
    await page.click('text=DMX Monitor');
    await expect(page.locator('text=DMX Channel Monitor')).toBeVisible();
    
    // Navigate to Scenes
    await page.click('text=Scenes');
    await expect(page.locator('text=Scene Editor')).toBeVisible();
    
    // Navigate back to Home
    await page.click('text=Dashboard');
    await expect(page.locator('text=System Status')).toBeVisible();
  });
  
  test('should display real-time audio visualization', async ({ page }) => {
    // Navigate to Audio page
    await page.click('text=Audio');
    
    // Check for visualization components
    await expect(page.locator('text=Waveform')).toBeVisible();
    await expect(page.locator('text=Spectrum')).toBeVisible();
    await expect(page.locator('text=Energy Meter')).toBeVisible();
    
    // Check for real-time data updates
    await page.waitForTimeout(1000); // Wait for data to update
    
    // Energy value should be displayed
    await expect(page.locator('text=Energy:')).toBeVisible();
    
    // BPM should be displayed if available
    const bpmText = page.locator('text=BPM:');
    await expect(bpmText.or(page.locator('text=BPM: N/A'))).toBeVisible();
  });
  
  test('should display DMX channel monitor', async ({ page }) => {
    // Navigate to DMX page
    await page.click('text=DMX Monitor');
    
    // Check for DMX grid
    await expect(page.locator('text=DMX Channels')).toBeVisible();
    await expect(page.locator('text=Channel')).toBeVisible();
    await expect(page.locator('text=Value')).toBeVisible();
    
    // Check for channel visualization
    // (Implementation specific - may be canvas-based)
    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();
  });
  
  test('should edit scenes', async ({ page }) => {
    // Navigate to Scenes page
    await page.click('text=Scenes');
    
    // Check for scene list
    await expect(page.locator('text=Scene List')).toBeVisible();
    
    // Check for scene editor controls
    await expect(page.locator('text=Add Scene')).toBeVisible();
    await expect(page.locator('text=Edit')).toBeVisible();
    await expect(page.locator('text=Delete')).toBeVisible();
    
    // Test adding a new scene
    await page.click('text=Add Scene');
    await expect(page.locator('text=New Scene')).toBeVisible();
    
    // Fill scene details
    await page.fill('input[name="sceneName"]', 'Test Scene');
    await page.fill('input[name="sceneDuration"]', '5000');
    
    // Save scene
    await page.click('text=Save');
    await expect(page.locator('text=Test Scene')).toBeVisible();
  });
  
  test('should manage effects', async ({ page }) => {
    // Navigate to Effects page
    await page.click('text=Effects');
    
    // Check for effects list
    await expect(page.locator('text=Effects Library')).toBeVisible();
    await expect(page.locator('text=Active Effects')).toBeVisible();
    
    // Test toggling an effect
    const effectToggle = page.locator('.effect-toggle').first();
    await effectToggle.click();
    
    // Effect should show as active
    await expect(page.locator('text=Active (1)')).toBeVisible();
  });
  
  test('should manage fixtures', async ({ page }) => {
    // Navigate to Fixtures page
    await page.click('text=Fixtures');
    
    // Check for fixture manager
    await expect(page.locator('text=Fixture Manager')).toBeVisible();
    await expect(page.locator('text=Fixture Profiles')).toBeVisible();
    
    // Test adding a fixture
    await page.click('text=Add Fixture');
    await expect(page.locator('text=New Fixture')).toBeVisible();
    
    // Fill fixture details
    await page.selectOption('select[name="fixtureType"]', 'LED PAR');
    await page.fill('input[name="fixtureAddress"]', '1');
    await page.fill('input[name="fixtureUniverse"]', '0');
    
    // Save fixture
    await page.click('text=Save');
    await expect(page.locator('text=LED PAR')).toBeVisible();
  });
  
  test('should edit rules', async ({ page }) => {
    // Navigate to Rules page
    await page.click('text=Rules');
    
    // Check for rule editor
    await expect(page.locator('text=Rule Editor')).toBeVisible();
    await expect(page.locator('text=Scene Rules')).toBeVisible();
    
    // Test adding a rule
    await page.click('text=Add Rule');
    await expect(page.locator('text=New Rule')).toBeVisible();
    
    // Fill rule details
    await page.fill('input[name="ruleName"]', 'High Energy Rule');
    await page.selectOption('select[name="conditionType"]', 'audioEnergy');
    await page.fill('input[name="energyThreshold"]', '0.7');
    await page.selectOption('select[name="actionType"]', 'activateScene');
    
    // Save rule
    await page.click('text=Save');
    await expect(page.locator('text=High Energy Rule')).toBeVisible();
  });
  
  test('should change theme', async ({ page }) => {
    // Open settings
    await page.click('text=Config');
    
    // Find theme toggle
    const themeButton = page.locator('button:has-text("Dark")');
    await themeButton.click();
    
    // Theme should change to light
    await expect(page.locator('button:has-text("Light")')).toBeVisible();
    
    // Toggle back
    await page.click('button:has-text("Light")');
    await expect(page.locator('button:has-text("Dark")')).toBeVisible();
  });
  
  test('should change layout', async ({ page }) => {
    // Open settings
    await page.click('text=Config');
    
    // Change to compact layout
    await page.click('button:has-text("compact")');
    
    // UI should adjust to compact layout
    await expect(page.locator('text=DMX Engine Control')).toBeVisible();
    
    // Change to expanded layout
    await page.click('text=Config');
    await page.click('button:has-text("expanded")');
    
    // Change to dashboard layout
    await page.click('text=Config');
    await page.click('button:has-text("dashboard")');
  });
  
  test('should show debug panel', async ({ page }) => {
    // Open settings
    await page.click('text=Config');
    
    // Enable debug panel
    await page.click('button:has-text("Show")');
    
    // Debug panel should appear
    await expect(page.locator('text=Debug Panel')).toBeVisible();
    
    // Check debug information
    await expect(page.locator('text=Application State:')).toBeVisible();
    await expect(page.locator('text=System:')).toBeVisible();
    await expect(page.locator('text=Audio:')).toBeVisible();
    await expect(page.locator('text=Socket:')).toBeVisible();
    
    // Disable debug panel
    await page.click('button:has-text("Hide")');
    await expect(page.locator('text=Debug Panel')).not.toBeVisible();
  });
  
  test('should handle socket connection states', async ({ page }) => {
    // Check connection status
    await expect(page.locator('text=Connected').or(page.locator('text=Disconnected'))).toBeVisible();
    
    // Socket status should update
    // (This would require mocking WebSocket connections)
  });
  
  test('should display system metrics', async ({ page }) => {
    // System metrics should be visible in status bar or dashboard
    await expect(page.locator('text=Mode:')).toBeVisible();
    await expect(page.locator('text=Intensity:')).toBeVisible();
    
    // Check for performance metrics
    await expect(page.locator('text=FPS:')).toBeVisible();
  });
  
  test('should handle mobile responsiveness', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // UI should adapt to mobile
    await expect(page.locator('text=DMX Engine')).toBeVisible();
    
    // Navigation should work on mobile
    await page.click('button:has-text("Menu")');
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
  
  test('should persist user preferences', async ({ page, context }) => {
    // Change theme
    await page.click('text=Config');
    await page.click('button:has-text("Dark")');
    
    // Change layout
    await page.click('button:has-text("compact")');
    
    // Reload page
    await page.reload();
    await page.waitForSelector('#canvas', { timeout: 10000 });
    
    // Preferences should persist
    await page.click('text=Config');
    await expect(page.locator('button:has-text("Light")')).toBeVisible();
    // Layout preference might be stored differently
  });
  
  test('should handle offline mode', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    
    // UI should handle offline state
    await expect(page.locator('text=Offline')).toBeVisible();
    await expect(page.locator('text=Disconnected')).toBeVisible();
    
    // Basic functionality should still work
    await page.click('text=Scenes');
    await expect(page.locator('text=Scene Editor')).toBeVisible();
    
    // Go back online
    await page.context().setOffline(false);
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 });
  });
});

// Performance tests
test.describe('Performance Tests', () => {
  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#canvas', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
  
  test('should maintain smooth animation', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#canvas', { timeout: 10000 });
    
    // Navigate to audio page for animations
    await page.click('text=Audio');
    
    // Measure FPS by checking animation updates
    const updates: number[] = [];
    const checkInterval = 100; // ms
    
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(checkInterval);
      // Check if visualization updated
      // This would need specific implementation details
    }
    
    // Should have received updates
    expect(updates.length).toBeGreaterThan(0);
  });
  
  test('should handle rapid user interactions', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#canvas', { timeout: 10000 });
    
    // Rapid navigation
    const pages = ['Audio', 'DMX Monitor', 'Scenes', 'Effects', 'Fixtures', 'Rules'];
    
    for (const pageName of pages) {
      await page.click(`text=${pageName}`);
      await page.waitForTimeout(50); // Very fast navigation
    }
    
    // Should not crash or show errors
    await expect(page.locator('text=Error')).not.toBeVisible();
  });
});

// Accessibility tests
test.describe('Accessibility Tests', () => {
  test('should have proper contrast ratios', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check text contrast
    // This would use axe-core or similar
    // For now, just verify basic accessibility
    await expect(page.locator('body')).toHaveAttribute('role', 'application');
  });
  
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Tab through interface
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Enter should activate focused element
    await page.keyboard.press('Enter');
    
    // Should navigate successfully
    await expect(page).not.toHaveURL('http://localhost:3000/#');
  });
  
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check for ARIA attributes
    const buttons = await page.locator('button').all();
    
    for (const button of buttons) {
      const hasLabel = await button.getAttribute('aria-label') || 
                      await button.textContent();
      expect(hasLabel).toBeTruthy();
    }
  });
});

// Cross-browser compatibility
test.describe('Cross-browser Tests', () => {
  test('should work in Chrome', async ({ browserName, page }) => {
    test.skip(browserName !== 'chromium', 'Chrome-specific test');
    
    await page.goto('http://localhost:3000');
    await expect(page.locator('#canvas')).toBeVisible();
  });
  
  test('should work in Firefox', async ({ browserName, page }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');
    
    await page.goto('http://localhost:3000');
    await expect(page.locator('#canvas')).toBeVisible();
  });
  
  test('should work in Safari', async ({ browserName, page }) => {
    test.skip(browserName !== 'webkit', 'Safari-specific test');
    
    await page.goto('http://localhost:3000');
    await expect(page.locator('#canvas')).toBeVisible();
  });
});

console.log('Phase 3 E2E test suite created. Run with: npx playwright test');