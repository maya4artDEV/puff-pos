// test-0018c.js — 0018-c1 client: header owner switch (👤 พนักงาน ⇄ 👑 เจ้าของ) + ONE idle timer + back-date via owner role.
// Runs the app against the REAL server code (gs/Code-*.gs + gs/Access.gs in gs/test/gas-stub.js), ENFORCE_TOKEN on,
// so "owner token" means the real Access.gs said owner (history = state_range owner_only, settings = branchConfig_).
// Run from repo root:  node tests/test-0018c.js      (C1_BASE = git ref for the added-lines check, default 9e72e20 = b0018 before c1)
const path = require('path'), fs = require('fs'), http = require('http'), cp = require('child_process');
const { chromium } = require('playwright');
const { makeEnv } = require(path.resolve('gs', 'test', 'gas-stub.js'));

const html = fs.readFileSync(path.resolve('index.html'));
const SRC = html.toString();
const OWNER = (/var OWNER_URL = "([^"]+)"/.exec(SRC) || [])[1];
const FRAN = (/var FRANCHISE_URL = "([^"]+)"/.exec(SRC) || [])[1];
const V9_HEAD = ['branch', 'owner_pin', 'staff_pin', 'report_email', 'updated_at', 'type', 'status', 'label', 'start', 'end', 'act_code', 'act_exp', 'created_by'];

function pad(n) { return (n < 10 ? '0' : '') + n; }
function todayN() { return Math.floor((Date.now() + 7 * 3600 * 1000) / 864e5); }
function be(off) { const c = new Date((todayN() + off) * 864e5); return pad(c.getUTCDate()) + '/' + pad(c.getUTCMonth() + 1) + '/' + (c.getUTCFullYear() + 543); }
function iso(off) { const c = new Date((todayN() + off) * 864e5); return c.getUTCFullYear() + '-' + pad(c.getUTCMonth() + 1) + '-' + pad(c.getUTCDate()); }
// A real saved day always carries its date (persistState keys by st.date). Days -3..-7 on the server; C09 uses -1/-2 on the device.
function day(n, off) { return { date: be(off), sales: [{ ts: 'x', totalAmount: n, totalPieces: 1, items: [{ name: 'ORI', pieces: 1 }] }] }; }
const tokRole = t => { try { return JSON.parse(Buffer.from(String(t).split('.')[0], 'base64').toString()).r; } catch (e) { return ''; } };

