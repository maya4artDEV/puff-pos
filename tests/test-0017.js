// test-0017.js — PWA (0017) tests. Run from repo root:  node tests/test-0017.js
// T1–T7 are pure-node file checks. T8 runs the 0016a/b/c regression suites.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const MANIFEST_PATH = path.join(ROOT, 'manifest.webmanifest');
const ICONS_DIR = path.join(ROOT, 'icons');

let pass = 0, fail = 0;
function ok(id, cond, info) {
  if (cond) { pass++; console.log('PASS ' + id + (info ? '  [' + info + ']' : '')); }
  else { fail++; console.log('FAIL ' + id + (info ? '  [' + info + ']' : '')); }
}

// Read files
const html = fs.readFileSync(HTML_PATH, 'utf8');
const manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf8');

// ── T1: manifest parses; fields = §1 exactly; icon files exist; PNG IHDR w×h = declared sizes ──
(function T1() {
  var manifest;
  try { manifest = JSON.parse(manifestRaw); ok('T1a manifest parses', true); }
  catch (e) { ok('T1a manifest parses', false, e.message); return; }

  ok('T1b id', manifest.id === './', manifest.id);
  ok('T1c name', manifest.name === 'Puff Stick POS', manifest.name);
  ok('T1d short_name', manifest.short_name === 'Puff POS', manifest.short_name);
  ok('T1e description', manifest.description === 'Puff Stick daily POS', manifest.description);
  ok('T1f lang', manifest.lang === 'th', manifest.lang);
  ok('T1g start_url', manifest.start_url === './', manifest.start_url);
  ok('T1h scope', manifest.scope === './', manifest.scope);
  ok('T1i display', manifest.display === 'standalone', manifest.display);
  ok('T1j background_color', manifest.background_color === '#EFEAE2', manifest.background_color);
  ok('T1k theme_color', manifest.theme_color === '#6FA3D6', manifest.theme_color);
  ok('T1l icons count', manifest.icons && manifest.icons.length === 3, manifest.icons ? manifest.icons.length : 0);
  ok('T1m no orientation', manifest.orientation === undefined);

  // Check icon files exist and PNG IHDR dimensions
  function pngDimensions(filePath) {
    var buf = fs.readFileSync(filePath);
    // PNG IHDR: bytes 16-19 = width, 20-23 = height (big-endian)
    if (buf[0] !== 0x89 || buf[1] !== 0x50) return null; // not PNG
    var w = buf.readUInt32BE(16);
    var h = buf.readUInt32BE(20);
    return { w: w, h: h };
  }

  if (manifest.icons) {
    manifest.icons.forEach(function (icon) {
      var fpath = path.join(ROOT, icon.src);
      var exists = fs.existsSync(fpath);
      ok('T1n icon exists: ' + icon.src, exists);
      if (exists) {
        var dim = pngDimensions(fpath);
        var declared = icon.sizes.split('x');
        var dw = parseInt(declared[0], 10), dh = parseInt(declared[1], 10);
        ok('T1o icon size ' + icon.src, dim && dim.w === dw && dim.h === dh,
          dim ? dim.w + 'x' + dim.h + ' vs declared ' + icon.sizes : 'not PNG');
      }
    });
  }

  // Also check apple-touch-icon exists
  var appleIcon = path.join(ICONS_DIR, 'apple-touch-icon.png');
  ok('T1p apple-touch-icon exists', fs.existsSync(appleIcon));
  if (fs.existsSync(appleIcon)) {
    var ad = pngDimensions(appleIcon);
    ok('T1q apple-touch-icon 180x180', ad && ad.w === 180 && ad.h === 180, ad ? ad.w + 'x' + ad.h : 'not PNG');
  }
})();

// ── T2: index.html has manifest link, apple-touch-icon, theme-color == manifest.theme_color ──
(function T2() {
  ok('T2a link rel=manifest', html.indexOf('rel="manifest"') > -1 && html.indexOf('href="manifest.webmanifest"') > -1);
  ok('T2b apple-touch-icon link', html.indexOf('rel="apple-touch-icon"') > -1 && html.indexOf('href="icons/apple-touch-icon.png"') > -1);

  var manifest = JSON.parse(manifestRaw);
  var tcMatch = html.match(/meta\s+name="theme-color"\s+content="([^"]+)"/);
  ok('T2c theme-color meta exists', !!tcMatch);
  if (tcMatch) {
    ok('T2d theme-color matches manifest', tcMatch[1] === manifest.theme_color, tcMatch[1] + ' vs ' + manifest.theme_color);
  }

  // Every href in the new meta/link block resolves to an existing file
  var hrefs = ['manifest.webmanifest', 'icons/apple-touch-icon.png'];
  hrefs.forEach(function (h) {
    ok('T2e href resolves: ' + h, fs.existsSync(path.join(ROOT, h)));
  });
})();

