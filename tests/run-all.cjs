#!/usr/bin/env node
// ============================================================
// Master Test Runner - Runs all Puppeteer feature tests
// ============================================================

const {
  startServer, stopServer,
  launchBrowser, closeBrowser,
  printResults,
} = require('./helpers.cjs');

const testOT = require('./test-ot.cjs');
const testFileManager = require('./test-file-manager.cjs');
const testTerminal = require('./test-terminal.cjs');
const testSystemMonitor = require('./test-system-monitor.cjs');
const testSplitPane = require('./test-split-pane.cjs');
const testDragDock = require('./test-drag-dock.cjs');
const testPopout = require('./test-popout.cjs');
const testCollab = require('./test-collab.cjs');
const testIntellihide = require('./test-intellihide.cjs');
const testExpo = require('./test-expo.cjs');
const testHotCorners = require('./test-hot-corners.cjs');
const testPersistence = require('./test-persistence.cjs');

async function main() {
  console.log('Building app...');
  const { execSync } = require('child_process');
  execSync('node node_modules/vite/bin/vite.js build', {
    cwd: require('path').resolve(__dirname, '..'),
    encoding: 'utf8',
  });
  console.log('Build complete.\n');

  console.log('Starting preview server...');
  await startServer();
  console.log('Server started.\n');

  console.log('Launching browser...');
  await launchBrowser();
  console.log('Browser ready.\n');

  try {
    console.log('━━━ 1. OT Engine ━━━');
    await testOT();

    console.log('\n━━━ 2. File Manager (VFS) ━━━');
    await testFileManager();

    console.log('\n━━━ 3. Terminal ━━━');
    await testTerminal();

    console.log('\n━━━ 4. System Monitor ━━━');
    await testSystemMonitor();

    console.log('\n━━━ 5. SplitPane Constraints ━━━');
    await testSplitPane();

    console.log('\n━━━ 6. Drag-to-Dock ━━━');
    await testDragDock();

    console.log('\n━━━ 7. Popout Windows ━━━');
    await testPopout();

    console.log('\n━━━ 8. WebSocket Collab ━━━');
    await testCollab();

    console.log('\n━━━ 9. Intellihide ━━━');
    await testIntellihide();

    console.log('\n━━━ 10. Expo/Scale View ━━━');
    await testExpo();

    console.log('\n━━━ 11. Hot Corners ━━━');
    await testHotCorners();

    console.log('\n━━━ 12. Layout Persistence ━━━');
    await testPersistence();

  } finally {
    await closeBrowser();
    stopServer();
  }

  const allPassed = printResults();
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  stopServer();
  process.exit(1);
});
