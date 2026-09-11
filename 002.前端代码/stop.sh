#!/bin/bash
# 停止 vite dev server
if lsof -ti:3001 >/dev/null 2>&1; then
  PIDS=$(lsof -ti:3001)
  echo "正在停止: $PIDS"
  kill $PIDS 2>/dev/null
  sleep 1
  if lsof -ti:3001 >/dev/null 2>&1; then
    kill -9 $PIDS 2>/dev/null
  fi
  echo "✓ 已停止"
else
  echo "3001 端口空闲，没有 vite 在跑"
fi
