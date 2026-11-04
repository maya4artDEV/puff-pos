// test-cash.js — close-day cash fix (build 20261104.0017): payouts are added back, not deducted twice.
// "เงินสดในลิ้นชัก" = cash left in the drawer at close (incl. float) → received = drawer − float + payouts + transfer + delivery net.
// Run from repo root:  node tests/test-cash.js      (PUFF_HTML = app file, default index.html · CASH_BASE = git ref for added-lines check)
// Network is stubbed; XLSX is stubbed to capture the close-sheet rows.
const path = require('path'), fs = require('fs'), cp = require('child_process');
const { chromium } = require('playwright');

const HTML_PATH = path.resolve(process.env.PUFF_HTML || 'index.html');
const SRC = fs.readFileSync(HTML_PATH, 'utf8');
const BASE = process.env.CASH_BASE || 'fd28464';
const R = [];
const ok = (id, cond, info) => R.push([id, !!cond, info === undefined ? '' : String(info)]);

// ── T5 static checks ──
(function T5() {
  const m = /<script>([\s\S]*?)<\/script>/.exec(SRC);
  const tmp = path.join(require('os').tmpdir(), 'cash-script-' + process.pid + '.js');
  fs.writeFileSync(tmp, m ? m[1] : '');
  let chk = '';
  try { cp.execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); } catch (e) { chk = String(e.stderr || e.message).split('\n')[0]; }
  fs.unlinkSync(tmp);
  ok('T5a node --check main script', !!m && chk === '', chk);
  ok('T5b no double deduction left (no "- tw", no tw2)', SRC.indexOf('- tw') < 0 && SRC.indexOf('tw2') < 0);
  ok('T5c one money source: calcMoney defined once, used by calcClose + doExport + confirmCloseDay',
    (SRC.match(/function calcMoney\(/g) || []).length === 1 && (SRC.match(/calcMoney\(/g) || []).length === 4);
  let added = null;
  try {
    const d = cp.execFileSync('git', ['diff', '-U0', BASE, '--', path.relative(process.cwd(), HTML_PATH) || 'index.html'], { encoding: 'utf8' });
    added = d.split('\n').filter(l => l[0] === '+' && l.indexOf('+++') !== 0);
  } catch (e) { added = null; }
  if (added === null) ok('T5d added lines: git diff vs ' + BASE, false, 'git diff failed (run in the repo)');
  else {
    const bad = added.filter(l => /\blet\s|\bconst\s|=>|`/.test(l));
    ok('T5d added lines: no let/const/arrow/template', bad.length === 0, bad.length ? bad[0].slice(0, 80) : added.length + ' added lines');
  }
})();

(async () => {
  let b;
  try { b = await chromium.launch({ channel: 'chrome' }); } catch (e) { b = await chromium.launch(); }
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && m.text().indexOf('net::ERR_FAILED') < 0) errs.push('console: ' + m.text()); });
  p.on('dialog', d => d.dismiss());
  await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue()
    : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, token: 'tok', state: null, states: [] }) }));
  await p.goto(('file:///' + HTML_PATH.replace(/\\/g, '/')).replace(/#/g, '%23'));
  await p.waitForTimeout(800);
  let T;
  try { T = await p.evaluate(() => {
    const t = []; const ok = (id, cond, info) => t.push([id, !!cond, info === undefined ? '' : String(info)]);
    localStorage.clear();
    localStorage.setItem('puff10_loginStaff', JSON.stringify({ name: 'Test', nick: 'T', phone: '0' }));
    document.getElementById('loginScreen').style.display = 'none'; document.getElementById('mainApp').style.display = 'block';
    const br = 'MVK-03';
    setBranch(br); go('close');
    // XLSX stub: capture the "ปิดวัน" sheet rows
    let sheets = {};
    window.XLSX = { utils: { book_new: () => ({}), aoa_to_sheet: rows => ({ rows: rows }), book_append_sheet: (wb, ws, name) => { sheets[name] = ws.rows; } },
      write: () => 'b64', writeFile: () => {} };
    const exportDiff = st => {
      sheets = {}; doExport('all', st, null, function () {});
      const rows = sheets['ปิดวัน'] || [];
      const find = l => { const r = rows.find(x => x[0] === l); return r ? r[9] : undefined; };
      return { diff: find('ผลต่าง'), received: find('รวมรับจริง'), labels: rows.map(x => x[0]) };
    };
    const id = F[0].id;     // first filling (ORI)
    // One day: sell `pcs` at the day price, fry exactly that many, count 0 left
    const setDay = (pcs, cash, wds, transfer) => {
      S.is_closed = false;
      S.stock[id].fry_out = pcs; S.counted = {}; S.counted[id] = 0;
      F.forEach(f => { if (f.id !== id) { S.stock[f.id].fry_out = 0; } });
      S.withdrawals = wds.map((a, i) => ({ amount: a, reason: 'w' + i, ts: 'x' }));
      S.cash = cash; S.delivery_sales = []; S.gift_sales = [];
      if (transfer !== undefined) S.cash.transfer = transfer;
      save(); renderWithdrawals(); restoreCashInputs(); calcClose();
      const title = document.querySelector('#closeResult .diff-title');
      return { title: title ? title.textContent : '', cs: calcCountSales(S) };
    };
    const price = priceOf(S, id);
    const pcsFor = baht => baht / price;
    const fmt = n => n.toLocaleString();
    const expectTitle = diff => diff === 0 ? 'ยอดเงินตรงพอดี' : (diff < 0 ? 'ขาด ฿' + fmt(-diff) : 'เกิน ฿' + fmt(diff));

    ok('T0 precondition: price divides 2825 and 3000', Number.isInteger(pcsFor(2825)) && Number.isInteger(pcsFor(3000)), 'price ' + price);
    const pre = setDay(pcsFor(2825), { float: 0, cash: 0 }, []);
    ok('T0b count sales = 2825', pre.cs.amount === 2825 && pre.cs.complete, pre.cs.amount);

    // T1 field case MVK-03 04/11/2569 (float 1,200 confirmed) + generic
    const cases = [
      ['T1a as entered (float 0, cash 2825, wd 2825) → เกิน 2825', 2825, { float: 0, cash: 2825 }, [150, 2650, 25], 2825],
      ['T1b truthful before last 25 out (float 1200, drawer 1225, wd 2800) → 0', 2825, { float: 1200, cash: 1225 }, [150, 2650], 0],
      ['T1c truthful after last 25 out (float 1200, drawer 1200, wd 2825) → 0', 2825, { float: 1200, cash: 1200 }, [150, 2650, 25], 0],
      ['T1d generic: float 500, sales 3000, oil 200 → drawer 3300 → 0', 3000, { float: 500, cash: 3300 }, [200], 0],
      ['T1e real shortage still shows: drawer 1100 after 2825 out → ขาด 100', 2825, { float: 1200, cash: 1100 }, [150, 2650, 25], -100]
    ];
    cases.forEach(c => {
      const r = setDay(pcsFor(c[1]), c[2], c[3]);
      ok(c[0], r.title === expectTitle(c[4]), r.title);
      // T3 Excel close sheet ผลต่าง == on-screen diff
      const x = exportDiff(S);
      ok('T3 ' + c[0].slice(0, 4) + ' Excel ผลต่าง = ' + c[4], x.diff === c[4], x.diff);
    });
    const lab = exportDiff(S).labels;
    ok('T3f Excel labels: drawer + payouts added back, old deduction rows gone',
      lab.indexOf('เงินสดในลิ้นชัก (รวมเงินทอน)') > -1 && lab.indexOf('+ เงินจ่ายออกระหว่างวัน') > -1 && lab.indexOf('เงินสดในลิ้นชักสุทธิ') > -1
      && lab.indexOf('หัก ยอดจ่ายออก') < 0 && lab.indexOf('เงินสดจริง') < 0, lab.filter(Boolean).slice(-12).join(' | '));

    // T2 no withdrawals → same as old formula (cash − float + transfer + dlv)
    [[{ float: 300, cash: 2000 }, 525], [{ float: 0, cash: 2825 }, 0], [{ float: 1000, cash: 3500 }, 400]].forEach((c, i) => {
      const r = setDay(pcsFor(2825), c[0], [], c[1]);
      const oldDiff = (c[0].cash - c[0].float + c[1]) - 2825;
      ok('T2' + 'abc'[i] + ' no payouts = old formula (diff ' + oldDiff + ')', r.title === expectTitle(oldDiff) && exportDiff(S).diff === oldDiff, r.title);
    });

    // T6 drawer 0 (no float, everything handed to the owner): card shows and the money guard lets close-day through
    const z = setDay(pcsFor(2825), { float: 0, cash: 0 }, [2825]);
    ok('T6a drawer 0 + payouts 2825 → ตรงพอดี (card not hidden)', z.title === 'ยอดเงินตรงพอดี', z.title || '(empty)');
    const toasts = []; const _st = window.showToast; window.showToast = (m, e) => toasts.push(m);
    window.clockFresh = () => true; window.clockBlocks = () => false;
    confirmCloseDay();   // dialog dismissed → stops at confirm, day stays open
    ok('T6b confirmCloseDay: no "ใส่ยอดเงิน" block when drawer 0 but payouts recorded', toasts.join('|').indexOf('กรุณาใส่ยอดเงิน') < 0 && !S.is_closed, toasts.join('|'));
    const e0 = setDay(pcsFor(2825), { float: 0, cash: 0 }, []);
    toasts.length = 0; confirmCloseDay();
    ok('T6c nothing entered at all → still blocked', toasts.join('|').indexOf('กรุณาใส่ยอดเงิน') > -1 && e0.title === '', toasts.join('|'));
    window.showToast = _st;

    // T4 closed day: cash inputs locked; export of another day uses THAT day's withdrawals
    setDay(pcsFor(2825), { float: 1200, cash: 1200 }, [150, 2650, 25]);
    S.is_closed = true; save();
    const inp = document.getElementById('cashAmount'); inp.value = '9999'; onCashInput();
    ok('T4a closed day: cash input refused + restored', S.cash.cash === 1200 && inp.value === '1200', inp.value);
    const old = JSON.parse(JSON.stringify(S)); old.date = shiftDateStr(todayISO(), -1);
    old.withdrawals = [{ amount: 500, reason: 'x', ts: 'x' }]; old.cash = { float: 1200, cash: 3525 };
    const xo = exportDiff(old);
    ok('T4b old-day export uses its own payouts (3525−1200+500 − 2825 = 0)', xo.diff === 0 && xo.received === 2825, xo.diff + ' / ' + xo.received);
    ok('T4c S untouched by old-day export', typeof withdrawSum === 'function' && withdrawSum(S) === 2825);

    // T7 on-screen labels (staff wording)
    const close = document.getElementById('page-close') || document.body;
    const txt = close.textContent;
    ok('T7 reconcile labels: drawer wording + add-back row, no "เงินสดจริง"/"นำเงินออก"',
      txt.indexOf('เงินสดในลิ้นชักตอนนี้ (รวมเงินทอน)') > -1 && txt.indexOf('+ เงินจ่ายออกระหว่างวัน (บวกกลับ)') > -1
      && txt.indexOf('เงินสดจริง') < 0 && txt.indexOf('นำเงินออกระหว่างวัน') < 0);
    localStorage.clear();
    return t;
  }); } catch (e) { T = [['CRASH page.evaluate', false, String(e.message).split('\n')[0]]]; }
  T.forEach(x => R.push(x));
  let pass = 0;
  R.forEach(r => { console.log((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[2] ? '  [' + r[2] + ']' : '')); if (r[1]) pass++; });
  console.log('console errors: ' + errs.length + (errs.length ? '\n  ' + errs.join('\n  ') : ''));
  console.log('test-cash RESULT ' + pass + '/' + R.length + (pass === R.length && !errs.length ? ' ALL PASS' : ' — NOT PASSING'));
  await b.close();
  process.exitCode = (pass === R.length && !errs.length) ? 0 : 1;
})();
