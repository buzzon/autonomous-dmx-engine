// Test setup file
import { jest } from '@jest/globals';

// Mock console methods to keep test output clean
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock performance API if not available
if (typeof performance === 'undefined') {
  (global as any).performance = {
    now: () => Date.now(),
  };
}

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});