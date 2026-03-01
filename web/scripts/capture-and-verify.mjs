import { execSync, spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, 'artifacts');
const port = process.env.CAPTURE_PORT || '3100';
const baseUrl = `http://127.0.0.1:${port}`;

await fs.mkdir(artifactsDir, { recursive: true });
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

const standaloneCandidates = [
  path.join(rootDir, '.next', 'standalone', 'server.js'),
  path.join(rootDir, '.next', 'standalone', 'web', 'server.js'),
];
const standaloneServer = standaloneCandidates.find((candidate) => existsSync(candidate));
if (!standaloneServer) {
  throw new Error('Standalone server file was not found after build.');
}

const standaloneRoot = path.dirname(standaloneServer);
const standaloneNextDir = path.join(standaloneRoot, '.next');
await fs.mkdir(standaloneNextDir, { recursive: true });

const sourceStaticDir = path.join(rootDir, '.next', 'static');
if (existsSync(sourceStaticDir)) {
  await fs.cp(sourceStaticDir, path.join(standaloneNextDir, 'static'), { recursive: true, force: true });
}

const sourcePublicDir = path.join(rootDir, 'public');
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

async function stopServer() {
  if (!server.killed) {
    server.kill('SIGTERM');
    await wait(500);
    if (!server.killed) server.kill('SIGKILL');
  }
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: 'text/html' } });
      if (response.ok) return;
    } catch {
      // keep polling
    }
    await wait(1000);
  }
  throw new Error(`Server did not start on ${url}`);
}

async function waitForListingsRenderable(page) {
  try {
    await page.locator('#listings').first().waitFor({ state: 'attached', timeout: 35000 });
  } catch {
    return false;
  }

  try {
    await page.waitForFunction(() => {
      const section = document.querySelector('#listings');
      if (!section) return false;
      const hasCard = section.querySelector('article');
      const hasSkeleton = section.querySelector('[class*="listingSkeleton"]');
      const hasButton = section.querySelector('button');
      return Boolean(hasCard || hasSkeleton || hasButton);
    }, null, { timeout: 12000 });
  } catch {
    // keep flow resilient
  }

  return true;
}

let browser;

