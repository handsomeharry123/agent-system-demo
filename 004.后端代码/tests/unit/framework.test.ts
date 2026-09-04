import { describe, expect, it } from 'vitest';
import { requireTestDatabase } from '../support/database';

describe('后端测试工程', () => {
  it('阻止集成测试误用非测试数据库', () => {
    expect(() => requireTestDatabase()).toThrow(/TEST_DB_NAME/);
  });
});
