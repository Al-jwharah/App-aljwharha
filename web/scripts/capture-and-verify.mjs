import { execSync, spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, 'artifacts');
const baseUrl = 'http://127.0.0.1:3000';

await fs.mkdir(artifactsDir, { recursive: true });

execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

const server = spawn('npm', ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', '3000'], {
    cwd: rootDir,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitForServer(url) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // continue polling
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
        // Keep the flow resilient in production builds where CSS module class names can vary.
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

    await desktopPage.waitForFunction(() => {
        return Boolean(document.querySelector('[data-testid="cart-toggle"], #cart-toggle') || document.querySelector('#listings'));
    }, null, { timeout: 35000 }).catch(() => {});
    let addToCartClicked = false;
    let cartOpenClicked = false;
    let cartNote = 'ok';

    const listingButtons = desktopPage.locator('#listings button');
    if ((await listingButtons.count()) > 0) {
        await listingButtons.first().click();
        addToCartClicked = true;
    } else {
        cartNote = 'no #listings button found';
    }

    const cartToggleCandidates = [
        desktopPage.getByTestId('cart-toggle'),
        desktopPage.locator('#cart-toggle'),
        desktopPage.locator('button[aria-label="السلة"], button[aria-label="Cart"]'),
        desktopPage.locator('header button').nth(1),
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

    const cartTextBeforeReload = cartOpenClicked && (await desktopPage.locator('aside').count()) > 0 ? await desktopPage.locator('aside').first().textContent() : null;

    await desktopPage.reload({ waitUntil: 'networkidle' });
    await waitForListingsRenderable(desktopPage);

    const cartToggleAfterReload = (await desktopPage.getByTestId('cart-toggle').count()) > 0 ? desktopPage.getByTestId('cart-toggle') : desktopPage.locator('#cart-toggle');
    if ((await cartToggleAfterReload.count()) > 0) {
        await cartToggleAfterReload.first().click();
        await desktopPage.waitForTimeout(450);
    }

    const cartTextAfterReload = (await desktopPage.locator('aside').count()) > 0 ? await desktopPage.locator('aside').first().textContent() : null;
    const localStorageAfterReload = await desktopPage.evaluate(() => localStorage.getItem('aljwharah_cart_v1'));
    const cartPersisted = typeof localStorageAfterReload === 'string' && localStorageAfterReload.includes('quantity');

    const enToggle = desktopPage.locator('button:has-text("EN")');
    if ((await enToggle.count()) > 0) {
        await enToggle.first().click();
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
        defaultArabic: {
            lang: arLang,
            dir: arDir,
            navArabicVisible: arabicNavVisible,
        },
        englishToggle: {
            lang: enLang,
            dir: enDir,
            navEnglishVisible: englishNavVisible,
        },
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

    if (!server.killed) {
        server.kill('SIGTERM');
        await wait(400);
        if (!server.killed) server.kill('SIGKILL');
    }
}
