#!/bin/bash
# 一次性全量诊断脚本：把端口/依赖/编译/vite 全部跑一遍
# 用法：在项目根目录执行 `bash diag.sh`，把整段输出贴回来
set +e

cd "$(dirname "$0")"
echo "================ 工作目录 ================"
pwd
ls -la vite.config.ts package.json | head -5

echo
echo "================ 1) 端口现状 ================"
for p in 3000 3001 3002 3003 3004 3005; do
  RES=$(lsof -i :$p -P -n 2>/dev/null)
  if [ -n "$RES" ]; then
    echo "PORT $p: 被占用 ↓"
    echo "$RES"
  else
    echo "PORT $p: 空闲"
  fi
done

echo
echo "================ 2) Node / npm ================"
node -v
npm -v

echo
echo "================ 3) 关键依赖 ================"
for pkg in vite @vitejs/plugin-react react react-dom antd react-router-dom; do
  V=$(node -p "require('./node_modules/$pkg/package.json').version" 2>/dev/null)
  if [ -n "$V" ]; then echo "  $pkg: $V"; else echo "  $pkg: ✗ MISSING"; fi
done

echo
echo "================ 4) 配置语法快速校验 ================"
node -e "import('./vite.config.ts').then(m => { console.log('  vite.config.ts: parse OK'); console.log('  server config:', JSON.stringify(m.default.server, null, 2)); }).catch(e => { console.log('  vite.config.ts: PARSE FAIL'); console.error(e.message); process.exit(1); })" 2>&1
echo "  注：上面若报 'parse fail' 但不致命（vite 自身会用 esbuild 重新加载），需结合第 5 步判断"

echo
echo "================ 5) 前台启 vite (15s 超时) ================"
echo "  --- 启动中，等最多 15 秒 ---"
( npm run dev 2>&1 & VITE_PID=$!
  for i in $(seq 1 15); do
    sleep 1
    if lsof -i :3001 -P -n >/dev/null 2>&1 || lsof -i :3002 -P -n >/dev/null 2>&1; then
      echo "  [${i}s] ✓ 检测到 vite 正在监听"
      break
    fi
  done
  echo "  --- 15s 内的完整输出 ---"
  kill $VITE_PID 2>/dev/null
  wait $VITE_PID 2>/dev/null
) 2>&1

echo
echo "================ 6) 如果上面没监听到，再试 npx vite 直跑 ================"
echo "  --- npx vite (10s 超时) ---"
( npx vite 2>&1 & VITE_PID=$!
  for i in $(seq 1 10); do
    sleep 1
    if lsof -i :3001 -P -n >/dev/null 2>&1 || lsof -i :3002 -P -n >/dev/null 2>&1; then
      echo "  [${i}s] ✓ 监听到了"
      break
    fi
  done
  kill $VITE_PID 2>/dev/null
  wait $VITE_PID 2>/dev/null
) 2>&1

echo
echo "================ 诊断结束 ================"
echo "请把以上 6 段全部输出贴回来。"
