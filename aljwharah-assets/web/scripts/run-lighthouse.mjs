import { spawn, execSync } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const port = process.env.LIGHTHOUSE_PORT || '3101';
const baseUrl = `http://127.0.0.1:${port}`;
const reportPath = path.join(root, 'artifacts', 'lighthouse-desktop.json');

execSync('npm run build', { cwd: root, stdio: 'inherit' });

const standaloneCandidates = [
  path.join(root, '.next', 'standalone', 'server.js'),
  path.join(root, '.next', 'standalone', 'web', 'server.js'),
];
const standaloneServer = standaloneCandidates.find((candidate) => existsSync(candidate));
if (!standaloneServer) {
  throw new Error('Standalone server file was not found after build.');
}

const standaloneRoot = path.dirname(standaloneServer);
const standaloneNextDir = path.join(standaloneRoot, '.next');
await fs.mkdir(standaloneNextDir, { recursive: true });

const sourceStaticDir = path.join(root, '.next', 'static');
if (existsSync(sourceStaticDir)) {
  await fs.cp(sourceStaticDir, path.join(standaloneNextDir, 'static'), { recursive: true, force: true });
}

const sourcePublicDir = path.join(root, 'public');
if (existsSync(sourcePublicDir)) {
  await fs.cp(sourcePublicDir, path.join(standaloneRoot, 'public'), { recursive: true, force: true });
}

const server = spawn(process.execPath, [standaloneServer], {
  cwd: standaloneRoot,
  env: {
    ...process.env,
    HOSTNAME: '127.0.0.1',
    PORT: port,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

server.stdout.on('data', () => undefined);
server.stderr.on('data', () => undefined);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(baseUrl, { headers: { accept: 'text/html' } });
      if (res.ok) return;
    } catch {}
    await wait(1000);
  }
  throw new Error('server not ready');
}

async function stopServer() {
  if (!server.killed) {
    server.kill('SIGTERM');
    await wait(400);
    if (!server.killed) server.kill('SIGKILL');
  }
}

try {
  await waitForServer();

  let runError = null;
  try {
    execSync(
      `npx lighthouse ${baseUrl} --preset=desktop --output=json --output-path artifacts/lighthouse-desktop.json --chrome-flags="--headless --no-sandbox --user-data-dir=./artifacts/lh-profile" --quiet`,
      { cwd: root, stdio: 'inherit' },
    );
  } catch (error) {
    runError = error;
  }

  if (runError && !existsSync(reportPath)) {
    throw runError;
  }

  if (runError && existsSync(reportPath)) {
    console.warn('Lighthouse report generated but process ended with cleanup warning. Using generated JSON artifact.');
  }
} finally {
  await stopServer();
}