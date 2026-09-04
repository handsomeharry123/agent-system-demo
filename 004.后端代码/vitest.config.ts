import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**/*.test.ts'],
    reporters: ['default', 'junit', 'json'],
    outputFile: {
      junit: '../005.项目测试/测试报告/后端/vitest/junit.xml',
      json: '../005.项目测试/测试报告/后端/vitest/results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: '../005.项目测试/测试报告/后端/coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/scripts/**'],
    },
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10_000,
  },
});
