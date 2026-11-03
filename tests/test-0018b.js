// test-0018b.js — 0018-b client access. Run from repo root:  node tests/test-0018b.js
// Serves index.html from a local http server (real Date header → clock check passes). Both Apps Script URLs are
// answered by a stub that returns what the audited 0018-a server returns; every request is recorded.
// b1: routing single source · branchInfo from the server · forced re-login once · getRole fail-closed · read token.
// b2: login tabs company / franchise / event · kind sent · franchise code rule + upper-case · one error-text map ·
//     tab + branch restored after logout / reload · recent chips · client code rule = server rule · KYI-07.
// b3: HQ link → HQ mode (dashboard, no branch) · tap a card = branch read-only with the HQ token on the Owner script ·
//     no write leaves the device (sale / fry / gift / delivery / close / email / state) · queue kept · back to HQ ·
//     session expiry · HQ logout · device toggle gone.
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
let hqStates = [], latest = {};   // b3: Owner state_list rows + state_latest answers per branch
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
  else if (body.type === 'hq_auth') ans = body.pin === '8642' ? { ok: true, token: 'HQ-TOK' } : { ok: false, error: 'bad_pin' };
  else if (q.type === 'state_list') ans = { ok: true, states: hqStates };
  else if (q.type === 'state_latest') ans = { ok: true, state: latest[q.branch] || null, date: latest[q.branch] ? latest[q.branch].date : undefined };
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

  // ═══ b3: HQ mode ═══ (a crash inside is reported as one FAIL line, results so far are still printed)
  try {
  const WRITE_TYPES = ['sale', 'fry', 'gift_sale', 'delivery_sale', 'email_report', 'state_save'];
  const writes = () => calls.filter(c => WRITE_TYPES.indexOf(c.type) >= 0).map(c => c.type);
  const view = () => p.evaluate(() => ({
    mode: getDeviceMode(), hq: isHQMode(), br: currentBranch, tab: currentTab, app: document.getElementById('mainApp').style.display,
    tabs: TABS.filter(function (t) { var b = document.getElementById('tab-' + t); return b && b.style.display !== 'none'; }).join(','),
    hdr: document.getElementById('hdrName').textContent + ' | ' + document.getElementById('hdrBranch').textContent,
    back: document.getElementById('hqBackBtn').style.display !== 'none', badge: document.getElementById('deviceModeBadge').textContent,
    pin: !!document.querySelector('#page-hq input'), cards: [].map.call(document.querySelectorAll('#page-hq [data-hqbranch]'), c => c.getAttribute('data-hqbranch')).join(',')
  }));

  // B24 toggle gone: no ✏/👁 row, the old key is ignored, HQ link present
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('puff7_device_mode', 'viewer'); localStorage.setItem('puff8_lastBranch', 'SBR-01'); });
  await p.reload(); await p.waitForTimeout(600);
  const r24 = await p.evaluate(() => ({ row: !!document.getElementById('deviceModeRow'), tog: !!document.getElementById('deviceModeToggle'),
    mode: getDeviceMode(), link: (document.getElementById('loginHQ') || {}).textContent || '',
    fns: ['renderDeviceModeToggle', 'setDeviceMode', 'onDeviceModeToggleClick'].filter(function (f) { return typeof window[f] === 'function'; }).join(',') }));
  const src24 = html.toString();
  ok('B24 device toggle removed: no row / toggle / functions, old puff7_device_mode=viewer ignored (writer), HQ link on login',
    !r24.row && !r24.tog && r24.mode === 'writer' && r24.fns === '' && r24.link.indexOf('HQ') === 0 && src24.indexOf('puff7_device_mode') < 0, JSON.stringify(r24));

  // B25 HQ link → app shell in HQ mode: no branch, HQ tab only, PIN asked, viewer
  hqStates = [
    { branch: 'SBR-01', date: '', label: 'สระบุรี (สาขาหลัก)', totalAmount: 125, soldPieces: 5, frozenPieces: 10, fryPieces: 8, updated_at: 'x' },
    { branch: 'E-691102-K7Q', date: '', label: 'งานวัดพระพุทธบาท', totalAmount: 50, updated_at: 'y' },
    { branch: 'ZZ-01', date: '', label: '', totalAmount: 0, updated_at: 'z' }   // name rule → Franchise; HQ must still read it from Owner
  ];
  const T0 = await p.evaluate(() => todayISO());
  hqStates.forEach(s => { s.date = T0; });
  latest = await p.evaluate(() => {
    var a = newState('SBR-01'); a.date = todayISO(); a.sales = [{ ts: 'x', totalAmount: 125, totalPieces: 5, items: [] }];
    var z = newState('ZZ-01'); z.date = todayISO(); z.sales = [{ ts: 'x', totalAmount: 30, totalPieces: 1, items: [] }];
    return { 'SBR-01': a, 'ZZ-01': z };
  });
  calls.length = 0;
  await p.click('#loginHQ'); await p.waitForTimeout(500);
  const r25 = await view();
  ok('B25 HQ link → app in HQ mode: viewer, no branch, HQ tab only, PIN page, header "HQ … ภาพรวมทุกสาขา", badge, no back button',
    r25.hq && r25.mode === 'viewer' && r25.br === '' && r25.tab === 'hq' && r25.app === 'block' && r25.tabs === 'hq' && r25.pin &&
    r25.hdr.indexOf('HQ') === 0 && r25.hdr.indexOf('ภาพรวมทุกสาขา') > 0 && !r25.back && r25.badge.indexOf('HQ') > 0, JSON.stringify(r25));

  // B26 HQ PIN → hq_auth on Owner → dashboard (state_list with the HQ token), one tappable card per branch with its label
  await p.fill('#page-hq input', '1111'); await p.click('#page-hq button'); await p.waitForTimeout(400);
  const bad26 = await p.evaluate(() => ({ s: localStorage.getItem('puff10_hqSession'), t: document.getElementById('toast').textContent }));
  await p.fill('#page-hq input', '8642'); await p.click('#page-hq button'); await p.waitForTimeout(700);
  const r26 = await view();
  const list26 = calls.filter(c => c.type === 'state_list')[0] || {};
  const lbl26 = await p.evaluate(() => [].map.call(document.querySelectorAll('#page-hq [data-hqbranch]'), c => c.textContent).join(' || '));
  ok('B26 wrong HQ PIN refused; right PIN → hq_auth (Owner) → state_list with the HQ token → 3 tappable cards with labels',
    !bad26.s && bad26.t === 'PIN ไม่ถูกต้อง' && calls.filter(c => c.type === 'hq_auth' && c.which === 'owner').length === 2 && list26.which === 'owner' && list26.t === 'HQ-TOK' &&
    r26.cards === 'E-691102-K7Q,SBR-01,ZZ-01' && lbl26.indexOf('สระบุรี (สาขาหลัก) · SBR-01') >= 0 && lbl26.indexOf('งานวัดพระพุทธบาท · E-691102-K7Q') >= 0, JSON.stringify([bad26, r26.cards, lbl26.slice(0, 120)]));

  // B41 fry row on the card: fried + still at the counter (fried − sold), shown first
  const r41 = await p.evaluate(() => {
    var c = document.querySelector('#page-hq [data-hqbranch="SBR-01"]'), f = c ? c.querySelector('.hq-fry') : null;
    return { fry: f ? f.textContent : '', first: !!(f && c.textContent.indexOf(f.textContent) < c.textContent.indexOf('ยอด ฿')) };
  });
  ok('B41 HQ card: big fry row "8 ชิ้น 🔥 ทอด" + "3 ชิ้น เหลือหน้าร้าน" (8 − 5) before the money boxes',
    r41.fry.indexOf('8 ชิ้น🔥 ทอด') === 0 && r41.fry.indexOf('3 ชิ้นเหลือหน้าร้าน') > 0 && r41.first, JSON.stringify(r41));

  // B27 tap a card → that branch read-only: cloud copy shown, read = Owner + HQ token, tabs + back button
  await p.evaluate(() => { var t = getTokens(); t['SBR-01'] = { token: 'BR-OWNER', role: 'owner', ts: 1 }; saveTokens(t); });   // this device also holds an OWNER token of SBR-01
  calls.length = 0;
  await p.click('#page-hq [data-hqbranch="SBR-01"]'); await p.waitForTimeout(700);
  const r27 = await view();
  const rd27 = calls.filter(c => c.type === 'state_latest')[0] || {};
  const st27 = await p.evaluate(() => ({ sales: S && S.sales ? S.sales.length : -1, role: getRole(), hero: document.getElementById('homeSalesCard').textContent.indexOf('125') >= 0 }));
  ok('B27 card → SBR-01 read-only: tabs + HQ tab + "← กลับ HQ", header label, cloud copy (125) shown, read sent to Owner with the HQ token',
    r27.br === 'SBR-01' && r27.mode === 'viewer' && r27.tab === 'home' && r27.tabs === 'home,sell,fry,stock,close,hist,hq' && r27.back &&
    r27.hdr.indexOf('สระบุรี (สาขาหลัก)') > 0 && rd27.which === 'owner' && rd27.t === 'HQ-TOK' && st27.sales === 1 && st27.hero, JSON.stringify([r27, rd27, st27]));
  ok('B28 HQ never takes the branch token role (device holds an OWNER token of SBR-01 → role staff in HQ)', st27.role === 'staff', st27.role);

  // B40 D-b3-2: ขาย / ทอด dimmed + not tappable while HQ views a branch; other tabs normal; no sell bar
  const r40 = await p.evaluate(() => {
    var dimTabs = TABS.filter(function (t) { return document.getElementById('tab-' + t).classList.contains('hq-dim'); }).join(',');
    var dimPages = [].map.call(document.querySelectorAll('.page.hq-dim'), function (x) { return x.id; }).join(',');
    go('sell');
    var pg = document.getElementById('page-sell'), kid = pg.firstElementChild;
    var o = { dimTabs: dimTabs, dimPages: dimPages, tab: currentTab, op: getComputedStyle(pg).opacity, pe: kid ? getComputedStyle(kid).pointerEvents : '',
      bar: getComputedStyle(document.getElementById('sellBar')).display, tabOp: getComputedStyle(document.getElementById('tab-fry')).opacity };
    go('home');
    return o;
  });
  ok('B40 HQ branch view: tabs + pages ขาย / ทอด dimmed (opacity < 1), page content not tappable, still openable, no sell bar; other tabs normal',
    r40.dimTabs === 'sell,fry' && r40.dimPages === 'page-sell,page-fry' && r40.tab === 'sell' && Number(r40.op) < 1 && Number(r40.tabOp) < 1 && r40.pe === 'none' && r40.bar === 'none', JSON.stringify(r40));

  // B29 nothing leaves the device and nothing is saved: every write path refused
  calls.length = 0;
  const r29 = await p.evaluate(() => {
    var key = stateKey('SBR-01', S.date), before = localStorage.getItem(key), q0 = localStorage.getItem('puff10_syncQueue');
    var toasts = {}, tEl = document.getElementById('toast');
    window.confirm = function () { return true; };
    sq[F[0].id] = 2;                                              // something in the sell cart
    var fns = { submitSell: submitSell, saveFry: saveFry, saveDelivery: saveDelivery, submitGiftSale: submitGiftSale, saveReceive: saveReceive,
      saveGiftReceive: saveGiftReceive, addWithdraw: addWithdraw, sendEmail: sendEmail, confirmCloseDay: confirmCloseDay };
    Object.keys(fns).forEach(function (n) { tEl.textContent = ''; try { fns[n](); } catch (e) { toasts[n] = 'THREW ' + e.message; return; } toasts[n] = tEl.textContent; });
    S.cash = { cash: 999 }; save();                               // keystroke-type save (cash / counts / withdrawals)
    return { same: localStorage.getItem(key) === before, q: localStorage.getItem('puff10_syncQueue') === q0, closed: !!S.is_closed, wd: (S.withdrawals || []).length, toasts: toasts };
  });
  await p.waitForTimeout(500);
  const notHQ29 = Object.keys(r29.toasts).filter(n => r29.toasts[n].indexOf('HQ ดูอย่างเดียว') < 0);
  ok('B29 HQ drill-down: sale / fry / delivery / gift / receive / gift receive / withdraw / email / close / save → no write request, local day unchanged, not closed, each one says "HQ ดูอย่างเดียว"',
    writes().length === 0 && r29.same && r29.q && !r29.closed && r29.wd === 0 && Object.keys(r29.toasts).length === 9 && notHQ29.length === 0, JSON.stringify([writes(), notHQ29, r29.same, r29.q, r29.closed, r29.wd]));

  // B30 owner-only controls hidden; HQ may open history + export (D-b-4); price / stock correct / gift catalog refused
  const r30 = await p.evaluate(() => {
    applyRoleUI();
    var o = { exp: document.getElementById('exportBlock').style.display !== 'none', corr: document.getElementById('btnStockCorrect').style.display === 'none',
      gift: document.getElementById('btnAddGift').style.display === 'none', can: ['hist', 'export', 'price', 'stockCorrect', 'giftCatalog'].map(function (a) { return a + ':' + canDo(a); }).join(',') };
    go('hist'); o.hist = currentTab === 'hist';
    go('close'); o.settings = document.getElementById('ownerSettings') ? document.getElementById('ownerSettings').children.length : 0;
    showAddGiftModal(); o.giftToast = document.getElementById('toast').textContent;
    return o;
  });
  ok('B30 HQ: history + export allowed · price / stock correct / gift catalog / owner settings refused or hidden',
    r30.exp && r30.corr && r30.gift && r30.hist && r30.settings === 0 && r30.can === 'hist:true,export:true,price:false,stockCorrect:false,giftCatalog:false' &&
    r30.giftToast.indexOf('HQ ดูอย่างเดียว') >= 0, JSON.stringify(r30));

  // B31 "← กลับ HQ" → dashboard again, branch closed, branch tabs hidden, branch pages unreachable
  await p.click('#hqBackBtn'); await p.waitForTimeout(600);
  const r31 = await view();
  const go31 = await p.evaluate(() => { go('home'); go('sell'); return currentTab; });
  ok('B31 "← กลับ HQ" → dashboard: no branch, HQ tab only, cards again, back button hidden; go(home) / go(sell) ignored',
    r31.br === '' && r31.tab === 'hq' && r31.tabs === 'hq' && !r31.back && r31.cards.split(',').length === 3 && go31 === 'hq', JSON.stringify([r31, go31]));

  // B39 event card: the header name can only come from the dashboard label (no branch info on this device, not a company)
  await p.click('#page-hq [data-hqbranch="E-691102-K7Q"]'); await p.waitForTimeout(600);
  const r39 = await p.evaluate(() => ({ info: getBranchInfo('E-691102-K7Q'), hdr: document.getElementById('hdrBranch').textContent }));
  await p.click('#hqBackBtn'); await p.waitForTimeout(500);
  ok('B39 event opened from HQ → header shows the server label from the dashboard (งานวัดพระพุทธบาท)', !r39.info && r39.hdr === 'งานวัดพระพุทธบาท', JSON.stringify(r39));

  // B32 a franchise-looking name on the Owner dashboard is still read from Owner with the HQ token (readURLFor)
  calls.length = 0;
  await p.click('#page-hq [data-hqbranch="ZZ-01"]'); await p.waitForTimeout(700);
  const rd32 = calls.filter(c => c.type === 'state_latest')[0] || {};
  const r32 = await p.evaluate(() => ({ route: routeURL('ZZ-01') === FRANCHISE_URL, sales: S && S.sales ? S.sales.length : -1, hdr: document.getElementById('hdrBranch').textContent }));
  ok('B32 ZZ-01 (name rule = Franchise) → read goes to Owner with the HQ token; header falls back to the code',
    r32.route && rd32.which === 'owner' && rd32.t === 'HQ-TOK' && r32.sales === 1 && r32.hdr === 'ZZ-01', JSON.stringify([rd32, r32]));

  // B33 HQ session runs out while a branch is open → next tab tap goes back to the HQ PIN
  await p.evaluate(() => { localStorage.setItem('puff10_hqSession', String(Date.now() - 9 * 3600 * 1000)); go('stock'); });
  await p.waitForTimeout(400);
  const r33 = await view();
  ok('B33 HQ session older than 8 h → tab tap returns to the HQ PIN (no branch open), still viewer',
    r33.br === '' && r33.tab === 'hq' && r33.pin && r33.mode === 'viewer' && r33.tabs === 'hq', JSON.stringify(r33));

  // B34 HQ never touches the sync queue + never overwrites a day this device still has to send
  await p.fill('#page-hq input', '8642'); await p.click('#page-hq button'); await p.waitForTimeout(700);
  const mine = await p.evaluate(() => {
    var own = newState('SBR-01'); own.date = todayISO(); own.sales = [{ ts: 'mine', totalAmount: 999, totalPieces: 9, items: [] }];
    localStorage.setItem(stateKey('SBR-01', own.date), JSON.stringify(own));
    localStorage.setItem('puff10_syncQueue', JSON.stringify([{ branch: 'SBR-01', date: own.date, state: own, ts: 1 }]));
    return own.date;
  });
  calls.length = 0;
  await p.evaluate(() => { flushSyncQueue(); window.dispatchEvent(new Event('online')); });
  await p.click('#page-hq [data-hqbranch="SBR-01"]'); await p.waitForTimeout(700);
  const r34 = await p.evaluate(d => ({ q: JSON.parse(localStorage.getItem('puff10_syncQueue') || '[]').length,
    local: JSON.parse(localStorage.getItem(stateKey('SBR-01', d))).sales[0].ts, shown: S.sales[0].ts }), mine);
  ok('B34 HQ: queued item kept (flush + online do nothing, no state_save) · own unsent day not overwritten by the cloud copy',
    r34.q === 1 && writes().length === 0 && r34.local === 'mine' && r34.shown === 'mine', JSON.stringify([writes(), r34]));

  // B35 HQ logout → login screen; HQ flag + HQ session gone, this device's branch session kept, form back on its branch
  await p.evaluate(() => {
    localStorage.setItem('puff10_branchAuth', JSON.stringify({ branch: 'SBR-01', ts: 1 })); setToken('SBR-01', 'TOK-SBR', 'staff');
    document.getElementById('loginBranchSel').value = ''; document.getElementById('loginFreeInput').value = '';   // only the restore may fill the form
  });
  await p.evaluate(() => doLogout()); await p.waitForTimeout(300);
  const r35 = await p.evaluate(() => ({ hq: isHQMode(), s: localStorage.getItem('puff10_hqSession'), t: localStorage.getItem('puff10_hqToken'),
    ba: !!localStorage.getItem('puff10_branchAuth'), login: document.getElementById('loginScreen').style.display, sel: document.getElementById('loginBranchSel').value, br: _loginBranch, badge: getComputedStyle(document.getElementById('deviceModeBadge')).display }));
  calls.length = 0;
  await login('SBR-01', '');
  const r35b = await view();
  await p.waitForTimeout(600);
  ok('B35 HQ logout: HQ mode + session cleared, branch session kept, form on SBR-01 → branch login is a writer again (HQ tab hidden, queued item sent)',
    !r35.hq && !r35.s && !r35.t && r35.ba && r35.login === 'flex' && r35.sel === 'SBR-01' && r35.br === 'SBR-01' && r35.badge === 'none' &&
    r35b.mode === 'writer' && r35b.tabs === 'home,sell,fry,stock,close,hist' && writes().indexOf('state_save') >= 0, JSON.stringify([r35, r35b.tabs, writes()]));
  // contract: outside HQ the tab function never dims (called directly — today nothing else calls it while a branch is open)
  const r42 = await p.evaluate(() => { applyHQTabVisibility(); go('sell'); return { dim: document.querySelectorAll('.hq-dim').length, bar: getComputedStyle(document.getElementById('sellBar')).display }; });
  ok('B42 normal branch login after HQ: nothing dimmed, sell bar back', r42.dim === 0 && r42.bar !== 'none', JSON.stringify(r42));
  await p.evaluate(() => go('home'));
  const g35 = await p.evaluate(() => { go('hq'); return currentTab + ' | ' + document.getElementById('toast').textContent; });
  ok('B36 outside HQ mode the HQ tab is unreachable', g35.indexOf('hq') !== 0 && g35.indexOf('สำหรับ HQ') > 0, g35);

  // B37 reload while in HQ → opens on the login screen (never in HQ); the HQ link asks the PIN again (D-b3-1)
  await p.evaluate(() => doLogout());
  await p.click('#loginHQ'); await p.waitForTimeout(300);
  await p.fill('#page-hq input', '8642'); await p.click('#page-hq button'); await p.waitForTimeout(500);
  await p.reload(); await p.waitForTimeout(600);
  const r37 = await p.evaluate(() => ({ hq: isHQMode(), login: document.getElementById('loginScreen').style.display, mode: getDeviceMode(), s: !!localStorage.getItem('puff10_hqSession') }));
  calls.length = 0;
  await p.click('#loginHQ'); await p.waitForTimeout(700);
  const r37b = await view();
  ok('B37 reload in HQ → login screen, writer · HQ link again → PIN asked again, old HQ session dropped (D-b3-1), no data loaded',
    !r37.hq && r37.login !== 'none' && r37.mode === 'writer' && r37.s && r37b.hq && r37b.pin && r37b.cards === '' &&
    calls.filter(c => c.type === 'state_list').length === 0 && await p.evaluate(() => !localStorage.getItem('puff10_hqSession')), JSON.stringify([r37, r37b]));

  // B38 fail closed: HQ flag cannot be stored (storage full) → stays on the login screen, never an HQ shell that writes
  await p.evaluate(() => doLogout());
  const r38 = await p.evaluate(() => {
    var orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'puff10_hqMode') throw new Error('QuotaExceededError'); return orig.call(this, k, v); };
    try { openHQ(); } finally { Storage.prototype.setItem = orig; }
    return { hq: isHQMode(), app: document.getElementById('mainApp').style.display, toast: document.getElementById('toast').textContent };
  });
  ok('B38 HQ flag not storable → refused with a toast, login screen stays', !r38.hq && r38.app !== 'block' && r38.toast.indexOf('เข้าโหมด HQ ไม่ได้') > 0, JSON.stringify(r38));
  } catch (e) { ok('B3-CRASH b3 block stopped', false, String(e && e.message || e).split('\n')[0]); }

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
