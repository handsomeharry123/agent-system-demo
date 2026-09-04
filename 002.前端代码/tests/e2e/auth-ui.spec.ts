import { expect, test } from '@playwright/test';

test.describe('首页用户登录退出', () => {
  test('管理员可以登录、刷新保持会话并退出', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: '用户登录' })).toBeVisible();

    await page.getByPlaceholder('工号 / 手机号 / 姓名').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('admin123');
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeVisible();
    await expect(submit).toHaveText(/登\s*录/);
    await submit.click();

    await expect(page).toHaveURL(/\/app\/home\/dashboard/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('auth_token'))).not.toBeNull();
    await page.reload();
    await expect(page).toHaveURL(/\/app\/home\/dashboard/);

    await page.locator('.ant-avatar').click();
    const logout = page.getByText('退出登录', { exact: true });
    await expect(logout).toBeVisible();
    await logout.click();
    await expect(page).toHaveURL(/\/login/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
  });

  test('未登录用户访问受保护页面会跳回登录页', async ({ page }) => {
    await page.goto('/app/user-center');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: '用户登录' })).toBeVisible();
  });
});