// SBR-01 company (owner 2580 / staff 1357) · BK-F01 franchise (owner 3691 / staff 1468) · HQ 8642
function servers() {
  const o = makeEnv('owner', { props: { HQ_PIN: '8642', ENFORCE_TOKEN: 'true' }, files: ['Code-owner.gs', 'Access.gs'] });
  const f = makeEnv('franchise', { props: { ENFORCE_TOKEN: 'true' }, files: ['Code-franchise.gs', 'Access.gs'] });
  [[o, 'SBR-01', 'company', '2580', '1357'], [f, 'BK-F01', 'franchise', '3691', '1468']].forEach(([e, b, type, op, sp]) => {
    e.seedAccess([[b, e.call('pinHash_', b, 'owner', op), e.call('pinHash_', b, 'staff', sp), '', '', type, 'active', 'L ' + b]], V9_HEAD);
    const tok = e.post({ type: 'branch_auth', branch: b, pin: op, kind: type }).token;
    for (let i = 3; i <= 7; i++) e.post({ type: 'state_save', branch: b, token: tok, date: be(-i), state: day(i * 10, -i) });
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
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  const errs = [], R = [], calls = [];
  const ok = (id, cond, info) => R.push([id, !!cond, info === undefined ? '' : String(info)]);
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  const S = servers();
  await p.route('**/*', route => {
    const rq = route.request(), u = rq.url();
    if (u.indexOf('https://script.google.com/') === 0) {
      const env = u.indexOf(OWNER) === 0 ? S.o : u.indexOf(FRAN) === 0 ? S.f : null;
      let ans = { ok: false, error: 'unknown script' };
      if (env) {
        const which = env === S.o ? 'owner' : 'franchise';
        if (rq.method() === 'GET') { const q = Object.fromEntries(new URL(u).searchParams); ans = env.get(q); calls.push({ which, type: q.type, t: q.t, ans }); }
        else { const body = JSON.parse(rq.postData() || '{}'); ans = env.post(body); calls.push({ which, type: body.type, kind: body.kind, branch: body.branch, token: body.token, ans }); }
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
    const pi = await p.$('#loginPinInput'); if (pi) await p.fill('#loginPinInput', pin);
    await p.click('#loginBtn');
    await p.waitForFunction(() => document.getElementById('mainApp').style.display === 'block', null, { timeout: 8000 }).catch(() => { });
    await p.waitForTimeout(500);
  }
  async function logout() { await p.evaluate(() => doLogout()); await p.waitForTimeout(300); }
  // Tap the header chip; if the PIN sheet opens and pin is given, type it and confirm.
  async function chip(pin) {
    await p.click('#roleChip'); await p.waitForTimeout(150);
    if (pin !== undefined && await p.$('#roleModal')) { await p.fill('#roleModalPin', pin); await p.click('#roleModalOk'); await p.waitForTimeout(500); }
  }
  const st = () => p.evaluate(() => {
    var c = document.getElementById('roleChip');
    return {
      role: getRole(), chip: c ? (c.style.display === 'none' ? '' : c.textContent) : 'MISSING', modal: !!document.getElementById('roleModal'),
      msg: (document.getElementById('roleModalMsg') || {}).textContent || '', toast: (document.getElementById('toast') || {}).textContent || '',
      tab: currentTab, elev: !!_elev, bd: _backDate ? _backDate.date : '', sDate: S ? S.date : '', today: todayISO(),
      main: document.getElementById('mainApp').style.display, hq: isHQMode(),
      stored: (getTokens()[currentBranch] || {}), sent: currentBranch ? getTokenFor(currentBranch) : '',
      bdCard: !!document.querySelector('#backDateEntry .card'), bdPin: !!document.querySelector('#page-close input[type=password]'),
      settings: !!document.querySelector('#ownerSettings .card'), asStaff: localStorage.getItem('puff10_asStaff') || ''
    };
  });
  const idle = min => p.evaluate(m => { _lastAct = Date.now() - m * 60000; idleTick(); }, min);
  const lsHas = v => p.evaluate(x => { for (var i = 0; i < localStorage.length; i++) { if ((localStorage.getItem(localStorage.key(i)) || '').indexOf(x) >= 0) return true; } return false; }, v);

  try {
    await p.goto(base); await p.waitForTimeout(600);

    // ── C01 staff login: 👤 chip, no back-date, no HQ PIN field, history refused ──
    await login('company', 'SBR-01', '1357');
    await p.evaluate(() => go('close')); await p.waitForTimeout(200);
    let s = await st();
    const h1 = await p.evaluate(() => { go('hist'); return currentTab; });
    ok('C01 staff login: chip "👤 พนักงาน" · no back-date card · no PIN field on ปิดยอด · ประวัติ refused',
      s.role === 'staff' && s.chip === '👤 พนักงาน' && !s.bdCard && !s.bdPin && h1 !== 'hist' && tokRole(s.stored.token) === 'staff', JSON.stringify([s, h1]));

    // ── C02 offline: tells, no sheet, no request ──
    calls.length = 0;
    await ctx.setOffline(true);
    await chip();
    s = await st();
    await ctx.setOffline(false);
    ok('C02 offline → "ต้องต่อเน็ตเพื่อสลับเป็นเจ้าของ", no PIN sheet, no request', !s.modal && s.toast.indexOf('ต้องต่อเน็ต') >= 0 && s.role === 'staff' && calls.length === 0, JSON.stringify([s, calls.length]));

    // ── C03 wrong PIN · C04 staff PIN typed into the owner sheet ──
    await chip('9999');
    s = await st();
    ok('C03 wrong PIN → "รหัสไม่ถูกต้อง" in the sheet, sheet stays, still staff', s.modal && s.msg === 'รหัสไม่ถูกต้อง' && s.role === 'staff', JSON.stringify(s));
    await p.fill('#roleModalPin', '1357'); await p.click('#roleModalOk'); await p.waitForTimeout(500);
    s = await st();
    ok('C04 staff PIN → "รหัสนี้เป็นรหัสพนักงาน — ใช้รหัสเจ้าของ", still staff', s.modal && s.msg.indexOf('รหัสนี้เป็นรหัสพนักงาน') === 0 && s.role === 'staff' && !s.elev, JSON.stringify(s));
    await p.click('#roleModal .abtn-outline'); await p.waitForTimeout(100);

    // ── C05 owner PIN → owner in memory only ──
    const stored0 = (await st()).stored.token;
    calls.length = 0;
    await chip('2580');
    s = await st();
    const auth5 = calls.filter(c => c.type === 'branch_auth');
    ok('C05 owner PIN → chip "👑 เจ้าของ", sheet closed · branch_auth on Owner with kind company · real server role owner',
      s.role === 'owner' && s.chip === '👑 เจ้าของ' && !s.modal && auth5.length === 1 && auth5[0].which === 'owner' && auth5[0].kind === 'company' && tokRole(s.sent) === 'owner',
      JSON.stringify([s.role, s.chip, auth5.map(c => [c.which, c.kind])]));
    ok('C06 owner token kept in memory only: stored token unchanged (staff), owner token in no localStorage value',
      s.stored.token === stored0 && s.stored.role === 'staff' && s.sent !== stored0 && !(await lsHas(s.sent)), '');

    // ── C07 owner rights work against the real server: history (state_range owner_only) + back-date card without PIN ──
    calls.length = 0;
    await p.evaluate(([a, z]) => { go('hist'); document.getElementById('hcMonth').value = ''; document.getElementById('hcFrom').value = a; document.getElementById('hcTo').value = z; document.getElementById('hcLoad').click(); }, [iso(-7), iso(-3)]);
    await p.waitForTimeout(600);
    const r7 = calls.filter(c => c.type === 'state_range'), open7 = await p.evaluate(() => cloudHistOpen());
    await p.evaluate(() => go('close')); await p.waitForTimeout(200);
    s = await st();
    ok('C07 switched owner: ☁ history loads from the real server with the owner token · back-date card, no PIN field',
      open7 && r7.length === 1 && r7[0].ans.ok && r7[0].ans.states.length === 5 && tokRole(r7[0].t) === 'owner' && s.bdCard && !s.bdPin,
      JSON.stringify([open7, r7.map(c => c.ans.error || c.ans.states.length), s.bdCard, s.bdPin]));

    // ── C08 ONE idle timer: 14 min still owner, 16 min → staff, history page left, cloud set dropped ──
    await p.evaluate(() => go('hist'));
    await idle(14);
    const s14 = await st();
    await idle(16);
    s = await st();
    const open8 = await p.evaluate(() => cloudHistOpen());
    ok('C08 idle 14 min = owner · 16 min = staff + toast, ประวัติ → home, cloud history dropped, stored staff token kept',
      s14.role === 'owner' && s.role === 'staff' && s.chip === '👤 พนักงาน' && s.tab === 'home' && !open8 && s.toast.indexOf('ไม่ได้ใช้งาน 15 นาที') >= 0 && s.stored.token === stored0,
      JSON.stringify([s14.role, s.role, s.tab, open8, s.toast]));

    // ── C09 idle revert while a past day is open → back to today (data already saved) ──
    await chip('2580');
    await p.evaluate(() => {   // yesterday-2 closed → back-date offers -1
      var c = newState(currentBranch); c.date = shiftDateStr(todayISO(), -2); c.is_closed = true;
      localStorage.setItem(stateKey(currentBranch, c.date), JSON.stringify(c)); go('close');
    });
    await p.waitForTimeout(150);
    await p.evaluate(() => {
      var bt = [].filter.call(document.querySelectorAll('#backDateEntry button[data-date]'), function (x) { return !x.disabled; })[0];
      bt.click(); document.querySelector('#backDateEntry input[type=text]').value = 'ลืมบันทึกเมื่อวาน';
      [].filter.call(document.querySelectorAll('#backDateEntry button'), function (x) { return x.textContent === 'เริ่มลงยอดย้อนหลัง'; })[0].click();
    });
    const bd9 = (await st()).bd;
    await idle(16);
    s = await st();
    ok('C09 owner opened yesterday (back-date) → idle revert → back-date closed, S = today, home, staff',
      bd9 === be(-1) && s.bd === '' && s.sDate === s.today && s.tab === 'home' && s.role === 'staff', JSON.stringify([bd9, s.bd, s.sDate, s.tab, s.role]));

    // ── C10 start button re-checks the role at click time ──
    await chip('2580');
    await p.evaluate(() => go('close')); await p.waitForTimeout(150);
    const c10 = await p.evaluate(() => {
      var bt = [].filter.call(document.querySelectorAll('#backDateEntry button[data-date]'), function (x) { return !x.disabled; })[0];
      bt.click(); document.querySelector('#backDateEntry input[type=text]').value = 'ทดสอบสิทธิ์';
      var start = [].filter.call(document.querySelectorAll('#backDateEntry button'), function (x) { return x.textContent === 'เริ่มลงยอดย้อนหลัง'; })[0];
      _elev = null;   // role gone, screen not re-rendered yet
      start.click();
      return { bd: _backDate, toast: document.getElementById('toast').textContent, card: !!document.querySelector('#backDateEntry .card') };
    });
    ok('C10 role dropped between render and tap → start refused ("🔒 เฉพาะเจ้าของร้าน"), card removed', c10.bd === null && c10.toast === '🔒 เฉพาะเจ้าของร้าน' && !c10.card, JSON.stringify(c10));

    // ── C11 tap 👑 while switched → staff at once · C12 reload → staff (memory only) ──
    await chip('2580');
    const before11 = (await st()).role;
    await chip();
    s = await st();
    ok('C11 tap 👑 while switched → staff at once, no PIN asked', before11 === 'owner' && s.role === 'staff' && !s.modal && s.toast === 'กลับเป็นพนักงานแล้ว', JSON.stringify([before11, s.role, s.toast]));
    await chip('2580');
    await p.reload(); await p.waitForTimeout(600);
    await login('company', 'SBR-01', '');
    s = await st();
    ok('C12 reload while switched → session resumes as staff (no owner token survived)', s.main === 'block' && s.role === 'staff' && s.chip === '👤 พนักงาน' && !s.elev, JSON.stringify(s));

    // ── C13 server refuses the switched token (owner PIN changed) → back to staff, still logged in ──
    await chip('2580');
    await p.evaluate(() => handleAuthFail('SBR-01'));
    s = await st();
    ok('C13 auth failure on the switched token → staff, still in the app, stored staff token kept', s.role === 'staff' && s.main === 'block' && s.stored.token === stored0 && s.toast.indexOf('สิทธิ์เจ้าของหมดอายุ') >= 0, JSON.stringify(s));

    // ── C14 switch belongs to one branch ──
    await chip('2580');
    const c14 = await p.evaluate(() => { setBranch('TBK-02'); var a = !!_elev; setBranch('SBR-01'); return { other: a, back: getRole() }; });
    ok('C14 another branch opened on this device → owner switch dropped', !c14.other && c14.back === 'staff', JSON.stringify(c14));
    await logout();

    // ── C15 owner-PIN login → 👑 · handed to staff survives reload · PIN brings owner back · owner-PIN login clears it ──
    await login('company', 'SBR-01', '2580');
    const s15a = await st();
    await chip();
    const s15b = await st();
    await p.reload(); await p.waitForTimeout(600);
    await login('company', 'SBR-01', '');
    const s15c = await st();
    await chip('2580');
    const s15d = await st();
    await idle(16);
    const s15e = await st();
    await logout();
    await login('company', 'SBR-01', '2580');
    const s15f = await st();
    ok('C15 owner login 👑 → tap = staff (asStaff) → reload still staff → owner PIN = owner → idle = staff → owner-PIN login = owner again',
      s15a.role === 'owner' && s15a.chip === '👑 เจ้าของ' && s15b.role === 'staff' && s15b.asStaff.indexOf('SBR-01') >= 0 && s15c.role === 'staff' &&
      s15d.role === 'owner' && s15e.role === 'staff' && s15f.role === 'owner' && s15f.asStaff.indexOf('SBR-01') < 0,
      JSON.stringify([s15a.role, s15b.role, s15b.asStaff, s15c.role, s15d.role, s15e.role, s15f.role, s15f.asStaff]));
    await logout();

    // ── C16 franchise: owner settings only after the switch, real server answers the switched token ──
    await login('franchise', 'BK-F01', '1468');
    await p.evaluate(() => go('close')); await p.waitForTimeout(200);
    const s16a = await st();
    calls.length = 0;
    await chip('3691');
    await p.evaluate(() => go('close')); await p.waitForTimeout(500);
    const s16b = await st(), cfg = calls.filter(c => c.type === 'get_branch_config'), au = calls.filter(c => c.type === 'branch_auth');
    ok('C16 franchise staff: no owner settings · switch (Franchise script, kind franchise) → settings card, real get_branch_config ok',
      !s16a.settings && s16b.role === 'owner' && s16b.settings && au.length === 1 && au[0].which === 'franchise' && au[0].kind === 'franchise' &&
      cfg.length >= 1 && cfg.every(c => c.which === 'franchise' && c.ans.ok === true),
      JSON.stringify([s16a.settings, s16b.settings, au.map(c => [c.which, c.kind]), cfg.map(c => c.ans)]));
    await logout();

    // ── C17 HQ: no chip · idle 4 min stays · 6 min → logged out, HQ token gone ──
    await p.evaluate(() => { _elev = { branch: 'SBR-01', token: 'LEFTOVER' }; });   // contract: HQ entry itself drops a switch (not only logout)
    await p.click('#loginHQ'); await p.waitForTimeout(300);
    await p.fill('#page-hq input', '8642'); await p.click('#page-hq button'); await p.waitForTimeout(600);
    await p.click('#page-hq [data-hqbranch="SBR-01"]'); await p.waitForTimeout(500);
    const s17a = await st();
    await idle(4);
    const s17b = await st();
    await idle(6);
    s = await st();
    const tok17 = await p.evaluate(() => hqToken());
    ok('C17 HQ: entry drops any owner switch · chip hidden · idle 4 min = still HQ · 5+ min → login screen, HQ mode off, HQ token cleared',
      s17a.hq && s17a.chip === '' && !s17a.elev && s17b.hq && s17b.main === 'block' && !s.hq && s.main === 'none' && tok17 === '' && s.toast.indexOf('ออกจากโหมด HQ') === 0,
      JSON.stringify([s17a.hq, s17a.chip, s17b.hq, s.hq, s.main, tok17, s.toast]));

    // ── C18 static checks ──
    const added = cp.execSync('git diff -U0 ' + (process.env.C1_BASE || '9e72e20') + ' -- index.html', { encoding: 'utf8' }).split('\n')
      .filter(l => l.indexOf('+') === 0 && l.indexOf('+++') !== 0);
    const bad = added.filter(l => /\blet |\bconst |=>|`|innerHTML/.test(l));
    ok('C18 HQ PIN gone from back-date (no backDateNeedsHQPin / "HQ PIN" field) · exactly one idle setInterval · added lines clean',
      SRC.indexOf('backDateNeedsHQPin') < 0 && SRC.indexOf('placeholder: "HQ PIN"') < 0 && (SRC.match(/setInterval\(idleTick/g) || []).length === 1 && bad.length === 0 && added.length > 0,
      JSON.stringify([added.length, bad.slice(0, 3)]));
  } catch (e) { ok('C-CRASH stopped', false, String(e && e.message || e).split('\n')[0]); }

  let pass = 0;
  R.forEach(r => { console.log((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[2] && !r[1] ? '  [' + r[2] + ']' : '')); if (r[1]) pass++; });
  console.log('console errors: ' + errs.length + (errs.length ? '\n  ' + errs.join('\n  ') : ''));
  const all = pass === R.length && !errs.length;
  console.log('RESULT ' + pass + '/' + R.length + (all ? ' ALL PASS' : ' — NOT PASSING'));
  await b.close(); srv.close();
  process.exit(all ? 0 : 1);
})();
