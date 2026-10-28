// test-0016b.js — L2 part b (carry chain + today re-base). Run from repo root:  node tests/test-0016b.js
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  let b;
  try { b = await chromium.launch({ channel: 'chrome' }); } catch (e) { b = await chromium.launch(); }
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue()
    : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, token: 'tok', state: null, states: [] }) }));
  // '#' in the repo path (D:\##PROJECT##) must be encoded or Chromium treats it as a URL fragment
  await p.goto('file:///' + path.resolve('index.html').replace(/\\/g, '/').replace(/#/g, '%23'));
  await p.waitForTimeout(800);
  const R = await p.evaluate(() => {
    const t = []; const ok = (id, cond, info) => t.push([id, !!cond, info === undefined ? '' : String(info)]);
    const br = 'SBR-01', T = todayISO(), d = n => shiftDateStr(T, n);
    const put = st => localStorage.setItem(stateKey(br, st.date), JSON.stringify(st));
    const get = ds => JSON.parse(localStorage.getItem(stateKey(br, ds)));
    function boot() {
      localStorage.clear();
      localStorage.setItem('puff10_loginStaff', JSON.stringify({ name: 'Test', nick: 'T', phone: '0' }));
      document.getElementById('loginScreen').style.display = 'none'; document.getElementById('mainApp').style.display = 'block';
    }
    function seed() {
      boot();
      const c6 = newState(br); c6.date = d(-6); c6.is_closed = true;
      c6.stock.ORI.received_pieces = 100; c6.stock.ORI.fry_out = 30;
      c6.gift_catalog = [{ id: 'G1', name: 'gift', price: 10 }]; c6.gift_stock = { G1: { received: 10, sold: 2 } };
      put(c6);
      const a4 = newStateWithCarryOver(br, d(-4)); a4.sales = [{ ts: 'x', totalAmount: 25, totalPieces: 1, items: [] }]; put(a4);
      const td = newStateWithCarryOver(br); td.stock.ORI.received_pieces += 20;
      td.stock_log = [{ ts: 'x', items: [{ id: 'ORI', pieces: 20 }], is_correction: false }];
      td.gift_stock.G1.received += 5; put(td);
      setBranch(br);
    }
    // ---- S1: close an empty older back day under an active later day + today
    seed();
    ok('T30 new state stores carry', get(d(-4)).carry && get(d(-4)).carry.stock.ORI === 70 && get(T).carry.stock.ORI === 70, JSON.stringify(get(T).carry && get(T).carry.stock.ORI));
    window.confirm = () => false;
    enterBackDate(d(-5), 'test');
    ok('T31 back day -5 inherits 70', S.date === d(-5) && S.stock.ORI.received_pieces === 70 && S.gift_stock.G1.received === 8);
    S.stock.ORI.fry_out = 10; S.gift_stock.G1.sold = 3; S.is_closed = true; S.closedAt = Date.now(); save();
    afterBackDateClose();
    const a4 = get(d(-4)), td = get(T);
    ok('T32 active later day -4 re-based 70 -> 60', a4.stock.ORI.received_pieces === 60 && a4.carry.stock.ORI === 60, a4.stock.ORI.received_pieces);
    ok('T33 -4 own sales kept', a4.sales.length === 1);
    ok('T34 today 90 -> 80 (own +20 kept)', td.stock.ORI.received_pieces === 80 && td.carry.stock.ORI === 60 && td.stock_log.length === 1, td.stock.ORI.received_pieces);
    ok('T35 today gift 13 -> 10 (carry 8 -> 5, own +5 kept)', td.gift_stock.G1.received === 10, td.gift_stock.G1.received);
    ok('T36 declined next -> back to today', _backDate === null && S.date === T && S.stock.ORI.received_pieces === 80);
    ok('T37 missing days untouched (no state created for -3..-1)', !localStorage.getItem(stateKey(br, d(-3))) && !localStorage.getItem(stateKey(br, d(-1))));
    const q = JSON.parse(localStorage.getItem('puff10_syncQueue') || '[]').map(x => x.date);
    ok('T38 re-based days queued for cloud', q.indexOf(d(-4)) >= 0 && q.indexOf(T) >= 0, q.join(','));
    // ---- S2: accept the next back day
    seed(); window.confirm = () => true;
    enterBackDate(d(-5), 'test'); S.is_closed = true; save(); afterBackDateClose();
    ok('T39 accepted next -> opens -4 with same reason', _backDate && _backDate.date === d(-4) && _backDate.reason === 'test' && S.date === d(-4));
    ok('T40 -4 logs the carried-over reason', S.backdate_log && S.backdate_log.length === 1, S.backdate_log && S.backdate_log.length);
    restoreToday();
    // ---- S2b: real close button path (confirmCloseDay) end to end
    seed(); let cc = 0; window.confirm = () => (++cc === 1);   // 1st = confirm close, 2nd = decline next day
    enterBackDate(d(-5), 'test'); S.stock.ORI.fry_out = 10; S.counted = { ORI: 4 }; S.cash = { cash: 150 }; save();
    go('close'); confirmCloseDay();
    ok('T46 Close button: -5 closed, today re-based to 80, back on today', get(d(-5)).is_closed === true && get(T).stock.ORI.received_pieces === 80 && _backDate === null && S.date === T && cc === 2, 'confirms=' + cc);
    // ---- S3: legacy today state (no .carry) still re-bases via received - sum(stock_log)
    seed(); const lg = get(T); delete lg.carry; put(lg); window.confirm = () => false;
    enterBackDate(d(-5), 'test'); S.stock.ORI.fry_out = 10; S.is_closed = true; save(); afterBackDateClose();
    ok('T41 legacy today 90 -> 80', get(T).stock.ORI.received_pieces === 80, get(T).stock.ORI.received_pieces);
    // ---- S4: Issue3 nudge close of yesterday re-bases today, no next prompt
    boot();
    const c2 = newState(br); c2.date = d(-2); c2.is_closed = true; c2.stock.ORI.received_pieces = 50; put(c2);
    const y = newStateWithCarryOver(br, d(-1)); y.stock.ORI.fry_out = 20; y.fry_log = [{ ts: 'x', items: [] }]; put(y);
    const t2 = newStateWithCarryOver(br); t2.stock.ORI.received_pieces += 10; t2.stock_log = [{ ts: 'x', items: [{ id: 'ORI', pieces: 10 }] }]; put(t2);
    setBranch(br); let asked = 0; window.confirm = () => { asked++; return true; };
    enterPastDayClose(d(-1)); S.is_closed = true; save(); afterBackDateClose();
    ok('T42 Issue3: today 60 -> 40 after yesterday closes (frozen 30 + own 10)', get(T).stock.ORI.received_pieces === 40, get(T).stock.ORI.received_pieces);
    ok('T43 Issue3: no next-day prompt, back on today', asked === 0 && _backDate === null && S.date === T);
    ok('T44 confirmCloseDay wired to afterBackDateClose', String(confirmCloseDay).indexOf('afterBackDateClose()') > 0);
    // ---- S5: a closed later day is never rewritten
    boot();
    const k6 = newState(br); k6.date = d(-6); k6.is_closed = true; k6.stock.ORI.received_pieces = 100; put(k6);
    const k5 = newStateWithCarryOver(br, d(-5)); k5.is_closed = true; put(k5);
    const before = localStorage.getItem(stateKey(br, d(-5)));
    setBranch(br); recarryForward(d(-6));
    ok('T45 closed day untouched by re-base', localStorage.getItem(stateKey(br, d(-5))) === before);
    localStorage.clear();
    return t;
  });
  let pass = 0;
  R.forEach(r => { console.log((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[2] ? '  [' + r[2] + ']' : '')); if (r[1]) pass++; });
  console.log('console errors: ' + errs.length + (errs.length ? '\n  ' + errs.join('\n  ') : ''));
  console.log('RESULT ' + pass + '/' + R.length + (pass === R.length && !errs.length ? ' ALL PASS' : ' — NOT PASSING'));
  await b.close();
})();
