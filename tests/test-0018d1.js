// test-0018d1.js — 0018-d1 client: Event tab (list + join), D-ev-3 confirm, D-ev-4 resume, back-date bound by start, ended in the queue.
// Runs the app against the REAL server code (gs/Code-owner.gs + gs/Access.gs in gs/test/gas-stub.js), ENFORCE_TOKEN + REQUIRE_PIN on.
// Run from repo root:  node tests/test-0018d1.js
//   PUFF_HTML = app file to test (default index.html) · D1_BASE = git ref for the static checks (default bcde2b2 = c3)
const path = require('path'), fs = require('fs'), http = require('http'), cp = require('child_process');
const { chromium } = require('playwright');
const { makeEnv } = require(path.resolve('gs', 'test', 'gas-stub.js'));

const HTML_PATH = path.resolve(process.env.PUFF_HTML || 'index.html');
const html = fs.readFileSync(HTML_PATH);
const SRC = html.toString();
const OWNER = (/var OWNER_URL = "([^"]+)"/.exec(SRC) || [])[1];
const FRAN = (/var FRANCHISE_URL = "([^"]+)"/.exec(SRC) || [])[1];
const V9_HEAD = ['branch', 'owner_pin', 'staff_pin', 'report_email', 'updated_at', 'type', 'status', 'label', 'start', 'end', 'act_code', 'act_exp', 'created_by'];
const tokRole = t => { try { return JSON.parse(Buffer.from(String(t).split('.')[0], 'base64').toString()).r; } catch (e) { return ''; } };

