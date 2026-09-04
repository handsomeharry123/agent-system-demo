/**
 * 数据库集成测试的统一入口。
 * 后续实现必须读取独立 TEST_DB_* 环境变量，并按测试运行 ID 精确清理数据。
 * 禁止回退到开发/生产 DB_* 配置，避免误写业务库。
 */
export const requireTestDatabase = () => {
  const databaseName = process.env.TEST_DB_NAME;
  if (!databaseName || !databaseName.includes('test')) {
    throw new Error('集成测试仅允许使用名称包含 test 的 TEST_DB_NAME');
  }
  return databaseName;
};
