
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Isolate the test environment
    isolate: true,
    // Disable threading to avoid port conflicts
    threads: false,
    // Use a simpler environment for plain JS/TS files
    environment: 'node',
    // Override the default test matching pattern to only include .test.js files
    include: ['**/*.test.js'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
