// ============================================================
// Test Helpers - Shared utilities for Puppeteer tests
// ============================================================

const puppeteer = require('puppeteer');
const { execSync, spawn } = require('child_process');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '..');
const PORT = 5199;
const BASE_URL = `http://localhost:${PORT}`;

let serverProcess = null;
let browser = null;

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', [
      path.join(APP_DIR, 'node_modules/vite/bin/vite.js'),
      'preview',
      '--port', String(PORT),
      '--host', '0.0.0.0',
    ], {
      cwd: APP_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) reject(new Error('Server start timeout'));
    }, 15000);

    serverProcess.stdout.on('data', (data) => {
      const str = data.toString();
      if (str.includes('Local') || str.includes(String(PORT))) {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          // Give it a moment to be ready
          setTimeout(resolve, 500);
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      // Some stderr is normal
    });

    serverProcess.on('error', reject);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

async function launchBrowser() {
  browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,720',
    ],
  });
  return browser;
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

async function newPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  return page;
}

async function openApp(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 10000 });
  // Wait for the desktop to render
  await page.waitForSelector('.kasm-desktop', { timeout: 5000 });
  // Dismiss welcome notification by waiting a moment
  await sleep(300);
}

async function launchAppByName(page, appName) {
  // Click the Apps button in the panel
  await page.click('.kasm-app-menu-btn');
  await page.waitForSelector('.kasm-app-menu', { timeout: 3000 });
  await sleep(200);

  // Find and click the app
  const apps = await page.$$('.kasm-app-menu__app');
  for (const app of apps) {
    const name = await app.$eval('.kasm-app-menu__app-name', el => el.textContent);
    if (name.trim() === appName) {
      await app.click();
      await sleep(300);
      return;
    }
  }
  throw new Error(`App "${appName}" not found in menu`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test result tracking
const results = { passed: 0, failed: 0, errors: [] };

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name, fn) {
  try {
    await fn();
    results.passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.failed++;
    results.errors.push({ name, error: err.message });
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${results.passed} passed, ${results.failed} failed`);
  if (results.errors.length > 0) {
    console.log('\nFailures:');
    results.errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  }
  console.log('='.repeat(60));
  return results.failed === 0;
}

module.exports = {
  APP_DIR, PORT, BASE_URL,
  startServer, stopServer,
  launchBrowser, closeBrowser, newPage,
  openApp, launchAppByName, sleep,
  assert, runTest, printResults, results,
};
