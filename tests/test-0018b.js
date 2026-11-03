// test-0018b.js — 0018-b client access. Run from repo root:  node tests/test-0018b.js
// Serves index.html from a local http server (real Date header → clock check passes). Both Apps Script URLs are
// answered by a stub that returns what the audited 0018-a server returns; every request is recorded.
// b1: routing single source · branchInfo from the server · forced re-login once · getRole fail-closed · read token.
// b2: login tabs company / franchise / event · kind sent · franchise code rule + upper-case · one error-text map ·
//     tab + branch restored after logout / reload · recent chips · client code rule = server rule · KYI-07.
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require('playwright');

const html = fs.readFileSync(path.resolve('index.html'));
const OWNER = (/var OWNER_URL = "([^"]+)"/.exec(html.toString()) || [])[1];
const FRAN = (/var FRANCHISE_URL = "([^"]+)"/.exec(html.toString()) || [])[1];
const srv = http.createServer((req, res) => {
  res.setHeader('Date', new Date().toUTCString());
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(req.method === 'HEAD' ? '' : html);
});

// Stub server: answers per request type; `auth` can be overridden per test.
const calls = [];
let authAnswer = () => ({ ok: true, role: 'staff', token: 'TOK-STAFF', type: 'company', label: 'สระบุรี (สาขาหลัก)' });
function stub(route) {
  const req = route.request(), url = req.url();
  const which = url.indexOf(OWNER) === 0 ? 'owner' : url.indexOf(FRAN) === 0 ? 'franchise' : 'other';
  let body = {};
  try { body = JSON.parse(req.postData() || '{}'); } catch (e) { }
  const q = Object.fromEntries(new URL(url).searchParams);
  calls.push({ which, method: req.method(), type: body.type || q.type, branch: body.branch || q.branch, kind: body.kind, t: q.t, token: body.token });
  let ans = { ok: true };
  if (body.type === 'branch_auth') ans = authAnswer(body, which);
  else if (q.type === 'state_latest') ans = { ok: true, state: null };
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(ans) });
}