// SBR-01 company (owner 2580 / staff 1357) + events, dates relative to the server's today.
const EV = [
  ['E-RUN', 'active', -2, 2, '4826', 'งานวัดหลวง'],
  ['E-TODAY', 'active', 0, 0, '5937', 'Siam Fair'],
  ['E-FUT', 'active', 3, 5, '6048', 'งานอนาคต'],
  ['E-LATE', 'active', -5, -1, '7159', 'งานเลยกำหนด'],
  ['E-END', 'ended', -3, 1, '8260', 'งานจบแล้ว'],
  ['E-OLD', 'active', -10, -5, '9371', 'งานเก่า']
];
function servers() {
  const o = makeEnv('owner', { props: { HQ_PIN: '8642', ENFORCE_TOKEN: 'true', REQUIRE_PIN: 'true', EVENT_OPEN_PIN: '3141' }, files: ['Code-owner.gs', 'Access.gs'] });
  const f = makeEnv('franchise', { props: { ENFORCE_TOKEN: 'true', REQUIRE_PIN: 'true' }, files: ['Code-franchise.gs', 'Access.gs'] });
  const t = o.call('todayNum_'), ds = n => o.call('dayStr_', t + n);
  const rows = [['SBR-01', o.call('pinHash_', 'SBR-01', 'owner', '2580'), o.call('pinHash_', 'SBR-01', 'staff', '1357'), '', '', 'company', 'active', 'L SBR-01', '', '', '', '', '']];
  EV.forEach(e => rows.push([e[0], o.call('pinHash_', e[0], 'owner', e[4]), '', '', '', 'event', e[1], e[5], ds(e[2]), ds(e[3]), '', '', 'T (0800000000)']));
  o.seedAccess(rows, V9_HEAD);
  f.seedAccess([['BK-F01', f.call('pinHash_', 'BK-F01', 'owner', '3691'), f.call('pinHash_', 'BK-F01', 'staff', '1468'), '', '', 'franchise', 'active', 'L BK-F01', '', '', '', '', '']], V9_HEAD);
  return { o, f, ds };
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
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  const errs = [], R = [], calls = [];
  let fake = null;   // 'v8list' event_list → v8 shape (no events) · 'nolist' event_list → network failure
  const ok = (id, cond, info) => R.push([id, !!cond, info === undefined ? '' : String(info)]);
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && m.text().indexOf('net::ERR_FAILED') < 0) errs.push('console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  const S = servers();
  await p.route('**/*', route => {
    const rq = route.request(), u = rq.url();
    if (u.indexOf('https://script.google.com/') === 0) {
      const env = u.indexOf(OWNER) === 0 ? S.o : u.indexOf(FRAN) === 0 ? S.f : null;
      const which = env === S.o ? 'owner' : env === S.f ? 'franchise' : '?';
      let ans = { ok: false, error: 'unknown script' };
      if (rq.method() === 'GET') {
        const q = Object.fromEntries(new URL(u).searchParams);
        if (q.type === 'event_list' && fake === 'nolist') { calls.push({ which, type: q.type, ans: 'ABORT' }); return route.abort('failed'); }
        if (q.type === 'event_list' && fake === 'v8list') ans = { ok: false, error: 'unknown type' };
        else if (env) ans = env.get(q);
        calls.push({ which, type: q.type, ans });
      } else {
        const body = JSON.parse(rq.postData() || '{}');
        calls.push({ which, type: body.type, kind: body.kind, branch: body.branch, body });
        if (env) ans = env.post(body);
        calls[calls.length - 1].ans = ans;
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(ans) });
    }
    if (u.indexOf(base) === 0) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });

  async function names() { await p.fill('#loginName', 'Test Tester'); await p.fill('#loginNick', 'T'); await p.fill('#loginPhone', '0800000000'); }
  async function evTab() { await p.click('#loginTabs [data-tab="event"]'); await p.waitForTimeout(500); }
  // Pick + PIN + เริ่มใช้งาน. Returns 'sheet' (confirm open) · 'main' · 'login' · 'ERR …' (so the intended test fails by itself).
  async function evLogin(key, pin) {
    try {
      if (key) await p.click('#loginEventList [data-ev="' + key + '"]', { timeout: 2000 });
      if (pin !== null) await p.fill('#loginPinInput', pin, { timeout: 2000 });
      await p.click('#loginBtn', { timeout: 2000 }); await p.waitForTimeout(700);
    } catch (e) { return 'ERR ' + String(e.message).split('\n')[0].slice(0, 60); }
    return p.evaluate(() => document.getElementById('evConfirmModal') ? 'sheet' : document.getElementById('mainApp').style.display === 'block' ? 'main' : 'login');
  }
  async function tap(sel) { try { await p.click(sel, { timeout: 2000 }); await p.waitForTimeout(500); return true; } catch (e) { return false; } }
  async function logout() { await p.evaluate(() => doLogout()); await p.waitForTimeout(400); }
  const st = () => p.evaluate(() => {
    var q = function (id) { return document.getElementById(id); };
    var items = [].map.call(document.querySelectorAll('#loginEventList [data-ev]'), function (x) {
      return { key: x.getAttribute('data-ev'), dis: x.disabled, late: x.classList.contains('late'), on: x.classList.contains('on'), txt: x.textContent };
    });
    var sheet = q('evConfirmModal');
    return {
      items: items, note: [].map.call(document.querySelectorAll('#loginEventList .lf-note'), function (x) { return x.textContent + '|' + (x.getAttribute('data-evreload') || ''); }).join(),
      btnDis: q('loginBtn').disabled, pick: _loginBranch, tab: _loginTab, pinLbl: (document.querySelector('label[for="loginPinInput"]') || {}).textContent || '',
      sheet: !!sheet, sheetTxt: sheet ? sheet.textContent : '', main: q('mainApp').style.display, branch: currentBranch,
      role: currentBranch ? getRole() : '', hdr: (q('hdrBranch') || {}).textContent || '', toast: (q('toast') || {}).textContent || '',
      tokens: getTokens(), info: getBranchInfoMap(), auth: localStorage.getItem('puff10_branchAuth') || '', pin: q('loginPinInput').value,
      queue: JSON.parse(localStorage.getItem('puff10_syncQueue') || '[]').length
    };
  });
  const auths = () => calls.filter(c => c.type === 'branch_auth');
  const lists = () => calls.filter(c => c.type === 'event_list');
  const keys = s => s.items.map(i => i.key).join(',');

  try {
    await p.goto(base); await p.waitForTimeout(600);
    await names();

    // ── V01 event tab → ONE GET event_list on the Owner script · open + future + late listed, ended / past grace not ──
    calls.length = 0;
    await evTab();
    let s = await st();
    const it = k => s.items.find(i => i.key === k) || {};
    ok('V01 Event tab → GET event_list (Owner) · running + today enabled · future disabled "ยังเข้าไม่ได้" · late red "เลยกำหนด" · ended + past grace hidden · nothing picked, button off · PIN label = รหัสงาน',
      lists().length === 1 && lists()[0].which === 'owner' && keys(s) === 'E-LATE,E-RUN,E-TODAY,E-FUT' &&
      !it('E-RUN').dis && !it('E-TODAY').dis && it('E-FUT').dis && it('E-FUT').txt.indexOf('ยังเข้าไม่ได้') >= 0 &&
      it('E-LATE').late && !it('E-LATE').dis && it('E-LATE').txt.indexOf('เลยกำหนด') >= 0 && !it('E-RUN').late &&
      s.pick === '' && s.btnDis && s.note === '' && s.pinLbl.indexOf('รหัสงาน') === 0,
      JSON.stringify([lists().map(c => c.which), keys(s), s.items, s.pick, s.btnDis, s.note, s.pinLbl]));

    // ── V02 future event: tap does nothing ──
    await p.click('#loginEventList [data-ev="E-FUT"]', { force: true, timeout: 2000 }).catch(() => { });
    s = await st();
    ok('V02 tap on a future event → not picked, button stays off', s.pick === '' && s.btnDis, JSON.stringify([s.pick, s.btnDis]));

    // ── V03 wrong PIN → error text, nothing stored ──
    calls.length = 0;
    let r = await evLogin('E-RUN', '1470');
    s = await st();
    ok('V03 wrong event PIN → branch_auth kind "event" on Owner → "รหัสไม่ถูกต้อง" · no sheet · no token / info / session for the event',
      r === 'login' && auths().length === 1 && auths()[0].which === 'owner' && auths()[0].kind === 'event' && auths()[0].branch === 'E-RUN' &&
      s.toast.indexOf('รหัสไม่ถูกต้อง') >= 0 && !s.sheet && !s.tokens['E-RUN'] && !s.info['E-RUN'] && s.auth === '',
      JSON.stringify([r, auths().map(c => [c.which, c.kind, c.branch, c.ans.error]), s.toast, Object.keys(s.tokens), s.auth]));

    // ── V04 right PIN → D-ev-3 confirm sheet, still nothing stored · ไม่ใช่ → back on the login screen, PIN cleared ──
    r = await evLogin('E-RUN', '4826');
    s = await st();
    const v04 = [r, s.sheet, s.sheetTxt.indexOf('งานวัดหลวง') >= 0, !s.tokens['E-RUN'], !s.info['E-RUN'], s.auth === '', s.main];
    const noOk = await tap('#evConfirmNo');
    s = await st();
    ok('V04 right PIN → confirm sheet with the event name, nothing stored yet · "ไม่ใช่" → sheet gone, login screen, PIN cleared, still nothing stored',
      v04.slice(0, 6).join() === 'sheet,true,true,true,true,true' && v04[6] !== 'block' && noOk && !s.sheet && s.main !== 'block' && s.pin === '' && !s.tokens['E-RUN'] && s.auth === '',
      JSON.stringify([v04, noOk, s.sheet, s.main, s.pin, Object.keys(s.tokens)]));

    // ── V05 ใช่ → in the event: owner, header = event name, info {type,label,start,end}, server token valid ──
    calls.length = 0;
    r = await evLogin('E-RUN', '4826');
    const yesOk = await tap('#evConfirmYes');
    s = await st();
    const tok5 = (s.tokens['E-RUN'] || {}).token;
    const live5 = !!(tok5 && S.o.call('authFor_', tok5, 'E-RUN'));
    ok('V05 "ใช่ เข้างานนี้" → main app on E-RUN · role owner · header shows the event name · branchInfo has type/label/start/end · token valid on the server',
      r === 'sheet' && yesOk && s.main === 'block' && s.branch === 'E-RUN' && s.role === 'owner' && s.hdr.indexOf('งานวัดหลวง') === 0 &&
      s.info['E-RUN'] && s.info['E-RUN'].type === 'event' && s.info['E-RUN'].label === 'งานวัดหลวง' && s.info['E-RUN'].start === S.ds(-2) && s.info['E-RUN'].end === S.ds(2) &&
      tokRole(tok5) === 'owner' && live5 && auths().length === 1,
      JSON.stringify([r, yesOk, s.main, s.branch, s.role, s.hdr, s.info['E-RUN'], live5]));

    // ── V06 back-date bound: candidates never before start · a day before start is refused at write time ──
    const bd = await p.evaluate(() => {
      var c = backDateCandidates().map(function (d) { return d.date; });
      enterBackDate(shiftDateStr(todayISO(), -3), 'ทดสอบก่อนเริ่มงาน');
      return { c: c, bd: _backDate ? _backDate.date : '', toast: (document.getElementById('toast') || {}).textContent || '' };
    });
    ok('V06 event started 2 days ago → back-date candidates = only those 2 days · start − 1 refused ("ลงยอดย้อนหลังไม่ได้"), not opened',
      bd.c.join() === [S.ds(-2), S.ds(-1)].join() && bd.bd === '' && bd.toast.indexOf('ลงยอดย้อนหลังไม่ได้') >= 0, JSON.stringify(bd));

    // ── V07 company branch is not bound: 7 candidates (positive control for V06's rule) ──
    await logout();
    await p.click('#loginTabs [data-tab="company"]'); await p.selectOption('#loginBranchSel', 'SBR-01'); await p.fill('#loginPinInput', '2580');
    await p.click('#loginBtn'); await p.waitForTimeout(800);
    const bd7 = await p.evaluate(() => ({ branch: currentBranch, n: backDateCandidates().length, lbl: '' }));
    ok('V07 company owner → 7 back-date candidates (no start bound) · company login has no confirm sheet', bd7.branch === 'SBR-01' && bd7.n === 7 && !(await p.$('#evConfirmModal')), JSON.stringify(bd7));
    await logout();

    // ── V08 resume (D-ev-4): reload → event tab + E-RUN pre-picked → เริ่มใช้งาน without PIN, 0 branch_auth, no sheet ──
    calls.length = 0;
    await p.evaluate(() => { localStorage.setItem('puff10_branchAuth', JSON.stringify({ branch: 'E-RUN', ts: Date.now() })); localStorage.setItem('puff8_lastBranch', 'E-RUN'); localStorage.setItem('puff10_loginTab', 'event'); });
    await p.reload(); await p.waitForTimeout(900);
    s = await st();
    const v08 = [s.tab, s.pick, (s.items.find(i => i.key === 'E-RUN') || {}).on, s.btnDis];
    r = await evLogin(null, null);
    s = await st();
    ok('V08 reload with a live event session → Event tab, E-RUN pre-picked + highlighted · login without PIN → in, 0 branch_auth, no confirm sheet',
      v08.join() === 'event,E-RUN,true,false' && r === 'main' && s.branch === 'E-RUN' && auths().length === 0,
      JSON.stringify([v08, r, s.branch, auths().length]));

    // ── V09 offline resume: event_list fails → own event still listed ("เครื่องนี้เข้าอยู่") + retry note · login works ──
    await p.evaluate(() => { var a = currentBranch; doLogout(); localStorage.setItem('puff10_branchAuth', JSON.stringify({ branch: a, ts: Date.now() })); });
    fake = 'nolist'; calls.length = 0;
    await p.reload(); await p.waitForTimeout(900);
    s = await st();
    const v09 = [keys(s), s.pick, (s.items[0] || {}).txt || '', s.note];
    r = await evLogin(null, null);
    s = await st();
    ok('V09 event_list unreachable → only this device\'s event (marked "เครื่องนี้เข้าอยู่"), pre-picked · retry note · login offline-style → in, 0 branch_auth',
      v09[0] === 'E-RUN' && v09[1] === 'E-RUN' && v09[2].indexOf('เครื่องนี้เข้าอยู่') >= 0 && v09[3].indexOf('ลองใหม่|1') >= 0 && r === 'main' && auths().length === 0,
      JSON.stringify([v09, r, auths().length]));

    // ── V09b offline + this device's event is past end + 3-day grace → not offered (the server would refuse every write) ──
    await logout(); fake = 'nolist';
    await p.evaluate(a => { localStorage.setItem('puff10_branchAuth', JSON.stringify({ branch: 'E-RUN', ts: Date.now() }));
      var m = getBranchInfoMap(); if (m['E-RUN']) m['E-RUN'].end = a; localStorage.setItem('puff10_branchInfo', JSON.stringify(m)); setLoginTab('event'); }, S.ds(-4));
    await p.waitForTimeout(500);
    s = await st();
    ok('V09b offline, own event ended 4 days ago (past grace) → not listed, nothing picked, button off', keys(s) === '' && s.pick === '' && s.btnDis, JSON.stringify([keys(s), s.pick, s.note]));
    await p.evaluate(a => { var m = getBranchInfoMap(); if (m['E-RUN']) m['E-RUN'].end = a; localStorage.setItem('puff10_branchInfo', JSON.stringify(m)); localStorage.removeItem('puff10_branchAuth'); }, S.ds(2));

    // ── V10 retry: tap the note → a 2nd GET; v8 Owner (no events array) → error note, never a crash ──
    await logout(); calls.length = 0; fake = 'v8list';
    await evTab();
    s = await st();
    const v10a = [lists().length, s.note];
    fake = null;
    const re = await tap('#loginEventList [data-evreload]');
    s = await st();
    ok('V10 v8 Owner answer (no events) → "โหลดรายการงานไม่ได้" retry note · tap it → 2nd GET, full list back',
      v10a[0] >= 1 && v10a[1].indexOf('โหลดรายการงานไม่ได้') >= 0 && re && lists().length === v10a[0] + 1 && keys(s) === 'E-LATE,E-RUN,E-TODAY,E-FUT' && s.note === '',
      JSON.stringify([v10a, re, lists().length, keys(s), s.note]));

    // ── V11 late event → confirm sheet carries the red "เลยวันสุดท้าย" line ──
    r = await evLogin('E-LATE', '7159');
    s = await st();
    ok('V11 event past its end (in grace) → confirm sheet warns "เลยวันสุดท้ายของงานแล้ว"', r === 'sheet' && s.sheetTxt.indexOf('เลยวันสุดท้ายของงานแล้ว') >= 0, JSON.stringify([r, s.sheetTxt.slice(0, 120)]));
    await tap('#evConfirmNo');

    // ── V12 tap outside the sheet = cancel: nothing stored, button usable again ──
    r = await evLogin('E-TODAY', '5937');
    await p.mouse.click(5, 5); await p.waitForTimeout(300);
    s = await st();
    ok('V12 tap outside the confirm sheet → closed, nothing stored for E-TODAY, button enabled again',
      r === 'sheet' && !s.sheet && !s.tokens['E-TODAY'] && !s.info['E-TODAY'] && !s.btnDis, JSON.stringify([r, s.sheet, Object.keys(s.tokens), s.btnDis]));

    // ── V13 event ended between list and login → "งานนี้ปิดแล้ว" ──
    await p.evaluate(() => { var i = document.getElementById('loginPinInput'); i.value = ''; });
    const tokT = S.o.post({ type: 'branch_auth', branch: 'E-TODAY', pin: '5937', kind: 'event' }).token;
    S.o.post({ type: 'event_end', branch: 'E-TODAY', token: tokT });
    r = await evLogin('E-TODAY', '5937');
    s = await st();
    ok('V13 event ended after the list loaded → login refused with "งานนี้ปิดแล้ว" · nothing stored', r === 'login' && s.toast.indexOf('งานนี้ปิดแล้ว') >= 0 && !s.tokens['E-TODAY'], JSON.stringify([r, s.toast]));

    // ── V14 ended answer in the sync queue → item dropped for good + toast (was: stuck forever) ──
    r = await evLogin('E-RUN', '4826'); await tap('#evConfirmYes');
    const tokR = ((await st()).tokens['E-RUN'] || {}).token;
    ok('V14a pre: logged in to E-RUN again', (await st()).branch === 'E-RUN', '');
    S.o.post({ type: 'event_end', branch: 'E-RUN', token: tokR });
    calls.length = 0;
    await p.evaluate(() => { if (!S) return; var x = JSON.parse(JSON.stringify(S)); x.stock_log = [{ t: 1 }]; queueCloudSync(currentBranch, x.date, x); });
    await p.waitForTimeout(800);
    s = await st();
    const saves = calls.filter(c => c.type === 'state_save');
    ok('V14 state_save of an ended event → server {ended} → item dropped (queue 0), toast "งานนี้ปิดแล้ว … ยังอยู่ในเครื่อง", no logout',
      saves.length === 1 && saves[0].ans.ended === true && s.queue === 0 && s.toast.indexOf('ยังอยู่ในเครื่อง') >= 0 && s.main === 'block',
      JSON.stringify([saves.map(c => c.ans), s.queue, s.toast, s.main]));
    await logout();

    // ── V14b online: this device's last event was ended → the loaded list drops it and the pre-pick is cleared ──
    await p.evaluate(() => { localStorage.setItem('puff10_branchAuth', JSON.stringify({ branch: 'E-RUN', ts: Date.now() })); setLoginTab('company'); setLoginTab('event'); });
    const pre14 = await p.evaluate(() => _loginBranch);
    await p.waitForTimeout(600);
    s = await st();
    ok('V14b ended own event, list loads → pre-picked while loading, then dropped: not listed, nothing picked, button off',
      pre14 === 'E-RUN' && keys(s).indexOf('E-RUN') < 0 && s.pick === '' && s.btnDis, JSON.stringify([pre14, keys(s), s.pick]));
    await p.evaluate(() => localStorage.removeItem('puff10_branchAuth'));

    // ── V15 tabs: back to company / franchise → their own pick + PIN label; event pick never leaks into them ──
    await p.click('#loginTabs [data-tab="company"]'); await p.selectOption('#loginBranchSel', 'SBR-01');
    await p.click('#loginTabs [data-tab="event"]'); await p.waitForTimeout(400);
    await p.click('#loginEventList [data-ev="E-LATE"]', { timeout: 2000 }).catch(() => { });
    const v15e = (await st()).pick;
    await p.click('#loginTabs [data-tab="company"]'); await p.waitForTimeout(200);
    const v15a = await st();
    await p.click('#loginTabs [data-tab="franchise"]'); await p.fill('#loginFreeInput', ''); await p.waitForTimeout(200);
    const v15b = await st();
    ok('V15 Event → company → franchise: pick = that tab\'s own value (SBR-01 / empty), PIN label back to รหัสสาขา',
      v15e === 'E-LATE' && v15a.pick === 'SBR-01' && v15a.pinLbl.indexOf('รหัสสาขา') === 0 && v15b.pick === '' && v15b.btnDis, JSON.stringify([v15e, v15a.pick, v15a.pinLbl, v15b.pick]));

    // ── V16 static vs c3 ──
    const baseSrc = cp.execSync('git show ' + (process.env.D1_BASE || 'bcde2b2') + ':index.html', { encoding: 'utf8', maxBuffer: 64 << 20 });
    const baseSet = new Set(baseSrc.split('\n'));
    const added = SRC.split('\n').filter(l => !baseSet.has(l));
    const bad = added.filter(l => /\blet\s|\bconst\s|=>|`|innerHTML/.test(l));
    const elOf = x => (/function el\(tag, attrs, kids\) \{[\s\S]*?\n        \}/.exec(x) || [''])[0];
    const n = (x, re) => (x.match(re) || []).length;
    const facts = { setTok: [n(SRC, /setToken\(/g), n(baseSrc, /setToken\(/g)], authBody: [n(SRC, /type: "branch_auth"/g), n(baseSrc, /type: "branch_auth"/g)],
      accept: [n(SRC, /acceptLogin\(/g) - n(baseSrc, /acceptLogin\(/g)], placeholder: SRC.indexOf('เปิดใช้ในเวอร์ชันถัดไป') };
    ok('V16 static: ' + added.length + ' added lines without let/const/=>/`/innerHTML · el() byte-identical · no new setToken( / branch_auth body · +1 acceptLogin( (confirm) · placeholder gone',
      added.length > 40 && bad.length === 0 && elOf(SRC) && elOf(SRC) === elOf(baseSrc) && facts.setTok[0] === facts.setTok[1] && facts.authBody[0] === facts.authBody[1] &&
      facts.accept[0] === 1 && facts.placeholder < 0, JSON.stringify([bad.slice(0, 3), facts]));

    ok('V17 no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  } catch (e) {
    ok('CRASH', false, e.stack);
  } finally {
    await b.close(); srv.close();
  }
  let pass = 0;
  R.forEach(r => { console.log((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[1] ? '' : '  →  ' + r[2])); if (r[1]) pass++; });
  console.log('\n' + pass + '/' + R.length + ' passed');
  process.exit(pass === R.length ? 0 : 1);
})();
