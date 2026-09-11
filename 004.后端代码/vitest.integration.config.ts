import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/integration/**/*.test.ts'],
    reporters: ['default', 'junit', 'json'],
    outputFile: {
      junit: '../005.项目测试/测试报告/后端/integration/junit.xml',
      json: '../005.项目测试/测试报告/后端/integration/results.json',
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