(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  let b;
  try { b = await chromium.launch({ channel: 'chrome' }); } catch (e) { b = await chromium.launch(); }
  const p = await b.newPage();
  p.setDefaultTimeout(8000);   // a missing element fails fast instead of hanging 30 s
  const errs = [], R = [];
  const ok = (id, cond, info) => R.push([id, !!cond, info === undefined ? '' : String(info)]);
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.route('**/*', route => {   // Apps Script → stub · local page → real server · anything else (fonts, CDN) → empty 204
    const u = route.request().url();
    if (u.indexOf('https://script.google.com/') === 0) return stub(route);
    if (u.indexOf(base) === 0) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  p.on('dialog', d => d.accept());

  // Real UI path: fill the staff fields, tap the tab, pick / type the branch, tap เริ่มใช้งาน.
  async function fillForm(branch, pin, tab) {
    await p.fill('#loginName', 'Test Tester'); await p.fill('#loginNick', 'T'); await p.fill('#loginPhone', '0800000000');
    const isCo = await p.evaluate(br => BRANCH_CODES.some(function (x) { return x.code === br; }), branch);
    tab = tab || (isCo ? 'company' : 'franchise');
    await p.click('#loginTabs [data-tab="' + tab + '"]');
    if (tab === 'company') await p.selectOption('#loginBranchSel', branch);
    else if (tab === 'franchise') await p.fill('#loginFreeInput', branch);
    await p.fill('#loginPinInput', pin || '');
  }
  async function login(branch, pin, tab) {
    await fillForm(branch, pin, tab);
    await p.click('#loginBtn');
    await p.waitForFunction(() => document.getElementById('mainApp').style.display === 'block', null, { timeout: 8000 }).catch(() => { });
    await p.waitForTimeout(400);
  }
  const shown = () => p.evaluate(() => document.getElementById('mainApp').style.display === 'block');

  // ─── B01 routing: one rule, server type first, v9 name rule only without a type ───
  await p.goto(base); await p.waitForTimeout(600);
  const r1 = await p.evaluate(([O, F]) => {
    localStorage.removeItem('puff10_branchInfo');
    var out = {
      unknownE: routeURL('Ekamai') === O, unknownFr: routeURL('FR-01') === F, preset: routeURL('SBR-01') === O
    };
    setBranchInfo('Ekamai', 'franchise', 'ร้าน Ekamai');      // B1 victim: franchise whose name starts with E
    setBranchInfo('XYZ-01', 'company', 'X');
    setBranchInfo('E-691102-K7Q', 'event', 'งานวัด');
    out.typedFr = routeURL('Ekamai') === F; out.typedCo = routeURL('XYZ-01') === O; out.typedEv = routeURL('E-691102-K7Q') === O;
    out.same = ['Ekamai', 'XYZ-01', 'FR-01', 'SBR-01'].every(function (b) { currentBranch = b; return getSheetURL() === getSyncURL(b); });
    currentBranch = '';
    return out;
  }, [OWNER, FRAN]);
  ok('B01 no type → v9 name rule (E… / preset → Owner, else Franchise)', r1.unknownE && r1.unknownFr && r1.preset, JSON.stringify(r1));
  ok('B02 server type wins over the name (franchise "Ekamai" → Franchise · company / event → Owner)', r1.typedFr && r1.typedCo && r1.typedEv, JSON.stringify(r1));
  ok('B03 getSheetURL() ≡ getSyncURL(branch) for every branch', r1.same);

  // ─── B04 forced re-login once: v8-era session (owner token, no authv) is dropped, queue kept ───
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('puff10_tokens', JSON.stringify({ 'SBR-01': { token: 'OLD-V8', role: 'owner', ts: 1 } }));
    localStorage.setItem('puff10_branchAuth', JSON.stringify({ branch: 'SBR-01', ts: 1 }));
    localStorage.setItem('puff10_syncQueue', JSON.stringify([{ branch: 'SBR-01', date: '01/11/2569', state: { sales: [{ totalAmount: 25 }] } }]));
    localStorage.setItem('puff8_lastBranch', 'SBR-01');
  });
  await p.reload(); await p.waitForTimeout(600);
  const r4 = await p.evaluate(() => ({ tok: localStorage.getItem('puff10_tokens'), auth: localStorage.getItem('puff10_branchAuth'),
    v: localStorage.getItem('puff10_authv'), q: JSON.parse(localStorage.getItem('puff10_syncQueue') || '[]').length }));
  ok('B04 boot without authv drops tokens + branchAuth, sets authv=2, keeps the sync queue', !r4.tok && !r4.auth && r4.v === '2' && r4.q === 1, JSON.stringify(r4));
  calls.length = 0;
  await login('SBR-01', '4417');
  const auth4 = calls.filter(c => c.type === 'branch_auth');
  ok('B05 next login asks the server (PIN), lands in the app', auth4.length === 1 && await shown(), auth4.length);
  const sync4 = calls.filter(c => c.type === 'state_save');
  ok('B06 queued item flushed after login, with the NEW token', sync4.length >= 1 && sync4[0].token === 'TOK-STAFF', JSON.stringify(sync4[0] || {}));
  await p.reload(); await p.waitForTimeout(600);          // app closed + reopened (no logout — logout always asks again)
  calls.length = 0;
  const kept = await p.evaluate(() => getTokenFor('SBR-01'));
  await login('SBR-01', '');
  ok('B07 reopen with authv=2: token kept, re-entry without the server (migration runs once)', kept === 'TOK-STAFF' && calls.filter(c => c.type === 'branch_auth').length === 0 && await shown(), kept);

  // ─── B08 role fail-closed ───
  const r8 = await p.evaluate(() => {
    var o = {};
    o.staffTok = getRole();                                   // logged in with a staff token
    var t = getTokens(); delete t['SBR-01']; saveTokens(t);
    o.none = getRole(); applyRoleUI();
    o.btnHidden = (document.getElementById('btnStockCorrect') || { style: { display: 'none' } }).style.display === 'none';
    setToken('SBR-01', 'X', 'owner'); o.owner = getRole();
    var t2 = getTokens(); t2['SBR-01'] = { token: 'X', role: 'weird' }; saveTokens(t2); o.weird = getRole();
    setToken('SBR-01', 'TOK-STAFF', 'staff');
    return o;
  });
  ok('B08 role: staff token → staff · no token → staff (owner buttons hidden) · owner → owner · unknown role → staff',
    r8.staffTok === 'staff' && r8.none === 'staff' && r8.btnHidden && r8.owner === 'owner' && r8.weird === 'staff', JSON.stringify(r8));

  // ─── B09 server label/type stored at login → header + routing; v8 answer (no type) stores nothing ───
  await p.evaluate(() => doLogout());
  authAnswer = (body) => body.branch === 'FR-07'
    ? { ok: true, role: 'owner', token: 'TOK-FR', type: 'franchise', label: 'ร้านป้าแดง' }
    : { ok: true, role: 'staff', token: 'TOK-V8' };   // v8 server: no type / label
  calls.length = 0;
  await login('FR-07', '2580');
  const r9 = await p.evaluate(() => ({ info: getBranchInfo('FR-07'), hdr: document.getElementById('hdrBranch').textContent, url: getSheetURL() === FRANCHISE_URL }));
  ok('B09 login stores {type,label} from the server; header shows the label; routes to Franchise',
    r9.info && r9.info.type === 'franchise' && r9.info.label === 'ร้านป้าแดง' && r9.hdr.indexOf('ร้านป้าแดง') === 0 && r9.url, JSON.stringify(r9));
  const read9 = calls.filter(c => c.type === 'state_latest');
  ok('B10 cloud read sends the branch token (readTokenFor) to the routed Sheet', read9.length >= 1 && read9[0].t === 'TOK-FR' && read9[0].which === 'franchise', JSON.stringify(read9[0] || {}));
  await p.evaluate(() => doLogout());
  await login('ZZ-99', '1111');
  const r11 = await p.evaluate(() => ({ info: getBranchInfo('ZZ-99'), hdr: document.getElementById('hdrBranch').textContent, url: routeURL('ZZ-99') === FRANCHISE_URL }));
  ok('B11 answer without type (v8 server): the TAB is stored as the type (b2); header falls back to the code',
    r11.info && r11.info.type === 'franchise' && r11.info.label === 'ZZ-99' && r11.url && r11.hdr.indexOf('ZZ-99') === 0, JSON.stringify(r11));
  await p.evaluate(() => doLogout());

  // ─── b2: login tabs ───
  const tabsOf = () => p.evaluate(() => ({
    active: [].map.call(document.querySelectorAll('#loginTabs .lt-tab.active'), b => b.getAttribute('data-tab')).join(','),
    aria: [].map.call(document.querySelectorAll('#loginTabs .lt-tab'), b => b.getAttribute('aria-selected')).join(','),
    panes: [].map.call(document.querySelectorAll('.lt-pane'), x => x.getAttribute('data-ltpane') + ':' + (getComputedStyle(x).display !== 'none')).join(','),
    saved: localStorage.getItem('puff10_loginTab'), btn: document.getElementById('loginBtn').disabled, branch: _loginBranch
  }));
  await p.fill('#loginName', 'Test Tester'); await p.fill('#loginNick', 'T'); await p.fill('#loginPhone', '0800000000');
  await p.click('#loginTabs [data-tab="franchise"]');
  const t14a = await tabsOf();
  await p.click('#loginTabs [data-tab="event"]');
  const t14b = await tabsOf();
  ok('B14 tab bar: tap switches the pane + aria + remembered tab; Event tab = placeholder, start button disabled',
    t14a.active === 'franchise' && t14a.aria === 'false,true,false' && t14a.panes === 'company:false,franchise:true,event:false' && t14a.saved === 'franchise' &&
    t14b.active === 'event' && t14b.btn === true && t14b.branch === '', JSON.stringify([t14a, t14b]));

  authAnswer = (body) => ({ ok: true, role: 'staff', token: 'TOK-' + body.branch, type: body.kind, label: body.kind === 'company' ? 'สระบุรี (สาขาหลัก)' : 'ร้านทดสอบ' });
  calls.length = 0;
  await login('SBR-01', '4417');
  const c15 = calls.filter(c => c.type === 'branch_auth')[0] || {};
  ok('B15 company tab → branch_auth to the Owner script with kind=company', c15.which === 'owner' && c15.kind === 'company' && c15.branch === 'SBR-01', JSON.stringify(c15));
  await p.evaluate(() => doLogout());

  await p.click('#loginTabs [data-tab="franchise"]');
  await p.fill('#loginFreeInput', 'CM-PTT01');
  const bad16 = await p.evaluate(() => ({ b: _loginBranch, note: document.getElementById('loginFreeNote').classList.contains('show'), btn: document.getElementById('loginBtn').disabled }));
  await p.fill('#loginFreeInput', ' bk-f01 ');
  const good16 = await p.evaluate(() => ({ b: _loginBranch, note: document.getElementById('loginFreeNote').classList.contains('show'), btn: document.getElementById('loginBtn').disabled,
    upper: getComputedStyle(document.getElementById('loginFreeInput')).textTransform }));
  calls.length = 0;
  await login('bk-f01', '2580', 'franchise');
  const c16 = calls.filter(c => c.type === 'branch_auth')[0] || {};
  ok('B16 franchise code: wrong format → hint + button off; " bk-f01 " → BK-F01, upper-case shown, button on',
    bad16.b === '' && bad16.note && bad16.btn && good16.b === 'BK-F01' && !good16.note && !good16.btn && good16.upper === 'uppercase', JSON.stringify([bad16, good16]));
  ok('B17 franchise tab → branch_auth to the Franchise script, kind=franchise, code normalised; current branch = BK-F01',
    c16.which === 'franchise' && c16.kind === 'franchise' && c16.branch === 'BK-F01' && await p.evaluate(() => currentBranch === 'BK-F01'), JSON.stringify(c16));

  // B18 restore after logout + after reload
  await p.evaluate(() => doLogout());
  const r18a = await p.evaluate(() => ({ tab: _loginTab, v: document.getElementById('loginFreeInput').value, b: _loginBranch, btn: !document.getElementById('loginBtn').disabled }));
  await p.reload(); await p.waitForTimeout(600);
  const r18b = await p.evaluate(() => ({ tab: _loginTab, v: document.getElementById('loginFreeInput').value, b: _loginBranch }));
  await login('SBR-01', '');
  await p.evaluate(() => doLogout());
  const r18c = await p.evaluate(() => ({ tab: _loginTab, v: document.getElementById('loginBranchSel').value, b: _loginBranch, btn: !document.getElementById('loginBtn').disabled }));
  ok('B18 last tab + branch come back after logout and after reload (franchise BK-F01 · company SBR-01) — start button ready, no typing',
    r18a.tab === 'franchise' && r18a.b === 'BK-F01' && r18a.btn && r18c.btn && r18b.tab === 'franchise' && r18b.b === 'BK-F01' && r18c.tab === 'company' && r18c.v === 'SBR-01' && r18c.b === 'SBR-01',
    JSON.stringify([r18a, r18b, r18c]));

  // B19 recent chips: franchise codes only, old pre-0018 codes hidden
  await p.evaluate(() => { localStorage.setItem('puff10_recentBranches', JSON.stringify(['BK-F01', 'CM-PTT01', 'SBR-01x'])); });
  await p.click('#loginTabs [data-tab="franchise"]');
  const chips = await p.evaluate(() => [].map.call(document.querySelectorAll('#loginRecentChips .lf-chip span'), s => s.textContent).join(','));
  await p.click('#loginRecentChips .lf-chip');
  const chipFill = await p.evaluate(() => _loginBranch);
  ok('B19 recent chips show valid franchise codes only; tap fills the code', chips === 'BK-F01' && chipFill === 'BK-F01', chips + ' / ' + chipFill);

  // B20 server error codes → one Thai text map; stays on the login screen
  const errs20 = {};
  for (const code of ['not_found', 'pending', 'bad_pin', 'locked_out', 'ended', '']) {
    authAnswer = () => (code ? { ok: false, error: code } : { ok: false });
    await p.evaluate(() => { localStorage.removeItem('puff10_branchAuth'); document.getElementById('toast').textContent = ''; });
    await fillForm('MVK-03', code === '' ? '' : '9999');
    await p.click('#loginBtn'); await p.waitForTimeout(500);
    errs20[code || 'none'] = await p.evaluate(() => document.getElementById('toast').textContent + (document.getElementById('mainApp').style.display === 'block' ? ' [ENTERED]' : ''));
  }
  ok('B20 error codes → Thai text (not_found / pending / bad_pin / locked_out / ended / no code without PIN), never enters the app',
    errs20.not_found.indexOf('ไม่พบสาขานี้') === 0 && errs20.pending.indexOf('ยังไม่เปิดใช้งาน') > 0 && errs20.bad_pin === 'รหัสไม่ถูกต้อง' &&
    errs20.locked_out.indexOf('รอ 10 นาที') > 0 && errs20.ended.indexOf('งานนี้ปิดแล้ว') === 0 && errs20.none === 'สาขานี้ต้องใส่รหัส', JSON.stringify(errs20));

  // B21 client code rule = server rule (gs/Access.gs in the repo) · B22 KYI-07 in the company list
  let srvRe = null;
  try { srvRe = (/var BRANCH_CODE_RE = (\/[^\n]+\/);/.exec(fs.readFileSync(path.resolve('gs', 'Access.gs'), 'utf8')) || [])[1]; } catch (e) { srvRe = null; }
  const cliRe = await p.evaluate(() => String(BRANCH_CODE_RE));
  ok('B21 client BRANCH_CODE_RE == server BRANCH_CODE_RE (gs/Access.gs)', srvRe && srvRe === cliRe, cliRe + ' vs ' + srvRe);
  const kyi = await p.evaluate(() => [].map.call(document.querySelectorAll('#loginBranchSel option'), o => o.value + '|' + o.textContent).filter(s => s.indexOf('KYI-07') === 0).join(''));
  ok('B22 company list has KYI-07 เขาใหญ่ (หน้าร้าน Le Charm)', kyi === 'KYI-07|KYI-07 · เขาใหญ่ (หน้าร้าน Le Charm)', kyi);

  // B23 new device / no remembered branch: the last tapped tab still comes back after reload
  await p.evaluate(() => { localStorage.removeItem('puff8_lastBranch'); localStorage.setItem('puff10_loginTab', 'franchise'); });
  await p.reload(); await p.waitForTimeout(600);
  const r23 = await p.evaluate(() => ({ tab: _loginTab, b: _loginBranch, v: document.getElementById('loginFreeInput').value }));
  ok('B23 no remembered branch → saved tab (franchise) is shown, nothing pre-filled', r23.tab === 'franchise' && r23.b === '' && r23.v === '', JSON.stringify(r23));

  // ─── B12 static rules on the lines this build added ───
  let added = '';
  const baseRef = process.env.BASE_REF || 'main';   // live 0017 = main; 0018 work sits on local branch b0018
  try { added = require('child_process').execSync('git diff -U0 ' + baseRef + ' -- index.html', { encoding: 'utf8' }).split('\n').filter(l => l[0] === '+' && l.slice(0, 3) !== '+++').join('\n'); } catch (e) { added = ''; }
  const bad = added.split('\n').filter(l => /\blet |\bconst |=>|`|innerHTML/.test(l));
  ok('B12 added lines: no let / const / arrow / template literal / innerHTML', added.length > 0 && bad.length === 0, bad.join(' | ') || (added ? '' : 'no diff vs ' + baseRef));

  // ─── B13 node --check on every inline <script> of index.html ───
  const os = require('os'), cp = require('child_process');
  const scripts = (html.toString().match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/g) || []).map(s => s.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
  const chk = scripts.map((s, i) => { const f = path.join(os.tmpdir(), 'puff-0018b-s' + i + '.js'); fs.writeFileSync(f, s); const r = cp.spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }); return r.status === 0 ? '' : r.stderr.split('\n').slice(0, 4).join(' '); });
  ok('B13 node --check on ' + scripts.length + ' inline script(s)', scripts.length > 0 && chk.every(x => !x), chk.filter(Boolean).join(' | '));

  let pass = 0;
  R.forEach(r => { console.log((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[2] && !r[1] ? '  [' + r[2] + ']' : '')); if (r[1]) pass++; });
  console.log('console errors: ' + errs.length + (errs.length ? '\n  ' + errs.join('\n  ') : ''));
  console.log('RESULT ' + pass + '/' + R.length + (pass === R.length && !errs.length ? ' ALL PASS' : ' — NOT PASSING'));
  await b.close(); srv.close();
  process.exit(pass === R.length && !errs.length ? 0 : 1);
})();
