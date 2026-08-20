const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
    console.log('=== เริ่มการทดสอบอัตโนมัติ (Task 1 & Task 2) ===\n');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Intercept POST request เพื่อไม่ให้ flushSyncQueue ส่ง request จริงออกเน็ต
    await page.route('**/*', (route) => {
        if (route.request().method() === 'POST') {
            return route.abort(); // simulate offline or intercept
        }
        return route.continue();
    });

    // เปิด index.html ผ่าน valid file URL
    const fileUrl = pathToFileURL(path.resolve(__dirname, 'index.html')).href;
    await page.goto(fileUrl);
    await page.waitForLoadState('domcontentloaded');

    console.log('1. ตรวจสอบการโหลดหน้า Login & ค่าเริ่มต้น:');
    const toggleExists = await page.locator('#deviceModeToggle').count();
    if (!toggleExists) {
        throw new Error('ไม่พบ #deviceModeToggle ในหน้า Login');
    }
    console.log('   - พบ #deviceModeToggle บนหน้าจอ');

    let initialMode = await page.evaluate(() => localStorage.getItem('puff7_device_mode'));
    console.log('   - ค่าเริ่มต้นใน localStorage:', initialMode || 'null (default writer)');

    // 2. ทดสอบคลิกสลับเป็น "ดูอย่างเดียว (viewer)"
    console.log('\n2. ทดสอบคลิกเลือกโหมด "👁 ดูอย่างเดียว":');
    const viewerBtn = page.locator('#deviceModeToggle button[data-mode="viewer"]');
    await viewerBtn.click();
    await page.waitForTimeout(100);

    let modeAfterViewer = await page.evaluate(() => localStorage.getItem('puff7_device_mode'));
    console.log('   - ค่าใน localStorage หลังคลิก viewer:', modeAfterViewer);
    if (modeAfterViewer !== 'viewer') {
        throw new Error('localStorage ไม่เปลี่ยนเป็น viewer!');
    }
    console.log('   ✅ สลับเป็น viewer สำเร็จ');

    // 3. ทดสอบ Persistence หลัง Reload
    console.log('\n3. ทดสอบ Persistence (Reload หน้าเว็บ):');
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    let modeAfterReload = await page.evaluate(() => localStorage.getItem('puff7_device_mode'));
    console.log('   - ค่าใน localStorage หลัง reload:', modeAfterReload);
    if (modeAfterReload !== 'viewer') {
        throw new Error('ค่าโหมดไม่คงอยู่หลัง reload!');
    }
    console.log('   ✅ โหมดคงอยู่ถูกต้องหลัง reload');

    // 4. ทดสอบคลิกสลับกลับเป็น "ผู้บันทึก (writer)"
    console.log('\n4. ทดสอบคลิกเลือกโหมด "✏ ผู้บันทึก":');
    const writerBtn = page.locator('#deviceModeToggle button[data-mode="writer"]');
    await writerBtn.click();
    await page.waitForTimeout(100);

    let modeAfterWriter = await page.evaluate(() => localStorage.getItem('puff7_device_mode'));
    console.log('   - ค่าใน localStorage หลังคลิก writer:', modeAfterWriter);
    if (modeAfterWriter !== 'writer') {
        throw new Error('localStorage ไม่เปลี่ยนเป็น writer!');
    }
    console.log('   ✅ สลับกลับเป็น writer สำเร็จ');

    // 5. ทดสอบเข้าสู่ระบบ และตรวจสอบ Badge ใน Header
    console.log('\n5. ทดสอบ Login & Badge ใน Header:');
    await page.locator('#loginName').fill('พี่ Tony');
    await page.locator('#loginNick').fill('Tony');
    await page.locator('#loginPhone').fill('0812345678');
    await page.locator('#loginBranchSel').selectOption('SBR-01');
    await page.evaluate(() => updLoginBtn());

    const loginBtn = page.locator('#loginBtn');
    const isDisabled = await loginBtn.isDisabled();
    if (isDisabled) {
        throw new Error('ปุ่มเริ่มใช้งานยังคง disabled อยู่!');
    }

    // คลิก login
    await loginBtn.click();
    await page.waitForTimeout(500);

    // เช็ค badge ใน header
    const badgeText = await page.locator('#deviceModeBadge').textContent();
    console.log('   - ข้อความ Badge ที่แสดง:', badgeText.trim());
    if (!badgeText.includes('ผู้บันทึก')) {
        throw new Error('Badge แสดงผลไม่ถูกต้องสำหรับโหมด writer');
    }
    console.log('   ✅ Badge โหมด writer แสดงผลถูกต้อง');

    // 6. ทดสอบ Task 2: Hard-gate Cloud Sync สำหรับ Viewer vs Writer
    console.log('\n6. ทดสอบ Task 2 (Sync Hard-gate logic):');
    
    // ตั้งค่าเป็น viewer แล้วลองเรียก queueCloudSync ด้วย valid non-empty state
    await page.evaluate(() => {
        setDeviceMode('viewer');
        localStorage.setItem('puff10_syncQueue', '[]');
        const validState = { sales: [{ id: 'S001', total: 100 }] };
        queueCloudSync('SBR-01', '2026-08-18', validState);
    });

    let queueInViewer = await page.evaluate(() => localStorage.getItem('puff10_syncQueue'));
    console.log('   - Queue ในโหมด viewer หลังพยายาม queue state:', queueInViewer);
    if (queueInViewer !== '[]') {
        throw new Error('Viewer ดัน enqueue ข้อมูลได้! (Task 2 fail)');
    }
    console.log('   ✅ Viewer ไม่มีการเขียนลง puff10_syncQueue ตามที่กำหนด');

    // ทดสอบ flushSyncQueue belt-and-suspenders ใน viewer
    await page.evaluate(() => {
        setDeviceMode('viewer');
        localStorage.setItem('puff10_syncQueue', JSON.stringify([{ branch: 'SBR-01', date: '2026-08-18' }]));
        flushSyncQueue();
    });
    let queueAfterFlushViewer = await page.evaluate(() => localStorage.getItem('puff10_syncQueue'));
    console.log('   - Queue หลัง flushSyncQueue() ในโหมด viewer:', queueAfterFlushViewer);
    if (queueAfterFlushViewer !== '[]') {
        throw new Error('flushSyncQueue ใน viewer ไม่ยอมล้างคิว!');
    }
    console.log('   ✅ flushSyncQueue() ล้างคิวทันทีเมื่ออยู่ในโหมด viewer');

    // ตั้งค่าเป็น writer แล้วจำลอง offline เพื่อดูว่า queue ถูก push สำเร็จไหม
    await page.evaluate(() => {
        setDeviceMode('writer');
        localStorage.setItem('puff10_syncQueue', '[]');
        // จำลองไม่ให้ flushSyncQueue เคลียร์คิวทันทีเพื่อตรวจสอบการ push
        const validState = { sales: [{ id: 'S001', total: 100 }] };
        const origOnline = navigator.onLine;
        try {
            Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        } catch(e) {}
        queueCloudSync('SBR-01', '2026-08-18', validState);
    });

    let queueInWriter = await page.evaluate(() => JSON.parse(localStorage.getItem('puff10_syncQueue') || '[]'));
    console.log('   - Queue ในโหมด writer (offline):', queueInWriter.length, 'รายการ');
    if (queueInWriter.length !== 1) {
        throw new Error('Writer ไม่สามารถ enqueue ข้อมูลได้!');
    }
    console.log('   ✅ Writer enqueue ข้อมูลเข้า puff10_syncQueue ได้ถูกต้อง');

    console.log('\n🎉 ========================================== 🎉');
    console.log('   การทดสอบทั้งหมดผ่าน 100% (Task 1 & Task 2 VERIFIED)');
    console.log('🎉 ========================================== 🎉\n');

    await browser.close();
})();