// ── T3: no serviceWorker / navigator.serviceWorker string in index.html ──
(function T3() {
  ok('T3a no serviceWorker', html.indexOf('serviceWorker') === -1 && html.indexOf('navigator.serviceWorker') === -1);
})();

// ── T4: stamp 20261030.0017 on exactly 3 lines; old 20261029.0016 = 0 ──
(function T4() {
  var lines = html.split('\n');
  var newCount = 0, oldCount = 0;
  lines.forEach(function (line) {
    if (line.indexOf('20261030.0017') > -1) newCount++;
    if (line.indexOf('20261029.0016') > -1) oldCount++;
  });
  ok('T4a new stamp on exactly 3 lines', newCount === 3, 'found ' + newCount);
  ok('T4b old stamp 0 lines', oldCount === 0, 'found ' + oldCount);
})();

// ── T5: headless Chrome: stub pwaDoReload + confirm; both labels exist with build-tap ──
(function T5() {
  // This test requires playwright — run in async wrapper
  var hasPlaywright = true;
  try { require.resolve('playwright'); } catch (e) { hasPlaywright = false; }
  if (!hasPlaywright) {
    console.log('SKIP T5 (playwright not available)');
    return;
  }

  // We run T5 as a child process since it's async
  var t5Script = `
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  let b;
  try { b = await chromium.launch({ channel: 'chrome' }); } catch (e) { b = await chromium.launch(); }
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue()
    : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, token: 'tok', state: null, states: [] }) }));
  await p.goto('file:///' + path.resolve('index.html').replace(/\\\\\\\\/g, '/').replace(/#/g, '%23'));
  await p.waitForTimeout(1000);
  const R = await p.evaluate(() => {
    const t = []; const ok = (id, cond, info) => t.push([id, !!cond, info === undefined ? '' : String(info)]);

    // T5a: both labels exist
    var lb = document.getElementById('loginBuild');
    var bv = document.getElementById('buildVer');
    ok('T5a loginBuild exists', !!lb, lb ? lb.textContent : 'missing');
    ok('T5b buildVer exists', !!bv, bv ? bv.textContent : 'missing');

    // T5c: both carry build-tap class
    ok('T5c loginBuild has build-tap', lb && lb.classList.contains('build-tap'));
    ok('T5d buildVer has build-tap', bv && bv.classList.contains('build-tap'));

    // T5e: stub pwaDoReload and confirm=false -> 0 calls
    var reloadCalls = 0;
    window.pwaDoReload = function () { reloadCalls++; };
    window.confirm = function () { return false; };
    window.pwaReload();
    ok('T5e confirm=false -> 0 reload calls', reloadCalls === 0, reloadCalls);

    // T5f: confirm=true -> 1 call
    reloadCalls = 0;
    window.confirm = function () { return true; };
    window.pwaReload();
    ok('T5f confirm=true -> 1 reload call', reloadCalls === 1, reloadCalls);

    // T5g: pwaPendingCount returns a number
    ok('T5g pwaPendingCount returns number', typeof window.pwaPendingCount() === 'number', window.pwaPendingCount());

    // T5h: pwaBuildStamp returns the stamp
    ok('T5h pwaBuildStamp', window.pwaBuildStamp() === '20261030.0017', window.pwaBuildStamp());

    return t;
  });
  R.forEach(r => process.stdout.write((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[2] ? '  [' + r[2] + ']' : '') + '\\n'));
  process.stdout.write('T5_RESULT ' + R.filter(r => r[1]).length + '/' + R.length + '\\n');
  await b.close();
})();
`;

  var t5File = path.join(__dirname, '_t5_temp.js');
  fs.writeFileSync(t5File, t5Script);
  try {
    var out = execSync('node "' + t5File + '"', { cwd: ROOT, timeout: 30000, encoding: 'utf8' });
    console.log(out.trim());
    var m = out.match(/T5_RESULT (\d+)\/(\d+)/);
    if (m) {
      var t5pass = parseInt(m[1], 10), t5total = parseInt(m[2], 10);
      pass += t5pass;
      if (t5pass < t5total) fail += (t5total - t5pass);
    }
  } catch (e) {
    console.log('FAIL T5 execution error: ' + e.message);
    fail++;
  } finally {
    try { fs.unlinkSync(t5File); } catch (e2) {}
  }
})();

