import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';

/**
 * Vite 5 calls decodeURI for every incoming request. A pasted/bookmarked URL
 * containing a lone "%" (or a truncated escape such as "%E5") makes that
 * middleware throw before React Router gets a chance to render the page.
 * Preserve such input as literal text so the application remains reachable.
 */
const tolerateMalformedRequestUrls = (): Plugin => {
  const install = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((request, _response, next) => {
      if (request.url) {
        try {
          decodeURI(request.url);
        } catch {
          // Only escape a literal/bare percent. Valid escapes (especially the
          // UTF-8 bytes used by Chinese paths) must remain untouched.
          const escapedBarePercents = request.url.replace(/%(?![\da-f]{2})/gi, '%25');
          try {
            decodeURI(escapedBarePercents);
            request.url = escapedBarePercents;
          } catch {
            // A syntactically valid but truncated byte sequence (for example
            // "%E5") is also malformed. Preserve the whole value literally.
            request.url = request.url.replaceAll('%', '%25');
          }
        }
      }
      next();
    });
  };

  return {
    name: 'tolerate-malformed-request-urls',
    enforce: 'pre',
    configureServer: install,
    configurePreviewServer: install,
  };
};

export default defineConfig({
  plugins: [tolerateMalformedRequestUrls(), react()],
  server: {
    host: true,        // 监听 0.0.0.0，避免仅 localhost 绑定带来的网络栈差异
    port: 3001,
    strictPort: true,  // 固定使用 3001，避免自动顺延后原访问地址失效
    clearScreen: false,// 保留历史输出，方便看到 transform 报错
    // 允许通过内网地址、容器代理和临时预览域名访问开发服务器。
    // 否则 Vite 会在请求进入 React 路由前直接返回 Host not allowed。
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 3001,
    strictPort: true,
    allowedHosts: true,
  },
  // dev 阶段关闭预构建可能导致的卡顿，方便定位首屏
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },
  logLevel: 'info',
});
