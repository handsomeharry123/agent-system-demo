import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/component/**/*.test.{ts,tsx}'],
    reporters: ['default', 'junit', 'json'],
    outputFile: {
      junit: '../005.项目测试/测试报告/前端/vitest/junit.xml',
      json: '../005.项目测试/测试报告/前端/vitest/results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: '../005.项目测试/测试报告/前端/coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main.tsx', 'src/mock/**'],
    },
    clearMocks: true,
    restoreMocks: true,
  },
});
