import { afterEach } from 'vitest';

process.env.NODE_ENV = 'test';

afterEach(() => {
  delete process.env.TEST_AUTH_TOKEN;
});