// ── T6: no new innerHTML, template literal, let/const, arrow fn in the new PWA block ──
(function T6() {
  // Extract the new PWA block
  var startMarker = '// ── PWA (0017)';
  var endMarker = 'pwaWireBuildLabels();';
  var startIdx = html.indexOf(startMarker);
  var endIdx = html.indexOf(endMarker);
  ok('T6a PWA block found', startIdx > -1 && endIdx > -1);
  if (startIdx > -1 && endIdx > -1) {
    var block = html.substring(startIdx, endIdx + endMarker.length);
    ok('T6b no innerHTML', block.indexOf('innerHTML') === -1);
    ok('T6c no template literal', block.indexOf('`') === -1);
    // Check for let/const at word boundaries (not inside strings/comments)
    var hasLet = /\blet\s/.test(block);
    var hasConst = /\bconst\s/.test(block);
    ok('T6d no let/const', !hasLet && !hasConst, hasLet ? 'found let' : hasConst ? 'found const' : '');
    // Arrow functions: =>
    ok('T6e no arrow fn', block.indexOf('=>') === -1);
  }
})();

// ── T7: node --check on extracted <script>; brace balance ──
(function T7() {
  var scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  ok('T7a script block found', !!scriptMatch);
  if (scriptMatch) {
    var scriptContent = scriptMatch[1];
    var tmpFile = path.join(__dirname, '_t7_temp.js');
    fs.writeFileSync(tmpFile, scriptContent);
    try {
      execSync('node --check "' + tmpFile + '"', { timeout: 10000 });
      ok('T7b node --check passes', true);
    } catch (e) {
      ok('T7b node --check passes', false, e.stderr ? e.stderr.toString().substring(0, 200) : e.message);
    }

    // Brace balance
    var open = 0, close = 0;
    for (var i = 0; i < scriptContent.length; i++) {
      if (scriptContent[i] === '{') open++;
      if (scriptContent[i] === '}') close++;
    }
    ok('T7c brace balance', open === close, 'open=' + open + ' close=' + close);

    try { fs.unlinkSync(tmpFile); } catch (e2) {}
  }
})();

// ── T8: regression: run 0016a/b/c ──
(function T8() {
  var suites = [
    { name: 'test-0016a', expected: 26 },
    { name: 'test-0016b', expected: 17 },
    { name: 'test-0016c', expected: 13 }
  ];
  suites.forEach(function (s) {
    var suitePath = path.join(__dirname, s.name + '.js');
    if (!fs.existsSync(suitePath)) {
      console.log('SKIP T8 ' + s.name + ' (file not found)');
      return;
    }
    try {
      var out = execSync('node "' + suitePath + '"', { cwd: ROOT, timeout: 60000, encoding: 'utf8' });
      console.log('--- ' + s.name + ' ---');
      // Print only the RESULT line and any FAIL lines
      var lines = out.split('\n');
      var fails = lines.filter(function (l) { return l.indexOf('FAIL') === 0; });
      fails.forEach(function (f) { console.log('  ' + f.trim()); });
      var resultLine = lines.find(function (l) { return l.indexOf('RESULT') === 0; });
      if (resultLine) console.log('  ' + resultLine.trim());
      var m = out.match(/RESULT (\d+)\/(\d+)/);
      if (m) {
        var sp = parseInt(m[1], 10), st = parseInt(m[2], 10);
        ok('T8 ' + s.name + ' ' + sp + '/' + st, sp === s.expected && sp === st, resultLine ? resultLine.trim() : '');
      } else {
        ok('T8 ' + s.name + ' result parse', false, 'no RESULT line found');
      }
    } catch (e) {
      ok('T8 ' + s.name + ' execution', false, e.message.substring(0, 200));
    }
  });
})();

// ── SUMMARY ──
console.log('\n========================================');
console.log('test-0017 RESULT ' + pass + '/' + (pass + fail) + (fail === 0 ? ' ALL PASS' : ' — ' + fail + ' FAILING'));
console.log('========================================');
