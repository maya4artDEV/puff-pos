// test-0018d2.js — 0018-d2 client: "+ เปิดงานใหม่" sheet → event_create (Owner) → straight in as owner, or created-only for a future start.
// Runs the app against the REAL server code (gs/Code-owner.gs + gs/Access.gs in gs/test/gas-stub.js), ENFORCE_TOKEN + REQUIRE_PIN on, EVENT_OPEN_PIN 3141.
// Run from repo root:  node tests/test-0018d2.js
//   PUFF_HTML = app file to test (default index.html) · D2_BASE = git ref for the static checks (default 49b49f6 = d1)
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
const KEY_RE = /^E-\d{6}-[A-HJ-NP-Z2-9]{3}$/;

// SBR-01 company + one running event E-RUN "งานวัดหลวง" (PIN 4826) — the label / PIN clash targets.
function servers() {
  const o = makeEnv('owner', { props: { HQ_PIN: '8642', ENFORCE_TOKEN: 'true', REQUIRE_PIN: 'true', EVENT_OPEN_PIN: '3141' }, files: ['Code-owner.gs', 'Access.gs'] });
  const f = makeEnv('franchise', { props: { ENFORCE_TOKEN: 'true', REQUIRE_PIN: 'true' }, files: ['Code-franchise.gs', 'Access.gs'] });
  const t = o.call('todayNum_'), ds = n => o.call('dayStr_', t + n);
  o.seedAccess([
    ['SBR-01', o.call('pinHash_', 'SBR-01', 'owner', '2580'), o.call('pinHash_', 'SBR-01', 'staff', '1357'), '', '', 'company', 'active', 'L SBR-01', '', '', '', '', ''],
    ['E-RUN', o.call('pinHash_', 'E-RUN', 'owner', '4826'), '', '', '', 'event', 'active', 'งานวัดหลวง', ds(-2), ds(2), '', '', 'T (0800000000)']
  ], V9_HEAD);
  f.seedAccess([['BK-F01', f.call('pinHash_', 'BK-F01', 'owner', '3691'), f.call('pinHash_', 'BK-F01', 'staff', '1468'), '', '', 'franchise', 'active', 'L BK-F01', '', '', '', '', '']], V9_HEAD);
  return { o, f, t, ds, iso: n => { const p = ds(n).split('/'); return (+p[2] - 543) + '-' + p[1] + '-' + p[0]; } };
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
  let fake = null;   // 'nocreate' event_create → network failure · 'v8create' event_create → v8 shape {ok:true}, no token
  const ok = (id, cond, info) => R.push([id, !!cond, info === undefined ? '' : String(info)]);
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && m.text().indexOf('net::ERR_FAILED') < 0 && m.text().indexOf('ERR_INTERNET_DISCONNECTED') < 0) errs.push('console: ' + m.text()); });
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
        if (env) ans = env.get(q);
        calls.push({ which, type: q.type, ans });
      } else {
        const body = JSON.parse(rq.postData() || '{}');
        calls.push({ which, type: body.type, kind: body.kind, branch: body.branch, body });
        if (body.type === 'event_create' && fake === 'nocreate') { calls[calls.length - 1].ans = 'ABORT'; return route.abort('failed'); }
        if (body.type === 'event_create' && fake === 'v8create') ans = { ok: true };
        else if (env) ans = env.post(body);
        calls[calls.length - 1].ans = ans;
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(ans) });
    }
    if (u.indexOf(base) === 0) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });

  async function names() { await p.fill('#loginName', 'Test Tester'); await p.fill('#loginNick', 'T'); await p.fill('#loginPhone', '0800000000'); }
  // Setup helpers never throw: a sheet left open by an earlier (mutant) failure is closed first, so only the intended test fails.
  const closeSheets = () => p.evaluate(() => { closeModalById('evCreateModal'); closeModalById('evConfirmModal'); });
  async function evTab() { await closeSheets(); await p.click('#loginTabs [data-tab="event"]', { timeout: 2000 }).catch(() => { }); await p.waitForTimeout(500); }
  async function tap(sel) { try { await p.click(sel, { timeout: 2000 }); await p.waitForTimeout(500); return true; } catch (e) { return false; } }
  async function logout() { await closeSheets(); await p.evaluate(() => doLogout()); await p.waitForTimeout(400); }
  async function openCreate() { await tap('#evCreateLink'); return !!(await p.$('#evCreateModal')); }
  // Fill the sheet straight into the inputs (bypasses min/max/maxlength so the client rules are what is tested).
  // Start is set first + "change" (the end range follows), then end is set without an event. Day offsets relative to the server's today.
  async function fillCreate(o) {
    await p.evaluate(v => {
      var q = function (id) { return document.getElementById(id); };
      if (!q('evcName')) return;
      q('evcName').value = v.label;
      if (v.s !== null) { q('evcStart').value = v.s; q('evcStart').dispatchEvent(new Event('change')); }
      if (v.e !== null) q('evcEnd').value = v.e;
      q('evcPin1').value = v.pin; q('evcPin2').value = v.pin2; q('evcOpenPin').value = v.op;
    }, { label: o.label, s: o.s === undefined ? null : S.iso(o.s), e: o.e === undefined ? null : S.iso(o.e), pin: o.pin, pin2: o.pin2 === undefined ? o.pin : o.pin2, op: o.op });
  }
  async function submit() { try { await p.click('#evcOk', { timeout: 2000 }); } catch (e) { return 'ERR ' + String(e.message).split('\n')[0].slice(0, 60); } await p.waitForTimeout(900); return 'ok'; }
  const st = () => p.evaluate(() => {
    var q = function (id) { return document.getElementById(id); };
    var items = [].map.call(document.querySelectorAll('#loginEventList [data-ev]'), function (x) {
      return { key: x.getAttribute('data-ev'), dis: x.disabled, txt: x.textContent };
    });
    return {
      items: items, sheet: !!q('evCreateModal'), confirm: !!q('evConfirmModal'), msg: (q('evcMsg') || {}).textContent || '',
      okDis: q('evcOk') ? q('evcOk').disabled : null, okTxt: q('evcOk') ? q('evcOk').textContent : '',
      main: q('mainApp').style.display, branch: currentBranch, role: currentBranch ? getRole() : '', hdr: (q('hdrBranch') || {}).textContent || '',
      toast: (q('toast') || {}).textContent || '', tokens: getTokens(), info: getBranchInfoMap(), auth: localStorage.getItem('puff10_branchAuth') || '',
      pick: _loginBranch, tab: _loginTab
    };
  });
  const creates = () => calls.filter(c => c.type === 'event_create');
  const auths = () => calls.filter(c => c.type === 'branch_auth');
  const evKeys = s => Object.keys(s.tokens).filter(k => k !== 'E-RUN' && /^E-/.test(k));
  const VALID = { label: 'งานทดสอบ', s: 0, e: 1, pin: '5937', op: '3141' };
  const w = o => Object.assign({}, VALID, o);

  try {
    await p.goto(base); await p.waitForTimeout(600);

    // ── W01 the link lives in the Event pane only · the pane still has no [data-login] link (c2 K02) ──
    const vis = await p.evaluate(() => {
      function shown() { var e = document.getElementById('evCreateLink'); return !!(e && e.offsetParent !== null); }
      var r = {};
      ['company', 'franchise', 'event'].forEach(function (t) { setLoginTab(t); r[t] = shown(); });
      r.dataLogin = document.querySelectorAll('.lt-pane[data-ltpane="event"] [data-login]').length;
      r.txt = (document.getElementById('evCreateLink') || {}).textContent || '';
      setLoginTab('company');
      return r;
    });
    ok('W01 "+ เปิดงานใหม่" visible on the Event tab only · Event pane has 0 [data-login] links',
      !vis.company && !vis.franchise && vis.event && vis.dataLogin === 0 && vis.txt.indexOf('เปิดงานใหม่') >= 0, JSON.stringify(vis));

    // ── W02 names first (like activation) ──
    await evTab();
    let opened = await openCreate();
    let s = await st();
    ok('W02 name / nick / phone empty → toast "กรอกชื่อ ชื่อเล่น และเบอร์ด้านบนก่อน", no sheet', !opened && s.toast.indexOf('กรอกชื่อ ชื่อเล่น และเบอร์ด้านบนก่อน') >= 0, JSON.stringify([opened, s.toast]));

    // ── W03 defaults + date-picker range: start today (−7…+30) · end = start, ≥ max(start, today−3), ≤ start+30 ──
    await names();
    opened = await openCreate();
    const rng = () => p.evaluate(() => { var a = document.getElementById('evcStart'), z = document.getElementById('evcEnd');
      if (!a || !z) return 'no sheet';
      return [a.value, a.min, a.max, z.value, z.min, z.max, document.getElementById('evcName').getAttribute('inputmode'), document.getElementById('evcPin1').getAttribute('inputmode'), document.getElementById('evcOpenPin').type].join(); });
    const r0 = await rng();
    const setStart = v => p.evaluate(x => { var a = document.getElementById('evcStart'); if (!a) return; a.value = x; a.dispatchEvent(new Event('change')); }, v);
    await setStart(S.iso(-5));
    const r1 = await rng();
    await setStart(S.iso(10));
    const r2 = await rng();
    const onTop = await p.evaluate(() => {   // the sheet must sit OVER the login screen (z-index list) — else invisible on the phone
      var b = document.getElementById('evcOk'); if (!b) return false; b.scrollIntoView({ block: 'center' });
      var r = b.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return t === b;
    });
    ok('W03a the sheet is on top of the login screen (its button is the element under its own centre)', onTop, String(onTop));
    ok('W03 sheet defaults: start = end = today, start range −7…+30 · start −5 → end range today−3…start+30 (end kept) · start +10 → end raised to start · name field = text keyboard, PINs numeric, open PIN hidden',
      opened && r0 === [S.iso(0), S.iso(-7), S.iso(30), S.iso(0), S.iso(0), S.iso(30), 'text', 'numeric', 'password'].join() &&
      r1 === [S.iso(-5), S.iso(-7), S.iso(30), S.iso(0), S.iso(-3), S.iso(25), 'text', 'numeric', 'password'].join() &&
      r2 === [S.iso(10), S.iso(-7), S.iso(30), S.iso(10), S.iso(10), S.iso(40), 'text', 'numeric', 'password'].join(),
      JSON.stringify([opened, r0, r1, r2]));

    // ── W04 client rules: each broken rule → its own Thai line, sheet stays, nothing sent ──
    calls.length = 0;
    const cases = [
      ['a', w({ label: 'ab' }), 'ชื่องานต้องยาว 3–40 ตัว'],
      ['b', w({ label: '=SUM(A1)' }), 'ชื่องานต้องยาว 3–40 ตัว'],
      ['c', w({ label: 'ก'.repeat(41) }), 'ชื่องานต้องยาว 3–40 ตัว'],
      ['d', w({ s: -8, e: -8 }), 'วันเริ่มงาน: ย้อนได้ 7 วัน'],
      ['e', w({ s: 31, e: 31 }), 'วันเริ่มงาน: ย้อนได้ 7 วัน'],
      ['f', w({ s: 2, e: 1 }), 'วันสุดท้าย: ต้องไม่ก่อนวันเริ่ม'],
      ['g', w({ s: 0, e: 31 }), 'วันสุดท้าย: ต้องไม่ก่อนวันเริ่ม'],
      ['h', w({ s: -7, e: -4 }), 'วันสุดท้าย: ย้อนได้ไม่เกิน 3 วัน'],
      ['i', w({ pin: '1234' }), 'รหัสงาน: ห้ามใช้เลขเรียงกัน'],
      ['j', w({ pin: '777' }), 'รหัสงาน: ต้องเป็นตัวเลข 4–6 หลัก'],
      ['k', w({ pin2: '5938' }), 'ยืนยันรหัสงานไม่ตรงกัน'],
      ['l', w({ op: '' }), 'ใส่รหัสเปิดงาน'],
      ['m', w({ pin: '3141' }), 'รหัสงานต้องไม่ซ้ำกับรหัสเปิดงาน']
    ];
    const got4 = [];
    for (const c of cases) { await fillCreate(c[1]); const sr = await submit(); s = await st(); got4.push([c[0], s.msg.indexOf(c[2]) === 0, s.sheet, s.msg, sr]); }
    ok('W04 client rules (name ×3 · start ×2 · end ×3 incl. last day > 3 days ago · PIN ×2 · confirm · open PIN empty · PIN = open PIN) → the right line each, sheet stays, 0 event_create',
      got4.every(g => g[1] && g[2]) && creates().length === 0, JSON.stringify([got4.filter(g => !(g[1] && g[2])), creates().length]));

    // ── W05 server refusals → mapped text, button usable again, sheet stays, nothing stored ──
    calls.length = 0;
    const srvCases = [
      ['open_pin_bad', w({ op: '9999' }), 'รหัสเปิดงานไม่ถูกต้อง'],
      ['label_in_use', w({ label: '  งานวัดหลวง ' }), 'ชื่องานนี้มีงานที่เปิดอยู่ใช้แล้ว'],
      ['pin_in_use', w({ pin: '4826' }), 'รหัสนี้มีงานอื่นใช้อยู่'],
      ['rate_limited', w({}), 'วันนี้เปิดงานครบ 5 งานแล้ว']
    ];
    const got5 = [];
    for (const c of srvCases) {
      if (c[0] === 'rate_limited') S.o.props.EVENT_CREATE_DAY = S.t + '|5';
      await fillCreate(c[1]); await submit(); s = await st();
      const last = creates()[creates().length - 1] || {};
      got5.push([c[0], (last.ans || {}).error, s.msg.indexOf(c[2]) === 0, s.sheet, s.okDis === false && s.okTxt === 'เปิดงาน', s.msg]);
      if (c[0] === 'rate_limited') delete S.o.props.EVENT_CREATE_DAY;
    }
    ok('W05 server says open_pin_bad / label_in_use (spaces trimmed) / pin_in_use / rate_limited → Thai line from the D-d-4 table · button back to "เปิดงาน" · sheet stays · no event stored',
      got5.every(g => g[0] === g[1] && g[2] && g[3] && g[4]) && creates().length === 4 && creates().every(c => c.which === 'owner') && evKeys(s).length === 0 && s.auth === '',
      JSON.stringify([got5, creates().map(c => c.which), evKeys(s)]));

    // ── W06 create, start today → straight in: owner, header = name, info, live token, 0 branch_auth, no confirm sheet ──
    calls.length = 0; const tg0 = S.o.tg.length;
    await fillCreate(w({ label: 'Siam Fair 2569', s: 0, e: 2 })); await submit(); await p.waitForTimeout(400);
    s = await st();
    const c6 = creates()[0] || { body: {}, ans: {} }, k6 = c6.ans.key || '';
    const tok6 = (s.tokens[k6] || {}).token, row6 = k6 ? S.o.call('accessRow_', k6) : null;
    const live6 = !!(tok6 && S.o.call('authFor_', tok6, k6));
    const tg6 = S.o.tg.slice(tg0).join(' | ');
    ok('W06 valid sheet, start today → ONE event_create on Owner {label,start,end,pin,open_pin,staff{nick,phone}} → key E-yymmdd-XXX · main app on it, owner, header = name · info type/label/start/end · token valid · 0 branch_auth · no confirm sheet · row active by "T (0800000000)" · Telegram "เปิดงานใหม่"',
      creates().length === 1 && c6.which === 'owner' && c6.body.label === 'Siam Fair 2569' && c6.body.start === S.ds(0) && c6.body.end === S.ds(2) &&
      c6.body.pin === '5937' && c6.body.open_pin === '3141' && c6.body.staff && c6.body.staff.nick === 'T' && c6.body.staff.phone === '0800000000' &&
      KEY_RE.test(k6) && s.main === 'block' && s.branch === k6 && s.role === 'owner' && s.hdr.indexOf('Siam Fair 2569') === 0 &&
      s.info[k6] && s.info[k6].type === 'event' && s.info[k6].label === 'Siam Fair 2569' && s.info[k6].start === S.ds(0) && s.info[k6].end === S.ds(2) &&
      tokRole(tok6) === 'owner' && live6 && auths().length === 0 && !s.confirm && !s.sheet &&
      row6 && row6.status === 'active' && row6.created_by === 'T (0800000000)' && tg6.indexOf('เปิดงานใหม่: Siam Fair 2569') >= 0,
      JSON.stringify([creates().length, c6.which, c6.body, k6, s.main, s.branch, s.role, s.hdr, s.info[k6], live6, auths().length, s.confirm, row6 && [row6.status, row6.created_by], tg6]));

    // ── W07 the new event is a normal event: logout → listed → join with its PIN (D-ev-3 sheet) → in ──
    await logout(); await evTab();
    s = await st();
    const li7 = s.items.find(i => i.key === k6) || {};
    await tap('#loginEventList [data-ev="' + k6 + '"]'); await p.fill('#loginPinInput', '5937', { timeout: 2000 }).catch(() => { }); await tap('#loginBtn'); await p.waitForTimeout(300);
    const conf7 = !!(await p.$('#evConfirmModal'));
    await tap('#evConfirmYes');
    s = await st();
    ok('W07 after logout the new event is in the list (enabled, by name) · join with its PIN → confirm sheet → in as owner',
      !!li7.key && !li7.dis && li7.txt.indexOf('Siam Fair 2569') >= 0 && conf7 && s.branch === k6 && s.role === 'owner', JSON.stringify([li7, conf7, s.branch, s.role]));
    await logout();

    // ── W08 future start → created, NOT entered: toast "เข้าได้ตั้งแต่ <start>", nothing stored, list reloads with it greyed ──
    await evTab(); calls.length = 0;
    await openCreate(); await fillCreate(w({ label: 'งานอนาคตใหม่', s: 3, e: 4, pin: '6048' })); await submit(); await p.waitForTimeout(400);
    s = await st();
    const c8 = creates()[0] || { ans: {} }, k8 = c8.ans.key || '';
    const day8 = await p.evaluate(d => evDayText(d), S.ds(3));
    const li8 = s.items.find(i => i.key === k8) || {};
    const listAfter = calls.findIndex(c => c.type === 'event_list') > calls.findIndex(c => c.type === 'event_create');
    ok('W08 start in 3 days → event created (server ok) but not entered: toast "สร้างงานแล้ว — เข้าได้ตั้งแต่ ' + day8 + '" · login screen · no token / info / session · list reloaded, the new event listed + disabled',
      c8.ans.ok && KEY_RE.test(k8) && s.toast.indexOf('สร้างงานแล้ว — เข้าได้ตั้งแต่ ' + day8) >= 0 && s.main !== 'block' && !s.sheet &&
      !s.tokens[k8] && !s.info[k8] && s.auth === '' && listAfter && li8.key === k8 && li8.dis,
      JSON.stringify([c8.ans.ok, k8, s.toast, s.main, Object.keys(s.tokens), s.auth, listAfter, li8]));

    // ── W09 last day exactly 3 days ago (Tony 05/11) → allowed, entered, toast says it is past its last day ──
    calls.length = 0;
    await openCreate(); await fillCreate(w({ label: 'งานย้อนหลัง', s: -6, e: -3, pin: '7159' })); await submit(); await p.waitForTimeout(400);
    s = await st();
    const k9 = ((creates()[0] || {}).ans || {}).key || '';
    ok('W09 start −6, last day −3 (edge of the grace) → sent + created → in as owner · info end = −3 · toast "เลยวันสุดท้ายแล้ว"',
      creates().length === 1 && KEY_RE.test(k9) && s.branch === k9 && s.role === 'owner' && s.info[k9] && s.info[k9].end === S.ds(-3) && s.toast.indexOf('เลยวันสุดท้ายแล้ว') >= 0,
      JSON.stringify([creates().length, k9, s.branch, s.role, s.info[k9], s.toast]));
    await logout(); await evTab();

    // ── W10 offline → "ต้องต่อเน็ตเพื่อเปิดงาน", nothing sent ──
    calls.length = 0;
    await openCreate(); await fillCreate(w({ label: 'งานออฟไลน์' }));
    await ctx.setOffline(true); await submit(); s = await st(); await ctx.setOffline(false);
    ok('W10 offline → "ต้องต่อเน็ตเพื่อเปิดงาน", sheet stays, 0 event_create', s.msg.indexOf('ต้องต่อเน็ตเพื่อเปิดงาน') === 0 && s.sheet && creates().length === 0, JSON.stringify([s.msg, s.sheet, creates().length]));

    // ── W11 network failure → one try only (no auto retry), "เชื่อมต่อไม่ได้ …", button usable, nothing stored ──
    fake = 'nocreate'; calls.length = 0;
    await submit(); await p.waitForTimeout(300); s = await st(); fake = null;
    ok('W11 event_create lost on the network → exactly 1 attempt · "เชื่อมต่อไม่ได้ — ลองใหม่…" · button back · nothing stored',
      creates().length === 1 && s.msg.indexOf('เชื่อมต่อไม่ได้') === 0 && s.okDis === false && s.sheet && s.auth === '', JSON.stringify([creates().length, s.msg, s.okDis, s.auth]));

    // ── W12 v8 Owner (ok:true, no token / key) → "ระบบยังไม่รองรับการเปิดงาน", nothing stored ──
    fake = 'v8create'; calls.length = 0;
    await submit(); s = await st(); fake = null;
    ok('W12 v8 answer without token → "ระบบยังไม่รองรับการเปิดงาน (รออัปเดต)" · nothing stored', s.msg.indexOf('ระบบยังไม่รองรับการเปิดงาน') === 0 && s.auth === '' && s.main !== 'block', JSON.stringify([s.msg, s.auth]));

    // ── W13 tap outside / ยกเลิก = close, nothing sent ──
    calls.length = 0;
    await p.mouse.click(5, 5); await p.waitForTimeout(300);
    const out13 = !(await p.$('#evCreateModal'));
    await openCreate(); await fillCreate(w({ label: 'งานยกเลิก' }));
    await p.evaluate(() => { var b = [].filter.call(document.querySelectorAll('#evCreateModal button'), function (x) { return x.textContent === 'ยกเลิก'; })[0]; if (b) b.click(); });
    await p.waitForTimeout(300);
    s = await st();
    ok('W13 tap outside → sheet closed · ยกเลิก → closed · 0 event_create', out13 && !s.sheet && creates().length === 0, JSON.stringify([out13, s.sheet, creates().length]));

    // ── W14 wrong รหัสเปิดงาน until the server locks creation → "รอ 30 นาที" (create-only text, login keeps "10 นาที") ──
    calls.length = 0;
    await openCreate();
    for (let i = 0; i < 5; i++) { await fillCreate(w({ label: 'งานล็อก', op: '9' + i + '99' })); await submit(); }
    s = await st();
    const errs14 = creates().map(c => (c.ans || {}).error);
    ok('W14 wrong open PIN (1 earlier + 4) → 5th lock → next try "ใส่รหัสผิดหลายครั้ง — รอ 30 นาที" · login map still says 10 นาที',
      errs14.slice(0, 4).every(e => e === 'open_pin_bad') && errs14[4] === 'locked_out' && s.msg.indexOf('รอ 30 นาที') >= 0 &&
      (await p.evaluate(() => authErrorText('locked_out', true))).indexOf('10 นาที') >= 0, JSON.stringify([errs14, s.msg]));
    await p.mouse.click(5, 5);

    // ── W15 static vs d1 ──
    const baseSrc = cp.execSync('git show ' + (process.env.D2_BASE || '49b49f6') + ':index.html', { encoding: 'utf8', maxBuffer: 64 << 20 });
    const baseSet = new Set(baseSrc.split('\n'));
    const added = SRC.split('\n').filter(l => !baseSet.has(l));
    const bad = added.filter(l => /\blet\s|\bconst\s|=>|`|innerHTML/.test(l));
    const elOf = x => (/function el\(tag, attrs, kids\) \{[\s\S]*?\n        \}/.exec(x) || [''])[0];
    const n = (x, re) => (x.match(re) || []).length, d = re => n(SRC, re) - n(baseSrc, re);
    const facts = { accept: d(/acceptLogin\(/g), create: [n(SRC, /type: "event_create"/g), d(/type: "event_create"/g)], setTok: d(/setToken\(/g), authBody: d(/type: "branch_auth"/g),
      defs: [n(SRC, /function sheetField\(/g), n(SRC, /function openSheetModal\(/g), n(SRC, /function loginNamesOk\(/g), n(SRC, /function authErrorText\(/g)],
      namesInline: n(SRC, /\["loginName", "loginNick", "loginPhone"\]\.every/g) };
    ok('W15 static: ' + added.length + ' added lines without let/const/=>/`/innerHTML · el() byte-identical · +1 acceptLogin( · ONE event_create body · no new setToken( / branch_auth body · one sheetField / openSheetModal / loginNamesOk / authErrorText · names check in one place',
      added.length > 60 && bad.length === 0 && elOf(SRC) && elOf(SRC) === elOf(baseSrc) && facts.accept === 1 && facts.create.join() === '1,1' &&
      facts.setTok === 0 && facts.authBody === 0 && facts.defs.join() === '1,1,1,1' && facts.namesInline === 1, JSON.stringify([bad.slice(0, 3), facts]));

    ok('W16 no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
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
