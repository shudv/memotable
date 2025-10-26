import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Enable globals like describe, it, expect without imports
    globals: true,
    
    // Test environment (node for library, jsdom for browser code)
    environment: 'node',
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.config.ts'],
    },
    
    // Test file patterns
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
