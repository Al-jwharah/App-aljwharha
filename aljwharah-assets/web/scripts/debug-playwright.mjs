import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const server = spawn('npm', ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', '3000'], {
  cwd: process.cwd(),
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://127.0.0.1:3000');
      if (r.ok) return;
    } catch {}
    await wait(1000);
  }
  throw new Error('server not ready');
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.log('response', res.status(), res.url());
    }
  });
  page.on('pageerror', (err) => console.log('pageerror', err.message));
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);
  const html = await page.evaluate(() => document.querySelector('#listings')?.innerHTML || 'none');
  console.log(html.slice(0, 700));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  setTimeout(() => server.kill('SIGKILL'), 300);
}
