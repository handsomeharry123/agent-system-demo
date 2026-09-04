#!/bin/bash
# 后台启动 vite dev server，写日志到 /tmp/vite-dev.log，关闭终端也不会被 kill
# 用法：bash start.sh
# 停止：bash stop.sh
cd "$(dirname "$0")"

# 防重复启动：如果 3001 已经在监听就直接提示
if lsof -i :3001 -P -n >/dev/null 2>&1; then
  echo "✓ 3001 已经在监听（vite 已运行）"
  lsof -i :3001 -P -n
  exit 0
fi

# 用 nohup + & 启动，完全脱离当前 shell
# --no-clear-screen: 不清屏，--port 3001 --host 监听所有网卡
nohup npm run dev > /tmp/vite-dev.log 2>&1 &
VITE_PID=$!
disown $VITE_PID 2>/dev/null

echo "vite PID: $VITE_PID"
echo "等待启动..."

# 最多 15s 等待监听
for i in $(seq 1 15); do
  sleep 1
  if lsof -i :3001 -P -n >/dev/null 2>&1; then
    echo
    echo "✓ vite 已在 http://localhost:3001/ 监听 (用时 ${i}s)"
    echo "日志: tail -f /tmp/vite-dev.log"
    echo "停止: bash stop.sh  或  kill $VITE_PID"
    exit 0
  fi
done

echo
echo "✗ 15s 内未监听到 3001，输出最近日志："
tail -50 /tmp/vite-dev.log
exit 1