try {
  await waitForServer(baseUrl);
  browser = await chromium.launch({ headless: true });

  const desktopContext = await browser.newContext({ viewport: { width: 1536, height: 960 } });
  const desktopPage = await desktopContext.newPage();

  await desktopPage.goto(baseUrl, { waitUntil: 'networkidle' });
  await waitForListingsRenderable(desktopPage);
  await desktopPage.screenshot({ path: path.join(artifactsDir, 'home-desktop.png'), fullPage: true });

  const arLang = await desktopPage.evaluate(() => document.documentElement.lang);
  const arDir = await desktopPage.evaluate(() => document.documentElement.dir);
  const arabicNavVisible = (await desktopPage.getByRole('link', { name: 'الرئيسية' }).count()) > 0;

  await desktopPage.waitForFunction(() => Boolean(document.querySelector('[data-testid="cart-toggle"], #cart-toggle') || document.querySelector('#listings')), null, { timeout: 35000 }).catch(() => {});

  let addToCartClicked = false;
  let cartOpenClicked = false;
  let cartNote = 'ok';

  const listingButtons = desktopPage.locator('#listings button:visible');
  if ((await listingButtons.count()) > 0) {
    await listingButtons.first().click();
    addToCartClicked = true;
  } else {
    cartNote = 'no #listings button found';
  }

  const cartToggleCandidates = [
    desktopPage.getByTestId('cart-toggle'),
    desktopPage.locator('#cart-toggle'),
    desktopPage.locator('button:has-text("السلة")'),
    desktopPage.locator('button:has-text("Cart")'),
  ];

  let cartToggleClicked = false;
  for (const candidate of cartToggleCandidates) {
    if ((await candidate.count()) > 0) {
      await candidate.first().click();
      cartOpenClicked = true;
      cartToggleClicked = true;
      await desktopPage.waitForTimeout(450);
      break;
    }
  }

  if (!cartToggleClicked) {
    cartNote = cartNote === 'ok' ? 'no cart toggle button found' : `${cartNote}; no cart toggle button found`;
  }

  const cartTextBeforeReload = cartOpenClicked && (await desktopPage.locator('aside').count()) > 0
    ? await desktopPage.locator('aside').first().textContent()
    : null;

  await desktopPage.reload({ waitUntil: 'networkidle' });
  await waitForListingsRenderable(desktopPage);

  const cartToggleAfterReload = (await desktopPage.getByTestId('cart-toggle').count()) > 0
    ? desktopPage.getByTestId('cart-toggle')
    : desktopPage.locator('#cart-toggle');
  if ((await cartToggleAfterReload.count()) > 0) {
    await cartToggleAfterReload.first().click();
    await desktopPage.waitForTimeout(450);
  }

  const cartTextAfterReload = (await desktopPage.locator('aside').count()) > 0
    ? await desktopPage.locator('aside').first().textContent()
    : null;
  const localStorageAfterReload = await desktopPage.evaluate(() => localStorage.getItem('aljwharah_cart_v2'));
  const cartPersisted = await desktopPage.evaluate(() => {
    try {
      const raw = localStorage.getItem('aljwharah_cart_v2');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return false;
      return parsed.some((item) => Number(item?.qty || 0) > 0);
    } catch {
      return false;
    }
  });

  await desktopPage.evaluate(() => {
    const closeBtn = Array.from(document.querySelectorAll('aside button')).find((btn) => {
      const text = btn.textContent || '';
      return text.includes('إغلاق') || text.includes('Close');
    });
    if (closeBtn instanceof HTMLElement) closeBtn.click();
  });
  await desktopPage.waitForTimeout(250);

  if ((await desktopPage.locator('aside').count()) > 0) {
    await desktopPage.evaluate(() => {
      const overlay = document.querySelector('button[class*="overlay"]');
      if (overlay instanceof HTMLElement) overlay.click();
    });
    await desktopPage.waitForTimeout(250);
  }

  await desktopPage.evaluate(() => window.scrollTo(0, 0));
  await desktopPage.waitForTimeout(180);

  const enToggle = (await desktopPage.locator('[data-testid="locale-en"]:visible').count()) > 0
    ? desktopPage.locator('[data-testid="locale-en"]:visible').first()
    : desktopPage.getByRole('button', { name: 'EN' }).first();
  if ((await enToggle.count()) > 0) {
    await enToggle.click({ force: true });
    await desktopPage.waitForTimeout(700);
  }

  const enLang = await desktopPage.evaluate(() => document.documentElement.lang);
  const enDir = await desktopPage.evaluate(() => document.documentElement.dir);
  const englishNavVisible = (await desktopPage.getByRole('link', { name: 'Home' }).count()) > 0;

  const mobileContext = await browser.newContext({ ...devices['iPhone 13'] });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(baseUrl, { waitUntil: 'networkidle' });
  await waitForListingsRenderable(mobilePage);
  await mobilePage.screenshot({ path: path.join(artifactsDir, 'home-mobile.png'), fullPage: true });

  await mobilePage.close();
  await mobileContext.close();
  await desktopPage.close();
  await desktopContext.close();

  const report = {
    defaultArabic: { lang: arLang, dir: arDir, navArabicVisible: arabicNavVisible },
    englishToggle: { lang: enLang, dir: enDir, navEnglishVisible: englishNavVisible },
    cartPersistence: {
      addToCartClicked,
      cartOpenClicked,
      note: cartNote,
      cartTextBeforeReload,
      cartTextAfterReload,
      localStorageAfterReload,
      persisted: cartPersisted,
    },
    screenshots: {
      desktop: path.join(artifactsDir, 'home-desktop.png'),
      mobile: path.join(artifactsDir, 'home-mobile.png'),
    },
  };

  await fs.writeFile(path.join(artifactsDir, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await stopServer();
}


