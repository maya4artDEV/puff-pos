// test-0018b-server.js — client index.html against the REAL server code (gs/Code-*.gs + gs/Access.gs in the Node
// Apps Script harness gs/test/gas-stub.js), end to end through the UI. No Google call leaves the machine.
// Run from repo root:  node tests/test-0018b-server.js
// Old-server case (D-b5-3): also runs the client against the previous Access.gs when OLD_ACCESS (path under gs/)
// exists — default gs/_bak-0018a5/Access.gs. Missing → that part is reported as SKIP, never as PASS.
// S01–S08: HQ · company owner · staff · franchise owner · old server · memory only · ENFORCE_TOKEN on throughout.
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require('playwright');
const { makeEnv } = require(path.resolve('gs', 'test', 'gas-stub.js'));

const html = fs.readFileSync(path.resolve('index.html'));
const OWNER = (/var OWNER_URL = "([^"]+)"/.exec(html.toString()) || [])[1];
const FRAN = (/var FRANCHISE_URL = "([^"]+)"/.exec(html.toString()) || [])[1];
const OLD_ACCESS = process.env.OLD_ACCESS || '_bak-0018a5/Access.gs';
const HAVE_OLD = fs.existsSync(path.resolve('gs', OLD_ACCESS));
const V9_HEAD = ['branch', 'owner_pin', 'staff_pin', 'report_email', 'updated_at', 'type', 'status', 'label', 'start', 'end', 'act_code', 'act_exp', 'created_by'];

function pad(n) { return (n < 10 ? '0' : '') + n; }
function todayN() { return Math.floor((Date.now() + 7 * 3600 * 1000) / 864e5); }
function be(off) { const c = new Date((todayN() + off) * 864e5); return pad(c.getUTCDate()) + '/' + pad(c.getUTCMonth() + 1) + '/' + (c.getUTCFullYear() + 543); }
function iso(off) { const c = new Date((todayN() + off) * 864e5); return c.getUTCFullYear() + '-' + pad(c.getUTCMonth() + 1) + '-' + pad(c.getUTCDate()); }
function day(n) { return { sales: [{ ts: 'x', totalAmount: n, totalPieces: 1, items: [{ name: 'ORI', pieces: 1 }] }] }; }

// One server pair. accessFile = which Access.gs (relative to gs/). Both scripts get the same file, as at rollout.
function servers(accessFile) {
  const o = makeEnv('owner', { props: { HQ_PIN: '8642', ENFORCE_TOKEN: 'true' }, files: ['Code-owner.gs', accessFile] });
  const f = makeEnv('franchise', { props: { ENFORCE_TOKEN: 'true' }, files: ['Code-franchise.gs', accessFile] });
  [[o, 'SBR-01', 'company', '2580', '1357'], [f, 'BK-F01', 'franchise', '3691', '1468']].forEach(([e, b, type, op, sp]) => {
    e.seedAccess([[b, e.call('pinHash_', b, 'owner', op), e.call('pinHash_', b, 'staff', sp), '', '', type, 'active', 'L ' + b]], V9_HEAD);
    const tok = e.post({ type: 'branch_auth', branch: b, pin: op, kind: type }).token;
    // 9 saved days through the real state_save (newest = yesterday), amounts 10..90; one day 40 days back (outside)
    for (let i = 1; i <= 9; i++) e.post({ type: 'state_save', branch: b, token: tok, date: be(-i), state: day(i * 10) });
    e.post({ type: 'state_save', branch: b, token: tok, date: be(-40), state: day(5000) });
  });
  return { o, f };
}

const srv = http.createServer((req, res) => {
  res.setHeader('Date', new Date().toUTCString());
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(req.method === 'HEAD' ? '' : html);
});

