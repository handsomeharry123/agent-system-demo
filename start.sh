#!/bin/bash
# 后台启动 vite dev server，关闭终端后继续运行
# 用法：bash start.sh
# 停止：bash stop.sh
cd "$(dirname "$0")"

PID_FILE=/tmp/agent-system-demo-vite.pid
LOG_FILE=/tmp/agent-system-demo-vite.log
PORT=3001

# 只有返回本项目的页面，才能认定服务已经启动。
# 不覆盖其他占用端口的服务（例如 Docker 转发的 BISHENG）。
while lsof -iTCP:"$PORT" -sTCP:LISTEN -P -n >/dev/null 2>&1; do
  if curl -fsS "http://localhost:$PORT/" 2>/dev/null | grep -q '<title>医疗智能体管理平台</title>'; then
    echo "✓ 项目已在 http://localhost:$PORT/ 运行"
    exit 0
  fi
  PORT=$((PORT + 1))
done
if [ "$PORT" -ne 3001 ]; then
  echo "3001 已被其他服务占用，改用 $PORT"
fi

# 用 nohup + & 启动，完全脱离当前 shell
# --no-clear-screen: 不清屏，--port 3001 --host 监听所有网卡
nohup npm run dev -- --port "$PORT" > "$LOG_FILE" 2>&1 &
VITE_PID=$!
echo "$VITE_PID" > "$PID_FILE"
disown $VITE_PID 2>/dev/null

echo "vite PID: $VITE_PID"
echo "等待启动..."

# 最多 15s 等待监听
for i in $(seq 1 15); do
  sleep 1
  if curl -fsS "http://localhost:$PORT/" 2>/dev/null | grep -q '<title>医疗智能体管理平台</title>'; then
    echo
    echo "✓ 项目已在 http://localhost:$PORT/ 运行 (用时 ${i}s)"
    echo "日志: tail -f $LOG_FILE"
    echo "停止: bash stop.sh"
    exit 0
  fi
done

echo
echo "✗ 15s 内未监听到 3001，输出最近日志："
tail -50 "$LOG_FILE"
exit 1
