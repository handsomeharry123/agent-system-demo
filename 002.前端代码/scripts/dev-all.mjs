import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const processes = [
  spawn(npmCommand, ['--prefix', '../004.后端代码', 'run', 'dev'], { stdio: 'inherit' }),
  spawn(npmCommand, ['run', 'dev:frontend'], { stdio: 'inherit' }),
];

let stopping = false;
const stop = (signal = 'SIGTERM') => {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (!child.killed) child.kill(signal);
  }
};

for (const child of processes) {
  child.on('error', (error) => {
    console.error(error);
    stop();
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`开发服务异常退出（${signal ?? `code ${code}`}）`);
      process.exitCode = code ?? 1;
      stop();
    }
  });
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
