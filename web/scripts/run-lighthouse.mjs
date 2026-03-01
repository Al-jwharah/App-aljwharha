import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { execSync } from 'node:child_process';

const root = process.cwd();

const server = spawn('npm', ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', '3000'], {
  cwd: root,
  shell: true,
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:3000');
      if (res.ok) return;
    } catch {}
    await wait(1000);
  }
  throw new Error('server not ready');
}

try {
  await waitForServer();
  execSync(
    'npx lighthouse http://127.0.0.1:3000 --preset=desktop --output=json --output-path artifacts/lighthouse-desktop.json --chrome-flags="--headless --no-sandbox" --quiet',
    { cwd: root, stdio: 'inherit' },
  );
} finally {
  server.kill('SIGTERM');
  setTimeout(() => server.kill('SIGKILL'), 300);
}
