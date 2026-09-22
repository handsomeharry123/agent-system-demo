#!/bin/bash
# 只停止由本项目 start.sh 记录的进程，不影响同端口的其他服务。
PID_FILE=/tmp/agent-system-demo-vite.pid
if [ ! -f "$PID_FILE" ]; then
  echo "没有本项目的启动记录"
  exit 0
fi
VITE_PID=$(cat "$PID_FILE")
if ps -p "$VITE_PID" -o command= 2>/dev/null | grep -q 'npm run dev'; then
  kill "$VITE_PID"
  echo "✓ 已停止项目进程 $VITE_PID"
else
  echo "记录的进程已退出，未停止其他服务"
fi
rm "$PID_FILE"
