import { describe, expect, it } from 'vitest';

describe('前端测试工程', () => {
  it('提供隔离的 DOM 与浏览器存储环境', () => {
    localStorage.setItem('framework-ready', 'yes');
    expect(document).toBeDefined();
    expect(localStorage.getItem('framework-ready')).toBe('yes');
  });
});
