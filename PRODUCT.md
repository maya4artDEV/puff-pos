# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** พนักงานหน้าร้านประจำสาขาแฟรนไชส์และอีเวนต์ (~20 สาขาทั่วประเทศไทย) ใช้งานผ่านสมาร์ตโฟนหรือแท็บเล็ตหน้าร้านในสภาพแวดล้อมที่เร่งรีบ (รับออเดอร์, ทอดขนม, นับสต็อก)
- **Secondary:** Owner / HQ (Tony) ดูภาพรวมยอดขาย สต็อกคงเหลือ และมอนิเตอร์สถานะแต่ละสาขาแบบ Real-time / Near live

## Product Purpose

เว็บแอปพลิเคชัน POS สรุปยอดขายประจำวัน บันทึกรอบทอด นับสต็อกแช่แข็ง และมอนิเตอร์ภาพรวมสาขา สำหรับธุรกิจแฟรนไชส์ขนมพัฟสติ๊ก (PuffStick) ออกแบบให้ใช้งานง่าย โหลดเร็ว เสถียร ทำงานออฟไลน์ได้เมื่อเน็ตหลุด และซิงค์ข้อมูลกับ Google Sheets อัตโนมัติ

## Positioning

Single-file Zero-build POS & Operations Tool ที่เรียบง่ายแต่ทนทานสูง ไม่ต้องติดตั้งแอป ไม่ต้องมี Build pipeline ใช้งานได้ทันทีบนเบราว์เซอร์ทุกอุปกรณ์หน้าร้าน พร้อมระบบ Single-writer State Sync ที่ป้องกันข้อมูลสูญหาย

## Operating Context

- หน้าเคาน์เตอร์ร้านขายขนมพัฟสติ๊กในห้างสรรพสินค้า ปั๊มน้ำมัน (PTT) และบูธอีเวนต์
- อุปกรณ์หลัก: แท็บเล็ต iPad / Android และสมาร์ตโฟนพนักงาน
- สภาพแวดล้อมเครือข่าย: อาจมีเน็ตช้าหรือหลุดเป็นช่วงๆ (ต้องการระบบ Offline Queue ทนทาน)
- การทำงานประจำวัน: เปิดกะตอนเช้า -> บันทึกทอด -> บันทึกขายหน้าร้าน/เดลิเวอรี/ของฝาก -> ปิดกะสรุปยอดสต็อกตอนเย็น

## Capabilities and Constraints

- **Architecture:** Single-file `index.html` (Vanilla JS + CSS + HTML) deploy ตรงสู่ GitHub Pages
- **Syntax Standards:** ES5 (`var`, `function(){}`), DOM สร้างผ่าน `el()` helper เท่านั้น, ห้ามใช้ `let`/`const`/arrow function/template literals
- **Backend:** Google Apps Script (Owner & Franchise scripts) + Google Sheets (CloudState, Sales, Fry, Stock)
- **Storage:** LocalStorage prefix `puff7_` + Sync queue `puff10_syncQueue`
- **Device Modes:** `writer` (เครื่องบันทึกหน้าร้าน) vs `viewer` (เครื่องดูอย่างเดียว / HQ)

## Brand Commitments

- **Tone & Voice:** เป็นกันเอง เข้าใจง่าย ชัดเจน ภาษาไทยเป็นหลัก
- **Visual Identity:** โทนอบอุ่น สบายตา เข้ากับเบเกอรี่/ขนมอบ (Mustard, Cream, Cocoa, Olive, Sage)
- **Typography:** Prompt, Nunito

## Product Principles

1. **หน้าร้านไม่สะดุด (Zero Friction):** บันทึกขายและรอบทอดต้องทำได้ใน 1-2 สัมผัส รองรับการทำงานออฟไลน์ 100%
2. **ข้อมูลปลอดภัยและแม่นยำ (Data Integrity):** ใช้ Single-writer model เครื่องบันทึกเป็นเจ้าของข้อมูล ไม่ถูก Cloud เขียนทับโดยไม่ตั้งใจ
3. **ดูแลรักษาง่ายด้วยคนเดียว (Solo Maintainability):** โค้ดตรงไปตรงมา ไม่มี dependencies ซับซ้อน ไม่มี build step ที่ต้องคอยแก้
4. **ความชัดเจนของสถานะ (Explicit State):** มีสัญลักษณ์บอกสถานะซิงค์ (☁✓, ☁⟳, ☁✗) และ Badge โหมดเครื่องชัดเจนเสมอ
