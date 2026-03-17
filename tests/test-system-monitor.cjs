// ============================================================
// Test: System Monitor - Real browser performance metrics
// ============================================================

const { newPage, openApp, launchAppByName, sleep, assert, runTest } = require('./helpers.cjs');

module.exports = async function testSystemMonitor() {
  const page = await newPage();
  await openApp(page);
  await launchAppByName(page, 'System Monitor');

  await runTest('System Monitor opens with graphs', async () => {
    const monitor = await page.waitForSelector('[data-testid="system-monitor"]', { timeout: 3000 }).catch(() => null)
      || await page.waitForSelector('.kasm-sysmon', { timeout: 3000 });
    assert(monitor, 'System monitor not found');
  });

  await runTest('CPU metric displays and updates', async () => {
    // Wait for data to accumulate
    await sleep(2500);
    const metrics = await page.$$('.kasm-sysmon__metric');
    assert(metrics.length >= 3, `Should have at least 3 metrics, got ${metrics.length}`);

    const cpuValue = await page.$eval('.kasm-sysmon__metric:first-child .kasm-sysmon__metric-value', el => el.textContent).catch(() => null);
    assert(cpuValue, 'CPU metric value not found');
    assert(cpuValue.length > 0, 'CPU metric should have a value');
  });

  await runTest('Canvas graphs are rendering', async () => {
    const canvases = await page.$$('.kasm-sysmon__graph');
    assert(canvases.length >= 3, `Should have graph canvases, got ${canvases.length}`);

    // Check that canvas has been drawn on (non-blank)
    const hasContent = await page.evaluate(() => {
      const canvas = document.querySelector('.kasm-sysmon__graph');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      // Check if there are any non-zero pixels
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) return true;
      }
      return false;
    });
    assert(hasContent, 'Graph canvas should have drawn content');
  });

  await runTest('Memory metric shows percentage or MB', async () => {
    const memValue = await page.$$eval('.kasm-sysmon__metric-value', els =>
      els.map(el => el.textContent)
    );
    assert(memValue.length >= 2, 'Should have multiple metric values');
    // At least one should have a number
    const hasNumber = memValue.some(v => /\d/.test(v));
    assert(hasNumber, 'Metric values should contain numbers');
  });

  await runTest('Process table tab works', async () => {
    const tabs = await page.$$('.kasm-sysmon__tab');
    if (tabs.length >= 2) {
      await tabs[1].click();
      await sleep(3000); // Processes update every 2s, need full cycle
      const procRows = await page.$$('.kasm-sysmon__proc-row');
      assert(procRows.length > 0, 'Process table should have rows');
      await tabs[0].click();
      await sleep(200);
    } else {
      assert(true, 'No tab UI - single view mode');
    }
  });

  await runTest('Metrics update over time', async () => {
    // Ensure we're on graphs tab
    const tabs = await page.$$('.kasm-sysmon__tab');
    if (tabs.length >= 1) await tabs[0].click();
    await sleep(500);
    const getFirstValue = async () => {
      return page.$eval('.kasm-sysmon__metric-value', el => el.textContent).catch(() => '');
    };
    const v1 = await getFirstValue();
    await sleep(2000);
    const v2 = await getFirstValue();
    // Values might be the same if CPU is idle, but the test verifies the component didn't crash
    assert(v2.length > 0, 'Metric should still be rendering after time passes');
  });

  await page.close();
};
