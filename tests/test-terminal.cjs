// ============================================================
// Test: Terminal - Full command-line emulator with VFS
// ============================================================

const { newPage, openApp, launchAppByName, sleep, assert, runTest } = require('./helpers.cjs');

module.exports = async function testTerminal() {
  const page = await newPage();
  await openApp(page);
  await launchAppByName(page, 'Terminal');

  async function typeCommand(cmd) {
    await page.focus('.kasm-terminal__input');
    // Clear existing input
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.type(cmd);
    await page.keyboard.press('Enter');
    await sleep(200);
  }

  async function getLastOutput() {
    const lines = await page.$$eval('.kasm-terminal__line', els =>
      els.map(el => el.textContent).filter(Boolean)
    );
    // Return last non-input line
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].startsWith('$') && !lines[i].startsWith('kasm-user@')) {
        return lines[i];
      }
    }
    return '';
  }

  await runTest('Terminal opens with welcome message', async () => {
    await page.waitForSelector('.kasm-terminal__input', { timeout: 3000 });
    const lines = await page.$$('.kasm-terminal__line');
    assert(lines.length > 0, 'No terminal output lines');
  });

  await runTest('pwd shows current directory', async () => {
    await typeCommand('pwd');
    const output = await getLastOutput();
    assert(output.includes('/home') || output.includes('kasm'), `pwd should show home dir, got: ${output}`);
  });

  await runTest('echo prints text', async () => {
    await typeCommand('echo Hello Kasm');
    const output = await getLastOutput();
    assert(output.includes('Hello Kasm'), `echo should print text, got: ${output}`);
  });

  await runTest('ls shows directory contents', async () => {
    await typeCommand('ls');
    const output = await getLastOutput();
    assert(output.length > 0, 'ls should produce output');
  });

  await runTest('date shows current date', async () => {
    await typeCommand('date');
    const output = await getLastOutput();
    assert(output.length > 5, `date should show date string, got: ${output}`);
  });

  await runTest('whoami shows username', async () => {
    await typeCommand('whoami');
    const output = await getLastOutput();
    assert(output.includes('kasm'), `whoami should show username, got: ${output}`);
  });

  await runTest('uname shows system info', async () => {
    await typeCommand('uname');
    const output = await getLastOutput();
    assert(output.length > 0, 'uname should produce output');
  });

  await runTest('Unknown command shows error', async () => {
    await typeCommand('nonexistentcommand');
    const lines = await page.$$eval('.kasm-terminal__line', els =>
      els.map(el => ({ text: el.textContent, cls: el.className }))
    );
    const errorLine = lines.find(l => l.text.includes('not found') || l.cls.includes('error'));
    assert(errorLine, 'Unknown command should show error');
  });

  await runTest('History navigation with up arrow', async () => {
    await page.focus('.kasm-terminal__input');
    await page.keyboard.press('ArrowUp');
    await sleep(100);
    const inputVal = await page.$eval('.kasm-terminal__input', el => el.value);
    assert(inputVal.length > 0, 'Arrow up should recall history');
  });

  await runTest('env shows environment variables', async () => {
    await typeCommand('env');
    const lines = await page.$$eval('.kasm-terminal__line', els =>
      els.map(el => el.textContent)
    );
    const envLines = lines.filter(l => l.includes('=') && !l.startsWith('$'));
    assert(envLines.length > 0, 'env should show variables');
  });

  await runTest('clear removes output', async () => {
    await typeCommand('clear');
    await sleep(200);
    const lines = await page.$$('.kasm-terminal__line');
    // After clear, should have very few or no lines
    assert(lines.length <= 2, `clear should remove most output, still has ${lines.length} lines`);
  });

  await page.close();
};
