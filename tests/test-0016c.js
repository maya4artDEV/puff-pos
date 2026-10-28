// test-0016c.js — L2 part c (device clock check). Run from repo root:  node tests/test-0016c.js
// Serves index.html from a local http server whose Date header we control, so the real HEAD path is tested.
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require('playwright');
let skewMs = 0, mode = 'ok';   // skew = device minus server; mode 'fail' = drop the connection
const html = fs.readFileSync(path.resolve('index.html'));
const srv = http.createServer((req, res) => {
  if (mode === 'fail') { req.socket.destroy(); return; }
  res.setHeader('Date', new Date(Date.now() - skewMs).toUTCString());
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(req.method === 'HEAD' ? undefined : html);
});
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  let b;
  try { b = await chromium.launch({ channel: 'chrome' }); } catch (e) { b = await chromium.launch(); }
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && m.text().indexOf('ERR_') < 0) errs.push('console: ' + m.text()); });
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.indexOf(base) === 0) return r.continue();
    if (/\.js(\?|$)/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });   // CDN libs: empty
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, token: 'tok', state: null, states: [] }) });
  });
  await p.exposeFunction('setServer', (s, m) => { skewMs = s; mode = m || 'ok'; });
  await p.goto(base);
  await p.waitForTimeout(800);
  const R = await p.evaluate(async () => {
    const t = []; const ok = (id, cond, info) => t.push([id, !!cond, info === undefined ? '' : String(info)]);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const vis = id => getComputedStyle(document.getElementById(id)).display;
    const check = () => new Promise(r => checkDeviceClock(r));
    ok('T50 start-up check ran against the server -> ok', _clock.state === 'ok' && vis('clockBar') === 'none' && vis('clockBlock') === 'none', _clock.state);
    await setServer(4 * 60000); ok('T51 4 min off -> still ok', (await check()) === 'ok');
    await setServer(2 * 86400000); const st = await check();
    ok('T52 2 days off -> bad + full-screen block', st === 'bad' && vis('clockBlock') === 'flex' && document.getElementById('clockBlock').textContent.indexOf('ต่าง 2 วัน') >= 0, document.getElementById('clockBlock').textContent.slice(0, 70));
    localStorage.clear();
    const br = 'SBR-01';
    document.getElementById('loginName').value = 'Test'; document.getElementById('loginNick').value = 'T'; document.getElementById('loginPhone').value = '0';
    _loginBranch = br; setBranchAuth(br); setToken(br, 'tok', 'owner');
    doLogin(); await wait(300);
    ok('T53 login refused while clock wrong (no state written)', document.getElementById('mainApp').style.display !== 'block' && !localStorage.getItem(stateKey(br, todayISO())));
    _clock.at = -1e12; doLogin(); await wait(300);
    ok('T54 stale check re-runs on login (still wrong -> still refused)', document.getElementById('mainApp').style.display !== 'block' && _clock.state === 'bad');
    localStorage.setItem('puff7_device_mode', 'viewer'); renderClockUI();
    ok('T55 viewer mode is never blocked', vis('clockBlock') === 'none');
    localStorage.setItem('puff7_device_mode', 'writer'); renderClockUI();
    await setServer(0); document.querySelector('#clockBlock .cb-btn').onclick(); await wait(300);
    ok('T56 "ตรวจอีกครั้ง" after fixing the clock -> block gone', _clock.state === 'ok' && vis('clockBlock') === 'none');
    doLogin(); await wait(500);
    ok('T57 login works once the clock is right', document.getElementById('mainApp').style.display === 'block' && !!localStorage.getItem(stateKey(br, todayISO())));
    window.confirm = () => true;
    S.cash = { cash: 100 }; save(); go('close');
    await setServer(2 * 86400000); await check();
    confirmCloseDay(); await wait(200);
    ok('T58 close refused while clock wrong', !S.is_closed && vis('clockBlock') === 'flex');
    await setServer(0, 'fail'); _clock.at = -1e12;
    confirmCloseDay(); await wait(600);
    ok('T59 stale -> re-check before close; network down = warning only, close proceeds', _clock.state === 'offline' && S.is_closed === true && vis('clockBar') === 'block' && vis('clockBlock') === 'none');
    ok('T60 tablet header wraps for the clock bar', document.querySelector('.app-header').classList.contains('bd-on'));
    await setServer(0); await check();
    ok('T61 back online + right -> bar gone, header unwraps', vis('clockBar') === 'none' && !document.querySelector('.app-header').classList.contains('bd-on'));
    await setServer(2 * 86400000); _clock.at = performance.now() - 11 * 60000;
    document.dispatchEvent(new Event('visibilitychange')); await wait(400);
    ok('T62 coming back to the app (e.g. from Settings) re-checks and blocks', _clock.state === 'bad' && vis('clockBlock') === 'flex');
    await setServer(0); localStorage.clear();
    return t;
  });
  let pass = 0;
  R.forEach(r => { console.log((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[2] ? '  [' + r[2] + ']' : '')); if (r[1]) pass++; });
  console.log('console errors: ' + errs.length + (errs.length ? '\n  ' + errs.join('\n  ') : ''));
  console.log('RESULT ' + pass + '/' + R.length + (pass === R.length && !errs.length ? ' ALL PASS' : ' — NOT PASSING'));
  await b.close(); srv.close();
})();
