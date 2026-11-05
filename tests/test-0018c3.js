// test-0018c3.js — 0018-c3 client: owner settings for company AND franchise branches (SPEC §4.5).
// Runs the app against the REAL server code (gs/Code-*.gs + gs/Access.gs in gs/test/gas-stub.js), ENFORCE_TOKEN + REQUIRE_PIN on.
// Token truth is asked from the real server: valid() = get_branch_config with that token → 'owner' / 'staff' (owner_only) / 'dead' (auth).
// Run from repo root:  node tests/test-0018c3.js
//   PUFF_HTML = app file to test (default index.html) · C3_BASE = git ref for the static checks (default d7c1667 = c2 + cash fix)
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

// SBR-01 company (owner 2580 / staff 1357) · BK-F01 franchise (owner 3691 / staff 1468, no report email yet)
function servers() {
  const o = makeEnv('owner', { props: { HQ_PIN: '8642', ENFORCE_TOKEN: 'true', REQUIRE_PIN: 'true' }, files: ['Code-owner.gs', 'Access.gs'] });
  const f = makeEnv('franchise', { props: { ENFORCE_TOKEN: 'true', REQUIRE_PIN: 'true' }, files: ['Code-franchise.gs', 'Access.gs'] });
  o.seedAccess([['SBR-01', o.call('pinHash_', 'SBR-01', 'owner', '2580'), o.call('pinHash_', 'SBR-01', 'staff', '1357'), '', '', 'company', 'active', 'L SBR-01', '', '', '', '', '']], V9_HEAD);
  f.seedAccess([['BK-F01', f.call('pinHash_', 'BK-F01', 'owner', '3691'), f.call('pinHash_', 'BK-F01', 'staff', '1468'), '', '', 'franchise', 'active', 'L BK-F01', '', '', '', '', '']], V9_HEAD);
  return { o, f };
}
const row = (e, b) => { e.call('clearAccessCache_'); return e.call('accessRow_', b); };
// PIN check straight on the stored hash — no branch_auth, so it never feeds the login lockout.
const pinIs = (e, b, role, pin) => { const r = row(e, b); return !!e.call('pinMatches_', role === 'owner' ? r.owner_pin : r.staff_pin, b, role, pin, r.legacy); };
const valid = (e, b, tok) => { const a = e.post({ type: 'get_branch_config', branch: b, token: tok }); return a.ok ? 'owner' : a.auth ? 'dead' : a.error === 'owner_only' ? 'staff' : JSON.stringify(a); };

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
  // fake: 'v8cfg' get_branch_config → {ok:true} (v8 Owner, unknown type) · 'v8fr' → v8 Franchise shape (no type)
  //       'v8owner' set_owner_pin → {ok:true} · 'abort' set_staff_pin → network failure
  let fake = null;
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
      if (rq.method() === 'GET') { const q = Object.fromEntries(new URL(u).searchParams); if (env) ans = env.get(q); calls.push({ which, type: q.type, ans }); }
      else {
        const body = JSON.parse(rq.postData() || '{}');
        calls.push({ which, type: body.type, kind: body.kind, branch: body.branch, body });
        if (fake === 'abort' && body.type === 'set_staff_pin') return route.abort('failed');
        if (fake === 'v8cfg' && body.type === 'get_branch_config') ans = { ok: true };
        else if (fake === 'v8fr' && body.type === 'get_branch_config') ans = { ok: true, report_email: '', has_staff_pin: true };
        else if (fake === 'v8owner' && body.type === 'set_owner_pin') ans = { ok: true };
        else if (env) ans = env.post(body);
        calls[calls.length - 1].ans = ans;
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(ans) });
    }
    if (u.indexOf(base) === 0) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });

  async function login(tab, branch, pin) {
    await p.fill('#loginName', 'Test Tester'); await p.fill('#loginNick', 'T'); await p.fill('#loginPhone', '0800000000');
    await p.click('#loginTabs [data-tab="' + tab + '"]');
    if (tab === 'company') await p.selectOption('#loginBranchSel', branch); else await p.fill('#loginFreeInput', branch);
    await p.fill('#loginPinInput', pin);
    await p.click('#loginBtn');
    await p.waitForFunction(() => document.getElementById('mainApp').style.display === 'block', null, { timeout: 8000 }).catch(() => { });
    await p.waitForTimeout(500);
  }
  async function logout() { await p.evaluate(() => doLogout()); await p.waitForTimeout(300); }
  async function chip(pin) {
    await p.click('#roleChip'); await p.waitForTimeout(150);
    if (pin !== undefined && await p.$('#roleModal')) { await p.fill('#roleModalPin', pin); await p.click('#roleModalOk'); await p.waitForTimeout(500); }
  }
  async function closeTab() { await p.evaluate(() => go('close')); await p.waitForTimeout(400); }
  async function openSheet(kind) { await p.click(kind === 'owner' ? '#ownOwnerPinBtn' : '#ownStaffPinBtn', { timeout: 2000 }); await p.waitForTimeout(150); }
  // Fill the PIN-change sheet (cur only for owner) and submit; returns the sheet message.
  // A sheet that closed / a button that stayed disabled returns 'ERR …' so the calling test fails by itself (not a CRASH later).
  async function submit(cur, n1, n2) {
    try {
      if (cur !== null) await p.fill('#pcCur', cur, { timeout: 2000 });
      await p.fill('#pcNew1', n1, { timeout: 2000 }); await p.fill('#pcNew2', n2, { timeout: 2000 });
      await p.click('#pcOk', { timeout: 2000 }); await p.waitForTimeout(600);
    } catch (e) { return 'ERR ' + String(e.message).split('\n')[0].slice(0, 60); }
    return p.evaluate(() => (document.getElementById('pcMsg') || {}).textContent || '');
  }
  const st = () => p.evaluate(() => {
    var q = function (id) { return document.getElementById(id); };
    var btns = ['ownEmailBtn', 'ownStaffPinBtn', 'ownOwnerPinBtn'].filter(function (id) { return q(id); });
    return {
      card: !!document.querySelector('#ownerSettings .card'), email: !!q('ownEmail'), emailVal: q('ownEmail') ? q('ownEmail').value : '',
      btns: btns.join(','), enabled: btns.filter(function (id) { return !q(id).disabled; }).join(','),
      note: (q('ownNote') || {}).textContent || '', sheet: !!q('pinChgModal'), cur: !!q('pcCur'),
      msg: (q('pcMsg') || {}).textContent || '', okTxt: q('pcOk') ? q('pcOk').textContent : '', okDis: q('pcOk') ? q('pcOk').disabled : null,
      toast: (q('toast') || {}).textContent || '', main: q('mainApp').style.display, branch: currentBranch,
      role: currentBranch ? getRole() : '', elev: _elev ? _elev.token : '', stored: currentBranch ? (getTokens()[currentBranch] || {}) : {},
      asStaff: localStorage.getItem('puff10_asStaff') || ''
    };
  });
  const sets = () => calls.filter(c => /^set_/.test(c.type));
  const auths = () => calls.filter(c => c.type === 'branch_auth');

  try {
    await p.goto(base); await p.waitForTimeout(600);

    // ── N01 company staff → no settings card ──
    await login('company', 'SBR-01', '1357'); await closeTab();
    let s = await st();
    ok('N01 company staff login → no owner settings card', s.main === 'block' && s.role === 'staff' && !s.card, JSON.stringify([s.main, s.role, s.card]));

    // ── N02 company owner switch → card on the OWNER script: 2 PIN buttons, no email, enabled after a v9 answer ──
    calls.length = 0;
    await chip('2580'); await closeTab();
    s = await st();
    let cfg = calls.filter(c => c.type === 'get_branch_config');
    ok('N02 company owner (switch) → card: staff + owner PIN buttons, NO email · get_branch_config on the Owner script, v9 answer → buttons on',
      s.role === 'owner' && s.card && !s.email && s.btns === 'ownStaffPinBtn,ownOwnerPinBtn' && s.enabled === s.btns && s.note === '' &&
      cfg.length >= 1 && cfg.every(c => c.which === 'owner' && c.ans.ok && c.ans.type === 'company'),
      JSON.stringify([s.role, s.card, s.email, s.btns, s.enabled, s.note, cfg.map(c => [c.which, c.ans])]));

    // ── N03 staff sheet: client rules (pinRuleCode) + confirm, on top, 0 requests ──
    await openSheet('staff');
    const top = await p.evaluate(() => { var o = document.getElementById('pcOk'); if (!o) return false; var r = o.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === o; });
    calls.length = 0;
    const m3 = [await submit(null, '12', '12'), await submit(null, '1111', '1111'), await submit(null, '1234', '1234'), await submit(null, '4680', '4681')];
    s = await st();
    ok('N03 staff sheet: no current-PIN field · on top · format / repeat / sequence / confirm mismatch caught · 0 requests',
      s.sheet && !s.cur && top && m3[0].indexOf('4–6') >= 0 && m3[1].indexOf('เลขเดียวกัน') >= 0 && m3[2].indexOf('เรียงกัน') >= 0 &&
      m3[3] === 'ยืนยันรหัสพนักงานไม่ตรงกัน' && m3.slice(0, 3).every(x => x.indexOf('รหัสพนักงาน: ') === 0) && calls.length === 0,
      JSON.stringify([s.sheet, s.cur, top, m3, calls.length]));

    // ── N04 staff PIN change from a STAFF device (switch on) → server hash changed, old staff token dead, device re-logged as staff (1a) ──
    const staffTok0 = s.stored.token, elev0 = s.elev;
    calls.length = 0;
    const m4 = await submit(null, '4680', '4680');
    s = await st();
    let au = auths(), st4 = sets();
    ok('N04 staff PIN 1357 → 4680 (switch on a staff device): set_staff_pin on Owner ok · ONE branch_auth with 4680 (kind company) · stored staff token replaced + valid · old staff token dead',
      !s.sheet && st4.length === 1 && st4[0].which === 'owner' && st4[0].ans.ok && au.length === 1 && au[0].body.pin === '4680' && au[0].kind === 'company' &&
      s.stored.token !== staffTok0 && s.stored.role === 'staff' && tokRole(s.stored.token) === 'staff' && valid(S.o, 'SBR-01', s.stored.token) === 'staff' &&
      valid(S.o, 'SBR-01', staffTok0) === 'dead' && pinIs(S.o, 'SBR-01', 'staff', '4680') && !pinIs(S.o, 'SBR-01', 'staff', '1357') &&
      s.role === 'owner' && s.elev === elev0 && s.toast.indexOf('พนักงานเครื่องอื่น') >= 0,
      JSON.stringify([m4, s.sheet, st4.map(c => [c.which, c.ans]), au.map(c => [c.body.pin, c.kind, c.ans.role]), s.stored.role, valid(S.o, 'SBR-01', s.stored.token), valid(S.o, 'SBR-01', staffTok0), s.toast]));

    // ── N05 switch off → staff again, still logged in, the token the app now sends is the NEW valid staff token ──
    await chip(); await closeTab();
    s = await st();
    const sent5 = await p.evaluate(() => getTokenFor(currentBranch));
    ok('N05 switch off → staff, still in the app, no card · getTokenFor = re-logged staff token (server: valid staff)',
      s.role === 'staff' && s.main === 'block' && !s.card && !s.elev && sent5 === s.stored.token && valid(S.o, 'SBR-01', sent5) === 'staff',
      JSON.stringify([s.role, s.main, s.card, valid(S.o, 'SBR-01', sent5)]));

    // ── N06 owner sheet: current PIN field · client blocks empty current / new = current · server: wrong current · new = staff PIN ──
    await chip('2580'); await closeTab();
    await openSheet('owner');
    calls.length = 0;
    const m6a = [await submit('', '3579', '3579'), await submit('2580', '2580', '2580')];
    const n6a = calls.length;
    const m6b = await submit('9999', '3579', '3579');
    s = await st();
    const keep6 = s.sheet && !s.okDis && s.okTxt === 'บันทึกรหัสเจ้าของใหม่';
    const m6c = await submit('2580', '4680', '4680');
    s = await st();
    ok('N06 owner sheet: current-PIN field · empty current / new = current blocked (0 requests) · wrong current → "รหัสเจ้าของปัจจุบันไม่ถูกต้อง", sheet stays, button back · new = staff PIN → same_pin text',
      s.cur && m6a[0].indexOf('รหัสเจ้าของปัจจุบัน') >= 0 && m6a[1].indexOf('ไม่ซ้ำรหัสเดิม') >= 0 && n6a === 0 &&
      m6b === 'รหัสเจ้าของปัจจุบันไม่ถูกต้อง' && keep6 && m6c.indexOf('ไม่ซ้ำกัน') >= 0 && s.sheet && pinIs(S.o, 'SBR-01', 'owner', '2580'),
      JSON.stringify([s.cur, m6a, n6a, m6b, keep6, m6c]));

    // ── N07 owner PIN 2580 → 3579 with the switch on: _elev gets the fresh token · stored staff token untouched · every old owner token dead ──
    const other7 = S.o.post({ type: 'branch_auth', branch: 'SBR-01', pin: '2580', kind: 'company' }).token;   // another owner device
    s = await st();
    const elev7 = s.elev, stored7 = s.stored.token;
    calls.length = 0;
    const m7 = await submit('2580', '3579', '3579');
    s = await st();
    const elev7b = s.elev;
    await closeTab();
    cfg = calls.filter(c => c.type === 'get_branch_config');
    ok('N07 owner PIN 2580 → 3579 (switch on): _elev = fresh owner token (valid) · stored staff token untouched (valid) · old switch token + other owner device dead · card reloads ok',
      !s.sheet && s.toast.indexOf('เปลี่ยนรหัสเจ้าของแล้ว') >= 0 && elev7b && elev7b !== elev7 && tokRole(elev7b) === 'owner' && valid(S.o, 'SBR-01', elev7b) === 'owner' &&
      s.stored.token === stored7 && valid(S.o, 'SBR-01', stored7) === 'staff' && valid(S.o, 'SBR-01', elev7) === 'dead' && valid(S.o, 'SBR-01', other7) === 'dead' &&
      s.role === 'owner' && auths().length === 0 && pinIs(S.o, 'SBR-01', 'owner', '3579') && cfg.length >= 1 && cfg[cfg.length - 1].ans.ok === true,
      JSON.stringify([m7, s.sheet, s.toast, valid(S.o, 'SBR-01', elev7b), s.stored.token === stored7, valid(S.o, 'SBR-01', elev7), valid(S.o, 'SBR-01', other7), auths().length]));
    await logout();

    // ── N08 franchise owner-PIN device → card on the FRANCHISE script with email (unchanged email flow) ──
    calls.length = 0;
    await login('franchise', 'BK-F01', '3691'); await closeTab();
    s = await st();
    cfg = calls.filter(c => c.type === 'get_branch_config');
    await p.fill('#ownEmail', 'owner@shop.co'); await p.click('#ownEmailBtn'); await p.waitForTimeout(400);
    const s8 = await st(), em8 = calls.filter(c => c.type === 'set_report_email');
    ok('N08 franchise owner login → card with email + 2 PIN buttons · get_branch_config on the Franchise script · no-email warning · save email → row',
      s.role === 'owner' && !s.elev && s.email && s.btns === 'ownEmailBtn,ownStaffPinBtn,ownOwnerPinBtn' && s.enabled === s.btns && s.note.indexOf('ยังไม่ได้ตั้งอีเมล') >= 0 &&
      cfg.length >= 1 && cfg.every(c => c.which === 'franchise' && c.ans.type === 'franchise') &&
      em8.length === 1 && em8[0].which === 'franchise' && em8[0].ans.ok && row(S.f, 'BK-F01').report_email === 'owner@shop.co' && s8.note === '',
      JSON.stringify([s.role, s.btns, s.enabled, s.note, cfg.map(c => [c.which, c.ans.type]), em8.map(c => c.ans), s8.note]));

    // ── N09 franchise staff PIN from an OWNER device → no re-login call, stored owner token untouched ──
    const tok9 = s.stored.token;
    await openSheet('staff');
    calls.length = 0;
    const m9 = await submit(null, '2468', '2468');
    s = await st();
    ok('N09 franchise staff PIN 1468 → 2468 from an owner-PIN device: set_staff_pin on Franchise · 0 branch_auth · stored owner token same + valid',
      !s.sheet && sets().length === 1 && sets()[0].which === 'franchise' && sets()[0].ans.ok && auths().length === 0 &&
      s.stored.token === tok9 && valid(S.f, 'BK-F01', tok9) === 'owner' && pinIs(S.f, 'BK-F01', 'staff', '2468'),
      JSON.stringify([m9, s.sheet, sets().map(c => [c.which, c.ans]), auths().length, valid(S.f, 'BK-F01', tok9)]));

    // ── N10 franchise owner PIN from an owner-PIN device (no switch) → stored owner token replaced, device stays owner ──
    await openSheet('owner');
    const m10 = await submit('3691', '5793', '5793');
    s = await st();
    await closeTab();
    const s10 = await st();
    ok('N10 franchise owner PIN 3691 → 5793 (owner login, no switch): stored token = fresh owner token (valid) · old one dead · still owner, card reloads',
      !s.sheet && !s.elev && s.stored.token !== tok9 && s.stored.role === 'owner' && valid(S.f, 'BK-F01', s.stored.token) === 'owner' && valid(S.f, 'BK-F01', tok9) === 'dead' &&
      s.role === 'owner' && s10.card && s10.enabled === s10.btns && s.asStaff.indexOf('BK-F01') < 0 && pinIs(S.f, 'BK-F01', 'owner', '5793'),
      JSON.stringify([m10, s.sheet, valid(S.f, 'BK-F01', s.stored.token), valid(S.f, 'BK-F01', tok9), s.role, s10.enabled]));

    // ── N11 owner device handed to staff (👑 → 👤) + switch back with owner PIN → owner PIN change updates BOTH tokens, keeps "handed to staff" ──
    await chip();
    const s11a = await st();
    await chip('5793'); await closeTab();
    s = await st();
    const stored11 = s.stored.token, elev11 = s.elev;
    await openSheet('owner');
    const m11 = await submit('5793', '7315', '7315');
    s = await st();
    await chip(); await closeTab();
    const s11c = await st();
    ok('N11 handed-to-staff owner device + switch: owner PIN 5793 → 7315 → _elev AND stored owner token both fresh + valid · asStaff kept · switch off = staff, still in',
      s11a.role === 'staff' && s11a.asStaff.indexOf('BK-F01') >= 0 && elev11 &&
      s.elev && s.elev !== elev11 && valid(S.f, 'BK-F01', s.elev) === 'owner' && s.stored.token !== stored11 && s.stored.role === 'owner' && valid(S.f, 'BK-F01', s.stored.token) === 'owner' &&
      valid(S.f, 'BK-F01', stored11) === 'dead' && s.asStaff.indexOf('BK-F01') >= 0 && s11c.role === 'staff' && s11c.main === 'block' && !s11c.card,
      JSON.stringify([m11, s11a.role, valid(S.f, 'BK-F01', s.elev), valid(S.f, 'BK-F01', s.stored.token), valid(S.f, 'BK-F01', stored11), s.asStaff, s11c.role, s11c.main]));
    await logout();

    // ── N12 event branch → no card (events have one PIN; server says not_supported) ──
    await login('company', 'SBR-01', '3579'); await closeTab();
    const s12a = await st();
    const s12b = await p.evaluate(() => { var i = getBranchInfo(currentBranch); setBranchInfo(currentBranch, 'event', i.label); renderOwnerSettings(); var c = !!document.querySelector('#ownerSettings .card'); setBranchInfo(currentBranch, i.type, i.label); return c; });
    ok('N12 company owner login → card · same device with type event → no card', s12a.role === 'owner' && s12a.card && s12b === false, JSON.stringify([s12a.role, s12a.card, s12b]));

    // ── N13 v8 servers: blind {ok:true} / v8 Franchise shape → buttons stay off + "รออัปเดต" · set_owner_pin {ok:true} without token → not taken as done ──
    fake = 'v8cfg'; await closeTab(); const s13a = await st();
    fake = 'v8fr'; await closeTab(); const s13b = await st();
    fake = null; await closeTab();
    await openSheet('owner');
    s = await st(); const tok13 = s.stored.token;
    fake = 'v8owner';
    const m13 = await submit('3579', '1593', '1593');
    fake = null;
    s = await st();
    ok('N13 v8 answers: get_branch_config {ok:true} and v8 Franchise shape → every button disabled + "รออัปเดต" · set_owner_pin {ok:true} (no token) → "รออัปเดต", sheet stays, token + PIN unchanged',
      s13a.card && s13a.enabled === '' && s13a.note.indexOf('รออัปเดต') >= 0 && s13b.enabled === '' && s13b.note.indexOf('รออัปเดต') >= 0 &&
      m13.indexOf('รออัปเดต') >= 0 && s.sheet && s.stored.token === tok13 && valid(S.o, 'SBR-01', tok13) === 'owner' && pinIs(S.o, 'SBR-01', 'owner', '3579'),
      JSON.stringify([s13a.enabled, s13a.note, s13b.enabled, s13b.note, m13, s.sheet]));
    await p.evaluate(() => closeModalById('pinChgModal'));

    // ── N14 network failure → message, button back, ONE request (no retry), nothing changed ──
    await openSheet('staff');
    calls.length = 0; fake = 'abort';
    const m14 = await submit(null, '9135', '9135');
    fake = null;
    s = await st();
    ok('N14 network failure → "เชื่อมต่อไม่ได้", sheet stays, button back, 1 request, staff PIN unchanged',
      m14.indexOf('เชื่อมต่อไม่ได้') >= 0 && s.sheet && !s.okDis && sets().length === 1 && pinIs(S.o, 'SBR-01', 'staff', '4680'),
      JSON.stringify([m14, s.sheet, s.okDis, sets().length]));
    await p.evaluate(() => closeModalById('pinChgModal'));

    // ── N15 switch token killed elsewhere (owner PIN changed on another device) → save answers auth → sheet closed, back to staff, still in ──
    await chip();   // owner login → handed to staff
    await chip('3579'); await closeTab();
    const t15 = S.o.post({ type: 'branch_auth', branch: 'SBR-01', pin: '3579', kind: 'company' }).token;
    const ch15 = S.o.post({ type: 'set_owner_pin', branch: 'SBR-01', token: t15, current_pin: '3579', new_pin: '8024' });
    await openSheet('staff');
    await submit(null, '9135', '9135');
    s = await st();
    ok('N15 switch token dead (owner PIN changed elsewhere) → auth answer: sheet closed · staff again · still in the app · "หมดอายุ" toast · staff PIN unchanged',
      ch15.ok && !s.sheet && s.role === 'staff' && !s.elev && s.main === 'block' && s.toast.indexOf('หมดอายุ') >= 0 && pinIs(S.o, 'SBR-01', 'staff', '4680'),
      JSON.stringify([ch15.ok, s.sheet, s.role, s.main, s.toast]));
    await logout();

    // ── N16 wrong current owner PINs feed the branch lockout (shared with login, server) → "รอ 10 นาที" ──
    await login('company', 'SBR-01', '8024'); await closeTab();
    await openSheet('owner');
    const m16 = [];
    for (let i = 0; i < 12; i++) { const m = await submit('1111', '3579', '3579'); m16.push(m); if (m.indexOf('รอ 10 นาที') >= 0) break; }
    const lock16 = S.o.post({ type: 'branch_auth', branch: 'SBR-01', pin: '8024', kind: 'company' });
    ok('N16 wrong current owner PIN → bad_pin text, then the server lockout → "ใส่รหัสผิดหลายครั้ง — รอ 10 นาที" (branch login locked too)',
      m16.length >= 2 && m16[0] === 'รหัสเจ้าของปัจจุบันไม่ถูกต้อง' && m16[m16.length - 1].indexOf('รอ 10 นาที') >= 0 && lock16.error === 'locked_out',
      JSON.stringify([m16.length, m16[0], m16[m16.length - 1], lock16.error]));
    await p.evaluate(() => closeModalById('pinChgModal'));

    // ── N17 static vs the c2 + cash build ──
    const baseSrc = cp.execSync('git show ' + (process.env.C3_BASE || 'd7c1667') + ':index.html', { encoding: 'utf8', maxBuffer: 64 << 20 });
    const baseSet = new Set(baseSrc.split('\n'));
    const added = SRC.split('\n').filter(l => !baseSet.has(l));
    const bad = added.filter(l => /\blet\s|\bconst\s|=>|`|innerHTML/.test(l));
    const elOf = x => (/function el\(tag, attrs, kids\) \{[\s\S]*?\n        \}/.exec(x) || [''])[0];
    const n = (x, re) => (x.match(re) || []).length;
    const facts = {
      setTok: [n(SRC, /setToken\(/g), n(baseSrc, /setToken\(/g)], authBody: n(SRC, /type: "branch_auth"/g),
      franFetch: [n(SRC, /fetchJSON\(FRANCHISE_URL/g), n(baseSrc, /fetchJSON\(FRANCHISE_URL/g)],
      one: [n(SRC, /function openPinChange\(/g), n(SRC, /function sheetField\(/g), n(SRC, /function branchAuthFor\(/g)],
      gone: [SRC.indexOf('placeholder: "รหัสพนักงานใหม่"'), SRC.indexOf('confirm("เปลี่ยนรหัสพนักงาน'), SRC.indexOf('getSyncURL(currentBranch) !== FRANCHISE_URL')]
    };
    ok('N17 static: ' + added.length + ' added lines without let/const/=>/`/innerHTML · el() byte-identical · setToken( +1 (replaceOwnerToken) · branch_auth body in 2 places · Franchise-only fetch gone · one sheet / field / auth helper · old inline staff PIN gone',
      added.length > 50 && bad.length === 0 && elOf(SRC) && elOf(SRC) === elOf(baseSrc) && facts.setTok[0] === facts.setTok[1] + 1 && facts.authBody === 2 &&
      facts.franFetch[0] === facts.franFetch[1] - 1 && facts.one.join() === '1,1,1' && facts.gone.every(x => x < 0),
      JSON.stringify([bad.slice(0, 3), facts]));

    ok('N18 no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
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