(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  let b;
  try { b = await chromium.launch({ channel: 'chrome' }); } catch (e) { b = await chromium.launch(); }
  const p = await b.newPage();
  p.setDefaultTimeout(8000);
  const errs = [], R = [], calls = [];
  const ok = (id, cond, info) => R.push([id, cond === 'SKIP' ? 'SKIP' : !!cond, info === undefined ? '' : String(info)]);
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  let S = servers('Access.gs');
  await p.route('**/*', route => {
    const rq = route.request(), u = rq.url();
    if (u.indexOf('https://script.google.com/') === 0) {
      const env = u.indexOf(OWNER) === 0 ? S.o : u.indexOf(FRAN) === 0 ? S.f : null;
      let ans = { ok: false, error: 'unknown script' };
      if (env) {
        if (rq.method() === 'GET') { const q = Object.fromEntries(new URL(u).searchParams); calls.push({ which: env === S.o ? 'owner' : 'franchise', type: q.type, t: q.t }); ans = env.get(q); }
        else { const body = JSON.parse(rq.postData() || '{}'); calls.push({ which: env === S.o ? 'owner' : 'franchise', type: body.type }); ans = env.post(body); }
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(ans) });
    }
    if (u.indexOf(base) === 0) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const hist = () => p.evaluate(() => ({
    open: cloudHistOpen(), hero: (document.querySelector('#histWeekCard .wh-amount') || {}).textContent || '',
    days: [].map.call(document.querySelectorAll('#histContent .day-date'), function (x) { return x.textContent; }),
    bars: document.querySelectorAll('#histBarCard .hbc-col').length,
    status: (document.getElementById('hcStatus') || document.querySelector('#histCloudCard .hc-status') || {}).textContent || ''
  }));
  async function loadRange(fromOff, toOff) {
    await p.evaluate(([a, z]) => { go('hist'); var x = document.getElementById('hcClose'); if (x) x.click(); document.getElementById('hcMonth').value = ''; document.getElementById('hcFrom').value = a; document.getElementById('hcTo').value = z; document.getElementById('hcLoad').click(); }, [iso(fromOff), iso(toOff)]);
    await p.waitForTimeout(500);
  }
  async function branchLogin(tab, branch, pin) {
    await p.fill('#loginName', 'Test Tester'); await p.fill('#loginNick', 'T'); await p.fill('#loginPhone', '0800000000');
    await p.click('#loginTabs [data-tab="' + tab + '"]');
    if (tab === 'company') await p.selectOption('#loginBranchSel', branch); else await p.fill('#loginFreeInput', branch);
    await p.fill('#loginPinInput', pin);
    await p.click('#loginBtn');
    await p.waitForFunction(() => document.getElementById('mainApp').style.display === 'block', null, { timeout: 8000 }).catch(() => { });
    await p.waitForTimeout(600);
  }
  const snap = () => p.evaluate(() => { var o = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('puff7_') === 0) o.push(k + '=' + localStorage.getItem(k)); } return o.sort().join('\n'); });
  const tokRole = t => { try { return JSON.parse(Buffer.from(String(t).split('.')[0], 'base64').toString()).r; } catch (e) { return ''; } };
  const want9 = Array.from({ length: 9 }, (_, i) => be(-(i + 1)));   // newest first

  try {
    // ── S01 HQ: PIN → real state_list → SBR-01 card → ประวัติ → last 10 days from the real state_range ──
    await p.goto(base); await p.waitForTimeout(600);
    await p.click('#loginHQ'); await p.waitForTimeout(400);
    await p.fill('#page-hq input', '8642'); await p.click('#page-hq button'); await p.waitForTimeout(700);
    await p.click('#page-hq [data-hqbranch="SBR-01"]'); await p.waitForTimeout(700);
    const before = await snap();
    calls.length = 0;
    await loadRange(-10, 0);
    const h1 = await hist(), c1 = calls.filter(c => c.type === 'state_range');
    ok('S01 HQ → SBR-01 ประวัติ, last 10 days: real server answers 9 days newest first, hero = whole range ฿450, 7 bars; call = Owner + HQ token',
      h1.open && h1.days.join(',') === want9.join(',') && h1.hero === '฿450' && h1.bars === 7 && c1.length === 1 && c1[0].which === 'owner' && tokRole(c1[0].t) === 'hq',
      JSON.stringify([h1, c1]));
    ok('S02 memory only: the device day keys are the same before and after the cloud load', (await snap()) === before);
    // ── S03 > 62 days never reaches the server; S04 the server's own limit (client check bypassed) ──
    calls.length = 0;
    await loadRange(-70, 0);
    const n3 = calls.filter(c => c.type === 'state_range').length;
    const s4 = await p.evaluate(() => new Promise(function (res) {
      fetchJSON(readURLFor('SBR-01') + '?type=state_range&branch=SBR-01&from=01/01/2569&to=31/03/2569&t=' + encodeURIComponent(readTokenFor('SBR-01')), { method: 'GET' }, 8000).then(res, function () { res(null); });
    }));
    ok('S03 + S04 range > 62 days: refused on the device (no request) · server answers range_too_long max 62 when asked directly', n3 === 0 && s4 && s4.error === 'range_too_long' && s4.max === 62, JSON.stringify([n3, s4]));
    await p.evaluate(() => doLogout()); await p.waitForTimeout(300);

    // ── S05 company owner (branch token, own script) · staff cannot reach it ──
    await branchLogin('company', 'SBR-01', '2580');
    calls.length = 0;
    await loadRange(-5, -1);
    const h5 = await hist(), c5 = calls.filter(c => c.type === 'state_range');
    const staffDirect = await p.evaluate(() => getRole());
    ok('S05 SBR-01 owner login (real branch_auth) → ประวัติ, 5 days: 5 days from Owner with its own token, hero ฿150',
      staffDirect === 'owner' && h5.open && h5.days.join(',') === want9.slice(0, 5).join(',') && h5.hero === '฿150' && c5.length === 1 && c5[0].which === 'owner' && tokRole(c5[0].t) === 'owner',
      JSON.stringify([staffDirect, h5, c5]));
    await p.evaluate(() => doLogout()); await p.waitForTimeout(300);
    await branchLogin('company', 'SBR-01', '1357');
    const s6 = await p.evaluate(() => new Promise(function (res) {
      var role = getRole(); go('hist'); var tab = currentTab;
      fetchJSON(readURLFor('SBR-01') + '?type=state_range&branch=SBR-01&from=' + encodeURIComponent(shiftDateStr(todayISO(), -5)) + '&to=' + encodeURIComponent(todayISO()) + '&t=' + encodeURIComponent(readTokenFor('SBR-01')), { method: 'GET' }, 8000)
        .then(function (d) { res({ role: role, tab: tab, srv: d }); }, function () { res({ role: role, tab: tab, srv: null }); });
    }));
    ok('S06 staff login: ประวัติ refused in the app · the server refuses the staff token too (owner_only, D-a6-1)',
      s6.role === 'staff' && s6.tab !== 'hist' && s6.srv && s6.srv.error === 'owner_only', JSON.stringify(s6));
    await p.evaluate(() => doLogout()); await p.waitForTimeout(300);

    // ── S07 franchise owner: own Franchise script + own token ──
    await branchLogin('franchise', 'BK-F01', '3691');
    calls.length = 0;
    await loadRange(-3, -1);
    const h7 = await hist(), c7 = calls.filter(c => c.type === 'state_range');
    ok('S07 BK-F01 franchise owner → ประวัติ, 3 days: from the Franchise script with its own token, hero ฿60',
      h7.open && h7.days.join(',') === want9.slice(0, 3).join(',') && h7.hero === '฿60' && c7.length === 1 && c7[0].which === 'franchise' && tokRole(c7[0].t) === 'owner',
      JSON.stringify([h7, c7]));
    await p.evaluate(() => doLogout()); await p.waitForTimeout(300);

    // ── S08 old server (D-b5-3): the previous Access.gs has no state_range → health-check answer → told, nothing breaks ──
    if (!HAVE_OLD) ok('S08 old server (' + OLD_ACCESS + ')', 'SKIP', 'file not found under gs/');
    else {
      S = servers(OLD_ACCESS);
      await p.click('#loginHQ'); await p.waitForTimeout(400);
      await p.fill('#page-hq input', '8642'); await p.click('#page-hq button'); await p.waitForTimeout(700);
      await p.click('#page-hq [data-hqbranch="SBR-01"]'); await p.waitForTimeout(700);
      const before8 = await snap();
      await loadRange(-10, 0);
      const h8 = await hist();
      const after8 = await p.evaluate(() => { go('home'); go('hist'); return { tab: currentTab, cards: document.querySelectorAll('#histContent .day-card').length, btn: !document.getElementById('hcLoad').disabled }; });
      ok('S08 b5 client + OLD server: card says "ยังไม่รองรับ (รออัปเดต)", stays closed, button usable again, device history still renders, nothing written',
        !h8.open && h8.status.indexOf('ยังไม่รองรับ') >= 0 && after8.tab === 'hist' && after8.btn && (await snap()) === before8, JSON.stringify([h8, after8]));
    }
  } catch (e) { ok('S-CRASH stopped', false, String(e && e.message || e).split('\n')[0]); }

  let pass = 0, skip = 0;
  R.forEach(r => { console.log((r[1] === 'SKIP' ? 'SKIP ' : r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[2] && r[1] !== true ? '  [' + r[2] + ']' : '')); if (r[1] === true) pass++; if (r[1] === 'SKIP') skip++; });
  console.log('console errors: ' + errs.length + (errs.length ? '\n  ' + errs.join('\n  ') : ''));
  const all = pass + skip === R.length && !errs.length;
  console.log('RESULT ' + pass + '/' + (R.length - skip) + (skip ? ' (' + skip + ' skipped)' : '') + (all ? ' ALL PASS' : ' — NOT PASSING'));
  await b.close(); srv.close();
  process.exit(all ? 0 : 1);
})();
