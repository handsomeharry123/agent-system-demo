import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeConnectionTest } from '../../src/routes/agent-access.js';

const completion = () => new Response(JSON.stringify({
  choices: [{ message: { content: 'CONNECTION_OK' } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('OpenAI-compatible agent access', () => {
  it.each([
    ['DeepSeek root Base URL', 'https://api.deepseek.com', 'https://api.deepseek.com/chat/completions', 'deepseek-v4-flash'],
    ['Zhipu nested Base URL', 'https://open.bigmodel.cn/api/paas/v4', 'https://open.bigmodel.cn/api/paas/v4/chat/completions', 'glm-5.2'],
    ['full endpoint', 'https://gateway.example/openai/v1/chat/completions', 'https://gateway.example/openai/v1/chat/completions', 'custom-chat'],
  ])('normalizes %s', async (_label, input, expected, model) => {
    const request = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe(expected);
      return completion();
    });
    vi.stubGlobal('fetch', request);
    const result = await executeConnectionTest('API', input, 'test-secret', model);
    expect(result.ok).toBe(true);
    expect(result.resolvedEndpoint).toBe(expected);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('discovers a model from a MiniMax-style Base URL', async () => {
    const request = vi.fn(async (url: string | URL) => String(url).endsWith('/models')
      ? new Response(JSON.stringify({ data: [{ id: 'MiniMax-M2.7' }] }), { status: 200 })
      : completion());
    vi.stubGlobal('fetch', request);
    const result = await executeConnectionTest('API', 'https://api.minimaxi.com/v1', 'test-secret');
    expect(result).toMatchObject({ ok: true, modelDiscovered: true, resolvedModel: 'MiniMax-M2.7' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('corrects a provider name mistakenly entered as the MiniMax model ID', async () => {
    const request = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'MiniMax-M2.7' }] }), { status: 200 });
      }
      const body = JSON.parse(String(init?.body));
      return body.model === 'MiniMax-M2.7'
        ? completion()
        : new Response(JSON.stringify({ error: { message: "invalid params, unknown model 'minimax' (2013)" } }), { status: 400 });
    });
    vi.stubGlobal('fetch', request);
    const result = await executeConnectionTest('API', 'https://api.minimaxi.com/v1', 'test-secret', 'MiniMax');
    expect(result).toMatchObject({ ok: true, modelCorrected: true, resolvedModel: 'MiniMax-M2.7' });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('falls back to X-API-Key for compatible private gateways', async () => {
    const request = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      return headers['X-API-Key'] ? completion() : new Response('{}', { status: 401 });
    });
    vi.stubGlobal('fetch', request);
    const result = await executeConnectionTest('API', 'https://gateway.example/v1', 'test-secret', 'private-model');
    expect(result).toMatchObject({ ok: true, authScheme: 'x-api-key' });
    expect(request).toHaveBeenCalledTimes(2);
  });
});
