// ============================================================
// Test: Popout Windows - Golden Layout browser popout
// ============================================================

const { newPage, openApp, launchAppByName, sleep, assert, runTest } = require('./helpers.cjs');

module.exports = async function testPopout() {
  const page = await newPage();
  await openApp(page);

  await runTest('Window renders with title bar and controls', async () => {
    await launchAppByName(page, 'Calculator');
    await sleep(300);
    const titlebar = await page.waitForSelector('.kasm-titlebar', { timeout: 3000 });
    assert(titlebar, 'Title bar not found');

    const controls = await page.$$('.kasm-titlebar__btn');
    assert(controls.length >= 2, `Should have window controls, got ${controls.length}`);
  });

  await runTest('Maximize button works', async () => {
    const maxBtn = await page.$('.kasm-window .kasm-titlebar__btn--maximize');
    if (maxBtn) {
      await maxBtn.click();
      await sleep(300);
      const isMaximized = await page.$('.kasm-window--maximized');
      assert(isMaximized, 'Window should be maximized after clicking maximize');

      // Restore
      const restoreBtn = await page.$('.kasm-window--maximized .kasm-titlebar__btn--maximize');
      if (restoreBtn) {
        await restoreBtn.click();
        await sleep(300);
      }
    }
  });

  await runTest('Close button removes window', async () => {
    // Open a fresh calculator
    await launchAppByName(page, 'Calculator');
    await sleep(400);
    const windowCount = (await page.$$('.kasm-window')).length;
    assert(windowCount > 0, 'Should have at least 1 window');

    // Get all close buttons and click the last one (topmost window)
    const closeBtns = await page.$$('.kasm-titlebar__btn--close');
    if (closeBtns.length > 0) {
      await closeBtns[closeBtns.length - 1].click();
      await sleep(400);
      const newCount = (await page.$$('.kasm-window')).length;
      assert(newCount < windowCount, `Window should be removed after close. Before: ${windowCount}, After: ${newCount}`);
    }
  });

  await runTest('PopoutWindow component file exists', async () => {
    const fs = require('fs');
    const path = require('path');
    const popoutPath = path.resolve(__dirname, '..', 'src', 'window', 'PopoutWindow.tsx');
    assert(fs.existsSync(popoutPath), 'PopoutWindow.tsx should exist');
    const content = fs.readFileSync(popoutPath, 'utf8');
    assert(content.includes('window.open') || content.includes('createPortal'), 'PopoutWindow should use window.open or createPortal');
  });

  await runTest('Window minimize hides the window', async () => {
    // Open a fresh window
    await launchAppByName(page, 'Calculator');
    await sleep(400);
    const windowsBefore = (await page.$$('.kasm-window')).length;
    assert(windowsBefore > 0, 'Should have at least 1 window');

    // Find minimize button of the focused/topmost window
    const focusedWindow = await page.$('.kasm-window--focused') || await page.$('.kasm-window:last-of-type');
    if (focusedWindow) {
      const minBtn = await focusedWindow.$('.kasm-titlebar__btn--minimize');
      if (minBtn) {
        await minBtn.click();
        await sleep(300);
        const windowsAfter = (await page.$$('.kasm-window')).length;
        assert(windowsAfter < windowsBefore, `Minimized window should not be visible. Before: ${windowsBefore}, After: ${windowsAfter}`);
      }
    }
  });

  await page.close();
};
