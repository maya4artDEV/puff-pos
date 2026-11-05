// test-0018c2.js — 0018-c2 client: first-time activation (8-digit code → owner PIN + staff PIN) + PIN help sheet.
// Runs the app against the REAL server code (gs/Code-*.gs + gs/Access.gs in gs/test/gas-stub.js), ENFORCE_TOKEN + REQUIRE_PIN on.
// K01 compares the client PIN rules (pinRuleCode) with the server's pinRule_ on EVERY 4–6 digit PIN (cross-boundary rule).
// Run from repo root:  node tests/test-0018c2.js
//   PUFF_HTML = app file to test (default index.html) · C2_BASE = git ref for the added-lines check (default eded498 = c1)
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

// Pending rows with an activation code: SBR-01 company 12345678 · BK-F01 franchise 87654321 · SBR-02 company EXPIRED 11223344
// BK-F02 franchise pending with no PIN and no code (login → "pending").
const CODE_CO = '12345678', CODE_FR = '87654321', CODE_OLD = '11223344';
function servers() {
  const o = makeEnv('owner', { props: { HQ_PIN: '8642', ENFORCE_TOKEN: 'true', REQUIRE_PIN: 'true' }, files: ['Code-owner.gs', 'Access.gs'] });
  const f = makeEnv('franchise', { props: { ENFORCE_TOKEN: 'true', REQUIRE_PIN: 'true' }, files: ['Code-franchise.gs', 'Access.gs'] });
  const later = String(Date.now() + 86400000), gone = String(Date.now() - 1000);
  o.seedAccess([
    ['SBR-01', '', o.call('pinHash_', 'SBR-01', 'staff', '1357'), '', '', 'company', 'pending', 'L SBR-01', '', '', o.call('actHash_', 'SBR-01', CODE_CO), later, ''],
    ['TBK-02', '', '', '', '', 'company', 'pending', 'L TBK-02', '', '', o.call('actHash_', 'TBK-02', CODE_OLD), gone, '']
  ], V9_HEAD);
  f.seedAccess([
    ['BK-F01', '', '', '', '', 'franchise', 'pending', 'L BK-F01', '', '', f.call('actHash_', 'BK-F01', CODE_FR), later, ''],
    ['BK-F02', '', '', '', '', 'franchise', 'pending', 'L BK-F02', '', '', '', '', '']
  ], V9_HEAD);
  return { o, f };
}
const row = (e, b) => { e.call('clearAccessCache_'); return e.call('accessRow_', b); };

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
  let fake = null;   // 'v8' → answer {ok:true} (v8 server, unknown type) · 'abort' → network failure
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
        if (fake === 'abort' && body.type === 'branch_activate') return route.abort('failed');
        if (fake === 'v8' && body.type === 'branch_activate') ans = { ok: true };
        else if (env) ans = env.post(body);
        calls[calls.length - 1].ans = ans;
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(ans) });
    }
    if (u.indexOf(base) === 0) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });

  async function names(on) {
    await p.fill('#loginName', on ? 'Test Tester' : ''); await p.fill('#loginNick', on ? 'T' : ''); await p.fill('#loginPhone', on ? '0800000000' : '');
  }
  async function pick(tab, branch) {
    await p.click('#loginTabs [data-tab="' + tab + '"]');
    if (tab === 'company') await p.selectOption('#loginBranchSel', branch); else await p.fill('#loginFreeInput', branch);
  }
  async function login(tab, branch, pin) {
    await names(true); await pick(tab, branch);
    await p.fill('#loginPinInput', pin);
    await p.click('#loginBtn');
    await p.waitForFunction(() => document.getElementById('mainApp').style.display === 'block', null, { timeout: 6000 }).catch(() => { });
    await p.waitForTimeout(400);
  }
  async function logout() { await p.evaluate(() => doLogout()); await p.waitForTimeout(300); }
  const actLink = tab => '.lt-pane[data-ltpane="' + tab + '"] [data-login="activate"]';
  async function openAct(tab) { await p.click(actLink(tab)); await p.waitForTimeout(150); }
  async function fillAct(code, o1, o2, s1, s2) {
    await p.fill('#actCode', code); await p.fill('#actOwner1', o1); await p.fill('#actOwner2', o2); await p.fill('#actStaff1', s1); await p.fill('#actStaff2', s2);
    await p.click('#actOk'); await p.waitForTimeout(600);
  }
  const st = () => p.evaluate(() => {
    var c = document.getElementById('roleChip');
    return {
      act: !!document.getElementById('actModal'), help: !!document.getElementById('pinHelpModal'),
      msg: (document.getElementById('actMsg') || {}).textContent || '', toast: (document.getElementById('toast') || {}).textContent || '',
      main: document.getElementById('mainApp').style.display, branch: currentBranch,
      role: currentBranch ? getRole() : '', chip: c ? (c.style.display === 'none' ? '' : c.textContent) : 'MISSING',
      stored: currentBranch ? (getTokens()[currentBranch] || {}) : {}, recent: localStorage.getItem('puff10_recentBranches') || ''
    };
  });
  const acts = () => calls.filter(c => c.type === 'branch_activate');

  try {
    await p.goto(base); await p.waitForTimeout(600);

    // ── K01 client pinRuleCode = server pinRule_ on every 4–6 digit PIN + edge strings ──
    const pins = [];
    for (let len = 4; len <= 6; len++) for (let n = 0; n < Math.pow(10, len); n++) pins.push(String(n).padStart(len, '0'));
    const edge = ['', '123', '1234567', '12a4', ' 2580', '2580 ', '25.80', '-2580', '٢٥٨٠', '0', '00000000'];
    const RC = { format: 'f', repeat: 'r', sequence: 's' };
    const t0 = Date.now();
    const srvStr = pins.concat(edge).map(x => { const r = S.o.call('pinRule_', x); return r ? (RC[r.rule] || '?') : '.'; }).join('');
    const cliStr = await p.evaluate(list => list.map(function (x) { var c = pinRuleCode(x); return c === 'format' ? 'f' : c === 'repeat' ? 'r' : c === 'sequence' ? 's' : c ? '?' : '.'; }).join(''), pins.concat(edge));
    let firstDiff = -1; for (let i = 0; i < srvStr.length; i++) if (srvStr[i] !== cliStr[i]) { firstDiff = i; break; }
    const cnt = s => ({ ok: s.split('.').length - 1, f: s.split('f').length - 1, r: s.split('r').length - 1, s: s.split('s').length - 1 });
    ok('K01 pinRuleCode = server pinRule_ on all ' + pins.length + ' PINs of 4–6 digits + ' + edge.length + ' edge strings',
      srvStr.length === cliStr.length && firstDiff < 0 && cnt(srvStr).r === 30 && cnt(srvStr).s > 0,
      firstDiff < 0 ? JSON.stringify(cnt(srvStr)) + ' · ' + (Date.now() - t0) + ' ms' : 'first diff ' + pins.concat(edge)[firstDiff] + ' srv=' + srvStr[firstDiff] + ' cli=' + cliStr[firstDiff]);
    const same = await p.evaluate(() => [pinRuleCode('2580', '2580'), pinRuleCode('2580', '1357'), pinRuleCode('1234', '1234'), pinRuleError('1111'), pinRuleError('2580')]);
    ok('K01b same-as-other → "same" (only after format/repeat/sequence pass, server order) · pinRuleError text / ""',
      same[0] === 'same' && same[1] === '' && same[2] === 'sequence' && same[3].indexOf('1111') >= 0 && same[4] === '', JSON.stringify(same));

    // ── K02 links: activation in company + franchise panes only · help link on the login screen ──
    const vis = await p.evaluate(() => {
      function shown(sel) { var e = document.querySelector(sel); return !!(e && e.offsetParent !== null); }
      var r = {};
      ['company', 'franchise', 'event'].forEach(function (t) { setLoginTab(t); r[t] = shown('.lt-pane.active [data-login="activate"]'); });
      r.help = shown('#loginScreen [data-login="help"]');
      r.eventLinks = document.querySelectorAll('.lt-pane[data-ltpane="event"] [data-login]').length;
      setLoginTab('company');
      return r;
    });
    ok('K02 "เปิดใช้งานสาขาครั้งแรก" visible on company + franchise tabs, not on Event · "❔ รหัสมาจากไหน?" visible',
      vis.company && vis.franchise && !vis.event && vis.eventLinks === 0 && vis.help, JSON.stringify(vis));

    // ── K03 no branch picked → toast, no sheet (company + franchise) ──
    await names(true);
    await p.click('#loginTabs [data-tab="company"]'); await p.selectOption('#loginBranchSel', '');
    await openAct('company'); let s1 = await st();
    await p.click('#loginTabs [data-tab="franchise"]'); await p.fill('#loginFreeInput', '');
    await openAct('franchise'); let s2 = await st();
    ok('K03 no branch → "เลือกสาขาก่อน" / "พิมพ์รหัสสาขาก่อน", no sheet',
      !s1.act && s1.toast.indexOf('เลือกสาขาก่อน') >= 0 && !s2.act && s2.toast.indexOf('พิมพ์รหัสสาขาก่อน') >= 0, JSON.stringify([s1.toast, s2.toast]));

    // ── K04 name / nick / phone missing → toast, no sheet ──
    await names(false); await pick('company', 'SBR-01');
    await openAct('company'); s1 = await st();
    ok('K04 name fields empty → "กรอกชื่อ ชื่อเล่น และเบอร์ด้านบนก่อน", no sheet', !s1.act && s1.toast.indexOf('กรอกชื่อ') >= 0, s1.toast);

    // ── K05 sheet opens ON TOP of the login screen (tap reaches it) and names the branch ──
    await names(true); await pick('company', 'SBR-01');
    await openAct('company');
    const top = await p.evaluate(() => {
      var o = document.getElementById('actOk'); if (!o) return 'no sheet';
      o.scrollIntoView(); var r = o.getBoundingClientRect();
      var hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { onTop: hit === o, head: document.querySelector('#actModal .modal-sheet').textContent.slice(0, 80) };
    });
    ok('K05 activation sheet is on top of the login screen (elementFromPoint = its button) · shows "สาขา SBR-01"',
      top.onTop === true && top.head.indexOf('สาขา SBR-01') >= 0, JSON.stringify(top));

    // ── K06 client checks: one message each, NO request ──
    calls.length = 0;
    const cases = [
      ['1234567', '2580', '2580', '1357', '1357', 'รหัสเปิดใช้งานต้องเป็นตัวเลข 8 หลัก'],
      ['1234 567a', '2580', '2580', '1357', '1357', 'รหัสเปิดใช้งานต้องเป็นตัวเลข 8 หลัก'],
      [CODE_CO, '1234', '1234', '1357', '1357', 'รหัสเจ้าของ: ห้ามใช้เลขเรียงกัน'],
      [CODE_CO, '7777', '7777', '1357', '1357', 'รหัสเจ้าของ: ห้ามใช้เลขเดียวกันทั้งหมด'],
      [CODE_CO, '258', '258', '1357', '1357', 'รหัสเจ้าของ: ต้องเป็นตัวเลข 4–6 หลัก'],
      [CODE_CO, '2580', '2581', '1357', '1357', 'ยืนยันรหัสเจ้าของไม่ตรงกัน'],
      [CODE_CO, '2580', '2580', '2580', '2580', 'รหัสเจ้าของกับรหัสพนักงานต้องไม่ซ้ำกัน'],
      [CODE_CO, '2580', '2580', '9876', '9876', 'รหัสพนักงาน: ห้ามใช้เลขเรียงกัน'],
      [CODE_CO, '2580', '2580', '1357', '1358', 'ยืนยันรหัสพนักงานไม่ตรงกัน']
    ];
    const got6 = [];
    for (const c of cases) {   // a check that lets the form through activates the branch → the next case has no sheet: record it, stop
      try { await fillAct(c[0], c[1], c[2], c[3], c[4]); const s = await st(); got6.push([s.msg.indexOf(c[5]) === 0 && s.act, s.msg]); }
      catch (e) { got6.push([false, 'case ' + c[5] + ': sheet gone (' + e.message.slice(0, 40) + ')']); break; }
    }
    ok('K06 client checks (code 8 digits · owner rule · owner confirm · same · staff rule · staff confirm) → message, sheet stays, 0 requests',
      got6.every(g => g[0]) && acts().length === 0, JSON.stringify(got6.filter(g => !g[0])) + ' req=' + acts().length);

    // ── K07 wrong code → server code_bad text, row still pending · K08 expired code ──
    calls.length = 0;
    await fillAct('99999999', '2580', '2580', '1357', '1357');
    s1 = await st();
    ok('K07 wrong code → "รหัสเปิดใช้งานไม่ถูกต้อง" in the sheet · 1 request · SBR-01 still pending, no owner PIN',
      s1.act && s1.msg === 'รหัสเปิดใช้งานไม่ถูกต้อง' && acts().length === 1 && row(S.o, 'SBR-01').status === 'pending' && !row(S.o, 'SBR-01').owner_pin, s1.msg);
    await p.click('#actModal .abtn-outline'); await p.waitForTimeout(100);
    await pick('company', 'TBK-02'); await openAct('company');
    await fillAct(CODE_OLD, '2580', '2580', '1357', '1357');
    s1 = await st();
    ok('K08 expired code → "รหัสเปิดใช้งานหมดอายุ — ขอรหัสใหม่จาก HQ"', s1.act && s1.msg.indexOf('หมดอายุ') >= 0, s1.msg);
    await p.click('#actModal .abtn-outline'); await p.waitForTimeout(100);

    // ── K09 company activation: code with a space → Owner script, kind company → app opens as OWNER ──
    calls.length = 0;
    await pick('company', 'SBR-01'); await openAct('company');
    await fillAct('1234 5678', '2580', '2580', '4682', '4682');
    await p.waitForFunction(() => document.getElementById('mainApp').style.display === 'block', null, { timeout: 6000 }).catch(() => { });
    await p.waitForTimeout(400);
    s1 = await st();
    const a9 = acts(), r9 = row(S.o, 'SBR-01');
    ok('K09 activation → branch_activate on Owner {kind company, code 8 digits} · sheet closed · app open on SBR-01 as 👑 owner (real server token)',
      a9.length === 1 && a9[0].which === 'owner' && a9[0].kind === 'company' && a9[0].body.code === CODE_CO && !s1.act && s1.main === 'block' &&
      s1.branch === 'SBR-01' && s1.role === 'owner' && s1.chip === '👑 เจ้าของ' && tokRole(s1.stored.token) === 'owner',
      JSON.stringify([a9.map(c => [c.which, c.kind, c.ans && c.ans.ok]), s1.main, s1.role, s1.chip]));
    ok('K09b server row: active, owner + staff = hashes of the new PINs, code cleared',
      r9.status === 'active' && r9.owner_pin === S.o.call('pinHash_', 'SBR-01', 'owner', '2580') && r9.staff_pin === S.o.call('pinHash_', 'SBR-01', 'staff', '4682') && !r9.act_code, r9.status);

    // ── K10 the new PINs log in: staff PIN → staff · old shared staff PIN refused · owner PIN → owner ──
    await logout(); await login('company', 'SBR-01', '4682'); s1 = await st();
    await logout(); await login('company', 'SBR-01', '1357'); s2 = await st();
    await logout(); await login('company', 'SBR-01', '2580'); const s3 = await st();
    ok('K10 new staff PIN → 👤 staff · old staff PIN 1357 → refused · new owner PIN → 👑 owner',
      s1.role === 'staff' && s1.chip === '👤 พนักงาน' && s2.main !== 'block' && s2.toast === 'รหัสไม่ถูกต้อง' && s3.role === 'owner',
      JSON.stringify([s1.role, s2.main, s2.toast, s3.role]));

    // ── K11 the code works once ──
    await logout(); await pick('company', 'SBR-01'); await openAct('company');
    await fillAct(CODE_CO, '3690', '3690', '4682', '4682'); s1 = await st();
    ok('K11 same code again → "รหัสเปิดใช้งานไม่ถูกต้อง", owner PIN unchanged',
      s1.act && s1.msg === 'รหัสเปิดใช้งานไม่ถูกต้อง' && row(S.o, 'SBR-01').owner_pin === S.o.call('pinHash_', 'SBR-01', 'owner', '2580'), s1.msg);
    await p.click('#actModal .abtn-outline'); await p.waitForTimeout(100);

    // ── K13 v8 server answers {ok:true} to an unknown type → NOT treated as activated ──
    fake = 'v8'; calls.length = 0;
    await pick('franchise', 'BK-F01'); await openAct('franchise');
    await fillAct(CODE_FR, '3691', '3691', '1468', '1468'); s1 = await st();
    const tok13 = await p.evaluate(() => getTokens()['BK-F01'] || null);
    ok('K13 v8 answer {ok:true} without token → "ยังไม่รองรับ (รออัปเดต)", sheet stays, no token stored, login screen',
      s1.act && s1.msg.indexOf('ยังไม่รองรับ') >= 0 && !tok13 && s1.main !== 'block', JSON.stringify([s1.msg, tok13]));

    // ── K14 network failure → message, exactly ONE request (no automatic retry) ──
    fake = 'abort'; calls.length = 0;
    await p.click('#actOk'); await p.waitForTimeout(800); s1 = await st();
    ok('K14 network failure → "เชื่อมต่อไม่ได้ …" with the "already activated?" hint · 1 request (no retry) · button usable again',
      s1.act && s1.msg.indexOf('เชื่อมต่อไม่ได้') === 0 && s1.msg.indexOf('รหัสเจ้าของที่เพิ่งตั้ง') >= 0 && acts().length === 1 &&
      await p.evaluate(() => !document.getElementById('actOk').disabled), JSON.stringify([s1.msg, acts().length]));
    fake = null;

    // ── K12 franchise activation → Franchise script, kind franchise · recent chip ──
    calls.length = 0;
    await p.click('#actOk'); await p.waitForTimeout(600);
    await p.waitForFunction(() => document.getElementById('mainApp').style.display === 'block', null, { timeout: 6000 }).catch(() => { });
    await p.waitForTimeout(300);
    s1 = await st();
    const a12 = acts();
    ok('K12 franchise activation → Franchise script {kind franchise} · app open on BK-F01 as owner · BK-F01 in recent chips · row active',
      a12.length === 1 && a12[0].which === 'franchise' && a12[0].kind === 'franchise' && s1.branch === 'BK-F01' && s1.role === 'owner' &&
      s1.recent.indexOf('BK-F01') >= 0 && row(S.f, 'BK-F01').status === 'active', JSON.stringify([a12.map(c => [c.which, c.kind]), s1.branch, s1.role, s1.recent]));

    // ── K15 server answers → Thai (weak_pin names field + rule · same_pin · locked_out · code_expired) ──
    const t15 = await p.evaluate(() => [
      activateErrorText({ ok: false, error: 'weak_pin', rule: 'sequence', field: 'staff' }),
      activateErrorText({ ok: false, error: 'weak_pin', rule: 'repeat', field: 'owner' }),
      activateErrorText({ ok: false, error: 'weak_pin', rule: 'format' }),
      activateErrorText({ ok: false, error: 'same_pin' }),
      activateErrorText({ ok: false, error: 'locked_out' }),
      activateErrorText({ ok: false, error: 'code_expired' }),
      activateErrorText({ ok: false, error: 'not_found' })]);
    ok('K15 server errors → one Thai line each (field + rule / same / locked 10 min / expired / not found)',
      t15[0] === 'รหัสพนักงาน: ห้ามใช้เลขเรียงกัน เช่น 1234 หรือ 4321' && t15[1].indexOf('รหัสเจ้าของ: ห้ามใช้เลขเดียวกัน') === 0 &&
      t15[2] === 'ต้องเป็นตัวเลข 4–6 หลัก' && t15[3] === 'รหัสเจ้าของกับรหัสพนักงานต้องไม่ซ้ำกัน' && t15[4].indexOf('รอ 10 นาที') >= 0 &&
      t15[5].indexOf('หมดอายุ') >= 0 && t15[6].indexOf('ไม่พบสาขานี้') === 0, JSON.stringify(t15));

    // ── K16 help sheet: from the login screen (5 rows, SPEC §9) and on top of the activation sheet ──
    await logout();
    await p.click('#loginScreen [data-login="help"]'); await p.waitForTimeout(150);
    const h1 = await p.evaluate(() => {
      var m = document.getElementById('pinHelpModal'); if (!m) return null;
      var c = m.querySelector('button.abtn-outline'); c.scrollIntoView(); var r = c.getBoundingClientRect();
      return { rows: m.querySelectorAll('tbody tr').length, txt: m.textContent, onTop: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === c };
    });
    let both = {}, after = {};
    try {   // a dead help link must fail K16 itself, not crash later steps
      await p.click('#pinHelpModal .abtn-outline', { timeout: 2000 }); await p.waitForTimeout(100);
      await pick('company', 'TBK-02'); await openAct('company');
      await p.click('#actModal .login-help'); await p.waitForTimeout(150);
      both = await st();
      await p.click('#pinHelpModal .abtn-outline', { timeout: 2000 }); await p.waitForTimeout(100);
      after = await st();
    } catch (e) { after.err = e.message.slice(0, 60); }
    ok('K16 help: 5 rows (พนักงาน · เจ้าของ · เปิดใช้งาน 8 หลัก ใช้ได้ 7 วัน · Event · เปิดงานใหม่), on top · from the activation sheet: opens over it, closing it keeps the sheet',
      h1 && h1.rows === 5 && h1.onTop && ['รหัสพนักงาน', 'รหัสเจ้าของ', 'ใช้ได้ 7 วัน', 'รหัส Event', 'รหัสเปิดงานใหม่'].every(x => h1.txt.indexOf(x) >= 0) &&
      both.act && both.help && after.act && !after.help, JSON.stringify([h1 && h1.rows, h1 && h1.onTop, both.help, after.act, after.help, after.err]));
    await p.click('#actModal .abtn-outline'); await p.waitForTimeout(100);

    // ── K17 login on a pending branch → points to activation ──
    await login('franchise', 'BK-F02', '2580'); s1 = await st();
    ok('K17 pending branch login → "ยังไม่เปิดใช้งาน — ใช้ “เปิดใช้งานสาขาครั้งแรก” …"', s1.main !== 'block' && s1.toast.indexOf('เปิดใช้งานสาขาครั้งแรก') >= 0, s1.toast);

    // ── K18 static: added lines vs c1 have no let/const/arrow/template literal/innerHTML · el() unchanged · one login-accept path ──
    const baseSrc = cp.execSync('git show ' + (process.env.C2_BASE || 'eded498') + ':index.html', { encoding: 'utf8', maxBuffer: 64 << 20 });
    const baseSet = new Set(baseSrc.split('\n'));
    const added = SRC.split('\n').filter(l => !baseSet.has(l));
    const bad = added.filter(l => /\blet\s|\bconst\s|=>|`|innerHTML/.test(l));
    const elOf = s => (/function el\(tag, attrs, kids\) \{[\s\S]*?\n        \}/.exec(s) || [''])[0];
    // c3 adds exactly one: replaceOwnerToken (fresh owner token after set_owner_pin; must keep puff10_asStaff → not acceptLogin). test-0018c3 guards it.
    const setTok = (SRC.match(/setToken\(/g) || []).length, setTokBase = (baseSrc.match(/setToken\(/g) || []).length + (SRC.indexOf('function replaceOwnerToken(') >= 0 ? 1 : 0);
    ok('K18 static: ' + added.length + ' added lines without let/const/=>/`/innerHTML · el() byte-identical · setToken( calls not increased (acceptLogin is the one path)',
      added.length > 50 && bad.length === 0 && elOf(SRC) && elOf(SRC) === elOf(baseSrc) && setTok <= setTokBase, JSON.stringify([bad.slice(0, 3), setTok, setTokBase]));

    ok('K19 no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
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
