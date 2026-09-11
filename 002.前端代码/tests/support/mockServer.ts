import { setupServer } from 'msw/node';

/** 各模块测试按需追加 handler，未声明的网络请求默认视为测试错误。 */
export const server = setupServer();
