// ============================================================
// Test: Benchmark Runner E2E
// Verifies run.html can execute the full benchmark sequence
// for both React and SolidJS without errors.
// ============================================================

const { newPage, sleep, assert, runTest, BASE_URL } = require('./helpers.cjs');

const BENCH_URL = `${BASE_URL}/bench`;
const BENCH_TIMEOUT = 120000; // 2 minutes per framework

module.exports = async function testBenchmark() {
  // ---- Test 1: Index page loads and button is clickable ----
  await runTest('Benchmark index page loads', async () => {
    const page = await newPage();
    await page.goto(`${BENCH_URL}/index.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    const btn = await page.$('#run-btn');
    assert(btn !== null, 'Run Benchmark button should exist');
    const btnText = await page.$eval('#run-btn', el => el.textContent);
    assert(btnText.includes('Run Benchmark'), `Button text should say "Run Benchmark", got "${btnText}"`);
    const status = await page.$eval('#status', el => el.textContent);
    assert(status.includes('Ready'), `Status should say Ready, got "${status}"`);
    await page.close();
  });

  // ---- Test 2: run.html rejects missing fw param ----
  await runTest('run.html shows error without fw param', async () => {
    const page = await newPage();
    await page.goto(`${BENCH_URL}/run.html`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    const status = await page.$eval('#status', el => el.textContent);
    assert(status.includes('Error'), `Should show error without fw param, got "${status}"`);
    await page.close();
  });

  // ---- Test 3: run.html rejects invalid fw param ----
  await runTest('run.html rejects invalid fw param', async () => {
    const page = await newPage();
    await page.goto(`${BENCH_URL}/run.html?fw=vue`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    const status = await page.$eval('#status', el => el.textContent);
    assert(status.includes('Error'), `Should show error for invalid fw, got "${status}"`);
    await page.close();
  });

  // ---- Test 4: SolidJS benchmark completes without errors ----
  await runTest('SolidJS benchmark runs to completion', async () => {
    const page = await newPage();
    const errors = [];

    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Navigate to benchmark runner for solid, with return to a non-existent page
    // so we can detect completion by URL change
    await page.goto(`${BENCH_URL}/run.html?fw=solid&return=index.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    // Wait for the benchmark to either complete (redirect) or fail (status shows error)
    const result = await Promise.race([
      // Success: page navigates to index.html
      page.waitForNavigation({ timeout: BENCH_TIMEOUT })
        .then(() => ({ outcome: 'redirect' })),
      // Failure: status shows error
      page.waitForFunction(
        () => document.getElementById('status')?.textContent?.includes('Error'),
        { timeout: BENCH_TIMEOUT }
      ).then(async () => {
        const status = await page.$eval('#status', el => el.textContent);
        const log = await page.$eval('#log', el => el.textContent);
        return { outcome: 'error', status, log };
      }),
    ]);

    if (result.outcome === 'error') {
      throw new Error(`Benchmark failed: ${result.status}\nLog: ${result.log}`);
    }

    // Verify results were stored in localStorage
    const stored = await page.evaluate(() => localStorage.getItem('bench_solid'));
    assert(stored !== null, 'bench_solid should be stored in localStorage');

    const data = JSON.parse(stored);
    assert(data.framework === 'solid', `Framework should be "solid", got "${data.framework}"`);
    assert(data.results && typeof data.results === 'object', 'Results object should exist');

    const resultKeys = Object.keys(data.results);
    assert(resultKeys.length >= 5, `Should have at least 5 metrics, got ${resultKeys.length}: ${resultKeys.join(', ')}`);

    // Check some key metrics exist
    assert('Cold Load' in data.results, 'Should have "Cold Load" metric');
    assert('Full Load' in data.results, 'Should have "Full Load" metric');

    // Check no JS errors during the run
    const fatalErrors = errors.filter(e =>
      e.includes('MouseEvent') ||
      e.includes('KeyboardEvent') ||
      e.includes('DragEvent') ||
      e.includes('Cannot read') ||
      e.includes('is not a constructor')
    );
    assert(fatalErrors.length === 0, `Should have no fatal JS errors, got: ${fatalErrors.join('; ')}`);

    await page.close();
  });

  // ---- Test 5: Verify event constructors work in cross-frame context ----
  await runTest('MouseEvent constructors work on iframe elements', async () => {
    const page = await newPage();

    // Load the solid app in an iframe-like setup
    await page.goto(`${BENCH_URL}/run.html?fw=solid&return=index.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    // Wait for the iframe to load
    await page.waitForFunction(
      () => {
        const f = document.getElementById('app-frame');
        try { return f?.contentDocument?.readyState === 'complete'; } catch(e) { return false; }
      },
      { timeout: 30000 }
    );

    // Test that we can create and dispatch events without errors
    const eventTest = await page.evaluate(() => {
      try {
        const frame = document.getElementById('app-frame');
        const doc = frame.contentWindow.document;
        const el = doc.querySelector('.kasm-desktop') || doc.body;

        // These are the exact patterns used in run.html
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100, bubbles: true }));
        el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });

    assert(eventTest.ok, `Event dispatch should work, got error: ${eventTest.error}`);
    await page.close();
  });

  // ---- Test 6: React benchmark completes without errors ----
  await runTest('React benchmark runs to completion', async () => {
    const page = await newPage();
    const errors = [];

    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BENCH_URL}/run.html?fw=react&return=index.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    // Wait for completion (redirect) or failure (status shows error)
    const result = await Promise.race([
      page.waitForNavigation({ timeout: BENCH_TIMEOUT })
        .then(() => ({ outcome: 'redirect' })),
      page.waitForFunction(
        () => document.getElementById('status')?.textContent?.includes('Error'),
        { timeout: BENCH_TIMEOUT }
      ).then(async () => {
        const status = await page.$eval('#status', el => el.textContent);
        const log = await page.$eval('#log', el => el.textContent);
        return { outcome: 'error', status, log };
      }),
    ]);

    if (result.outcome === 'error') {
      throw new Error(`Benchmark failed: ${result.status}\nLog: ${result.log}`);
    }

    const stored = await page.evaluate(() => localStorage.getItem('bench_react'));
    assert(stored !== null, 'bench_react should be stored in localStorage');

    const data = JSON.parse(stored);
    assert(data.framework === 'react', `Framework should be "react", got "${data.framework}"`);
    assert(data.results && typeof data.results === 'object', 'Results object should exist');
    assert('Cold Load' in data.results, 'Should have "Cold Load" metric');

    const fatalErrors = errors.filter(e =>
      e.includes('MouseEvent') ||
      e.includes('KeyboardEvent') ||
      e.includes('DragEvent') ||
      e.includes('is not a constructor')
    );
    assert(fatalErrors.length === 0, `No fatal errors, got: ${fatalErrors.join('; ')}`);

    await page.close();
  });

  // ---- Test 6b: Index page renders results when both benchmarks exist ----
  await runTest('Index page renders comparison results', async () => {
    const page = await newPage();
    await page.goto(`${BENCH_URL}/index.html`, { waitUntil: 'networkidle0', timeout: 10000 });

    // Inject fake results for both frameworks
    await page.evaluate(() => {
      const fakeResults = (fw) => JSON.stringify({
        framework: fw,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        cacheInfo: { resources_total: 10, resources_cached: 2, resources_network: 8 },
        results: {
          'Cold Load': fw === 'react' ? 450 : 320,
          'Full Load': fw === 'react' ? 500 : 380,
          'App Launch (avg)': fw === 'react' ? 12 : 8,
          'Drag over 9 windows (avg/frame)': fw === 'react' ? 3.5 : 1.2,
          'Close Window (avg)': fw === 'react' ? 5 : 2,
          'JS Heap Baseline (MB)': fw === 'react' ? 18 : 12,
        },
      });
      localStorage.setItem('bench_react', fakeResults('react'));
      localStorage.setItem('bench_solid', fakeResults('solid'));
      localStorage.removeItem('bench_phase');
    });

    // Reload so checkPhase() and renderResults() run with the data
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(500);

    // Scorecard should render
    const scorecard = await page.$('.scorecard');
    assert(scorecard !== null, 'Scorecard should be rendered');

    // Table should have rows
    const rows = await page.$$('table tbody tr');
    assert(rows.length >= 3, `Should have metric rows, got ${rows.length}`);

    // Bar chart should render
    const bars = await page.$$('.bar-row');
    assert(bars.length >= 3, `Should have bar chart rows, got ${bars.length}`);

    await page.close();
  });

  // ---- Test 7: "Clear" button resets state ----
  await runTest('Clear button resets results', async () => {
    const page = await newPage();
    await page.goto(`${BENCH_URL}/index.html`, { waitUntil: 'networkidle0', timeout: 10000 });

    // Set fake data
    await page.evaluate(() => {
      localStorage.setItem('bench_react', JSON.stringify({ framework: 'react', timestamp: Date.now(), results: { 'Cold Load': 100 } }));
      localStorage.setItem('bench_solid', JSON.stringify({ framework: 'solid', timestamp: Date.now(), results: { 'Cold Load': 80 } }));
      localStorage.setItem('bench_phase', 'solid');
    });

    await page.reload({ waitUntil: 'networkidle0' });

    // Click Clear
    await page.click('.btn-secondary');
    await sleep(200);

    const reactData = await page.evaluate(() => localStorage.getItem('bench_react'));
    const solidData = await page.evaluate(() => localStorage.getItem('bench_solid'));
    const phase = await page.evaluate(() => localStorage.getItem('bench_phase'));
    assert(reactData === null, 'bench_react should be cleared');
    assert(solidData === null, 'bench_solid should be cleared');
    assert(phase === null, 'bench_phase should be cleared');

    const status = await page.$eval('#status', el => el.textContent);
    assert(status.includes('cleared'), `Status should say cleared, got "${status}"`);

    await page.close();
  });

  // ---- Test 8: "Run Benchmark" works even with stale bench_phase ----
  await runTest('Run button works with stale bench_phase', async () => {
    const page = await newPage();
    await page.goto(`${BENCH_URL}/index.html`, { waitUntil: 'networkidle0', timeout: 10000 });

    // Simulate stale state from a crashed run
    await page.evaluate(() => {
      localStorage.setItem('bench_phase', 'react');
    });

    // Click Run — should still work (not be a no-op)
    const [response] = await Promise.all([
      page.waitForNavigation({ timeout: 5000 }),
      page.click('#run-btn'),
    ]);

    const url = page.url();
    assert(url.includes('run.html') && url.includes('fw=react'),
      `Should navigate to React benchmark despite stale phase, got ${url}`);

    await page.close();
  });
};
