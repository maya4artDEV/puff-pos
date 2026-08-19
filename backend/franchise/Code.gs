// ═══════════════════════════════════════════════════════
//  PUFF STICK — Google Apps Script v7 (Franchise)
//  v4: เพิ่ม CloudState sync + state_save / state_get / state_list
// ═══════════════════════════════════════════════════════

const SHEET_ID      = "1f6v9eLTGVl8bMxFMWNetppcIpWsPKAPXr6UekzmO-ms";
const TG_BOT_TOKEN  = "";  // set in Apps Script only — never commit the real token
const TG_CHAT_ID    = "5566010745";


// ตรวจสอบว่า state ว่างเปล่าหรือไม่ (all-zero / no activity)
function isEmptyState(st) {
  if (!st) return true;
  if (st.sales && st.sales.length) return false;
  if (st.fry_log && st.fry_log.length) return false;
  if (st.stock_log && st.stock_log.length) return false;
  if (st.gift_sales && st.gift_sales.length) return false;
  if (st.delivery_sales && st.delivery_sales.length) return false;
  if (st.withdrawals && st.withdrawals.length) return false;
  var hasStock = false;
  if (st.stock) {
    Object.keys(st.stock).forEach(function(k) {
      var x = st.stock[k];
      if ((x.received_pieces||0) > 0 || (x.fry_out||0) > 0 || (x.sold||0) > 0) hasStock = true;
    });
  }
  return !hasStock;
}

// Normalize any date cell (Date object OR "d/m/yyyy" string) to canonical "dd/mm/yyyy".
function normDate(v) {
  if (v instanceof Date) {
    var d = v.getDate(), m = v.getMonth() + 1, y = v.getFullYear();
    return (d < 10 ? "0" : "") + d + "/" + (m < 10 ? "0" : "") + m + "/" + y;
  }
  var p = String(v).split("/");
  if (p.length !== 3) return String(v);
  var dd = parseInt(p[0], 10) || 0, mm = parseInt(p[1], 10) || 0, yy = parseInt(p[2], 10) || 0;
  return (dd < 10 ? "0" : "") + dd + "/" + (mm < 10 ? "0" : "") + mm + "/" + yy;
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.openById(SHEET_ID);

    // ── Cloud State: บันทึก state ต่อสาขาต่อวัน (Plain Upsert) ──
    if (data.type === "state_save") {
      // Guard: ไม่รับ payload ที่ว่างเปล่าทั้ง state เพื่อกันไม่ให้แถวที่มีข้อมูลถูกล้าง
      if (isEmptyState(data.state)) {
        return ContentService.createTextOutput(JSON.stringify({ok:true, skipped:true, reason:"empty state ignored"})).setMimeType(ContentService.MimeType.JSON);
      }
      var sheet = ss.getSheetByName("CloudState") || ss.insertSheet("CloudState");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["branch","date","updated_at","state_json"]);
        sheet.getRange(1,1,1,4).setFontWeight("bold").setBackground("#0D3B6E").setFontColor("#fff");
        sheet.setFrozenRows(1);
      }
      sheet.getRange(1, 2, Math.max(sheet.getMaxRows(), 2), 1).setNumberFormat("@"); // col B = plain text, never a date
      var rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow()-1, 2).getValues() : [];
      var found = -1;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][0] === data.branch && normDate(rows[i][1]) === normDate(data.date)) { found = i + 2; break; }
      }
      var now = new Date().toLocaleString("th-TH", {timeZone:"Asia/Bangkok"});
      var stateJson = JSON.stringify(data.state);
      if (found > 0) {
        sheet.getRange(found, 3).setValue(now);
        sheet.getRange(found, 4).setValue(stateJson);
      } else {
        sheet.appendRow([data.branch, data.date, now, stateJson]);
      }
      return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ออเดอร์ขาย ──
    if (data.type === "sale") {
      var sheet = ss.getSheetByName("Sales") || ss.insertSheet("Sales");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["เวลา","สาขา","ชื่อพนักงาน","ชื่อเล่น","เบอร์โทร","รหัสสินค้า","ชื่อสินค้า","จำนวน(ชิ้น)","ราคา/ชิ้น","ยอดเงิน"]);
        sheet.getRange(1,1,1,10).setFontWeight("bold").setBackground("#1C4587").setFontColor("#FFFFFF");
        sheet.setFrozenRows(1);
      }
      data.items.forEach(function(item) {
        sheet.appendRow([data.ts, data.branch, data.staff.name, data.staff.nick, data.staff.phone, item.code, item.name, item.pieces, data.price, item.pieces * data.price]);
      });
      var itemList = data.items.map(function(i){ return "  \u2022 " + i.name + " \u00d7 " + i.pieces + " \u0e0a\u0e34\u0e49\u0e19"; }).join("\n");
      var totalPieces = data.items.reduce(function(s,i){ return s+(i.pieces||0); }, 0);
      notifyTelegram(
        "\ud83d\uded2 \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e43\u0e2b\u0e21\u0e48!\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n" +
        "\ud83d\udccd \u0e2a\u0e32\u0e02\u0e32: " + data.branch + "\n" +
        "\ud83d\udc64 \u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19: " + data.staff.nick + " (" + data.staff.name + ")\n" +
        "\ud83d\udce6 \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23:\n" + itemList + "\n" +
        "\ud83d\udcca \u0e23\u0e27\u0e21: " + totalPieces + " \u0e0a\u0e34\u0e49\u0e19\n" +
        "\ud83d\udcb0 \u0e22\u0e2d\u0e14: \u0e3f" + Number(data.totalAmount).toLocaleString() + "\n" +
        "\ud83d\udd50 \u0e40\u0e27\u0e25\u0e32: " + data.ts
      );
    }

    // ── บันทึกทอด ──
    if (data.type === "fry") {
      var sheet = ss.getSheetByName("Fry") || ss.insertSheet("Fry");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["\u0e40\u0e27\u0e25\u0e32","\u0e2a\u0e32\u0e02\u0e32","\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32","\u0e08\u0e33\u0e19\u0e27\u0e19(\u0e0a\u0e34\u0e49\u0e19)"]);
        sheet.getRange(1,1,1,4).setFontWeight("bold").setBackground("#7F6000").setFontColor("#FFFFFF");
        sheet.setFrozenRows(1);
      }
      data.items.forEach(function(item){ sheet.appendRow([data.ts, data.branch, item.name, item.pieces]); });
      var fryList = data.items.map(function(i){ return "  \u2022 " + i.name + " \u00d7 " + i.pieces + " \u0e0a\u0e34\u0e49\u0e19"; }).join("\n");
      var totalPieces = data.items.reduce(function(s,i){ return s+(i.pieces||0); }, 0);
      notifyTelegram(
        "\ud83d\udd25 \u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e17\u0e2d\u0e14\u0e23\u0e2d\u0e1a\u0e43\u0e2b\u0e21\u0e48\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n" +
        "\ud83d\udccd \u0e2a\u0e32\u0e02\u0e32: " + data.branch + "\n" +
        "\ud83d\udce6 \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23:\n" + fryList + "\n" +
        "\ud83d\udcca \u0e23\u0e27\u0e21: " + totalPieces + " \u0e0a\u0e34\u0e49\u0e19\n" +
        "\ud83d\udd50 \u0e40\u0e27\u0e25\u0e32: " + data.ts
      );
    }

    // ── ขายของฝาก ──

    // ── Delivery Sales ──
    if (data.type === "delivery_sale") {
      var sheet = ss.getSheetByName("Delivery") || ss.insertSheet("Delivery");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["\u0e40\u0e27\u0e25\u0e32","\u0e2a\u0e32\u0e02\u0e32","\u0e41\u0e2d\u0e1b","\u0e23\u0e2b\u0e31\u0e2a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32","\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32","\u0e08\u0e33\u0e19\u0e27\u0e19(\u0e0a\u0e34\u0e49\u0e19)","Gross","Net","\u0e21\u0e35\u0e20\u0e32\u0e1e\u0e41\u0e19\u0e1a","\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38","\u0e1c\u0e39\u0e49\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01"]);
        sheet.getRange(1,1,1,11).setFontWeight("bold").setBackground("#1976D2").setFontColor("#fff");
        sheet.setFrozenRows(1);
      }
      (data.items||[]).forEach(function(it){
        sheet.appendRow([data.ts, data.branch, data.app, it.code||"", it.name, it.pieces, data.gross, data.net, data.image?"\u2713":"", data.note||"", data.staff?data.staff.name:""]);
      });

      // Save image to Drive if present (optional — graceful fallback)
      var imageUrl = "";
      if (data.image && data.image.indexOf("data:image") === 0) {
        try {
          var folderName = "PuffStick_Delivery_" + (data.branch||"unknown");
          var folders = DriveApp.getFoldersByName(folderName);
          var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
          var base64Data = data.image.split(",")[1];
          var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), "image/jpeg",
            "dlv_" + data.branch + "_" + new Date().getTime() + ".jpg");
          var file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          imageUrl = file.getUrl();
          // Update last row with image URL
          var lastRow = sheet.getLastRow();
          sheet.getRange(lastRow, 9).setValue(imageUrl);
        } catch(e) { Logger.log("Image save error: " + e.message); }
      }

      // Telegram notification (use pre-built message from POS, or build one)
      var msg = data.tgMessage || (
        "\ud83d\udeb5 \u0e22\u0e2d\u0e14\u0e02\u0e32\u0e22 Delivery\n" +
        "\ud83d\udccd " + data.branch + "\n" +
        "\ud83d\ude9a " + data.app + "\n" +
        "\ud83d\udcb0 Gross: \u0e3f" + Number(data.gross).toLocaleString() + "\n" +
        "\ud83d\udcb5 Net: \u0e3f" + Number(data.net).toLocaleString() + "\n" +
        "\ud83d\udd50 " + data.ts
      );
      if (imageUrl) msg += "\n\ud83d\udcf8 " + imageUrl;
      notifyTelegram(msg);
    }

        return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    notifyTelegram("\u274c POS Error: " + err.message);
    return ContentService.createTextOutput(JSON.stringify({ok:false, error:err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── GET: state_get / state_list / health check ──
function doGet(e) {
  var params = e.parameter || {};

  // ── ดึง state ของสาขา+วัน ──

  // ── ดึง state ล่าสุดของสาขา (ไม่จำกัดว่ากี่วันก่อน) ──
  if (params.type === "state_latest") {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName("CloudState");
      if (!sheet || sheet.getLastRow() < 2) {
        return ContentService.createTextOutput(JSON.stringify({ok:true, state:null})).setMimeType(ContentService.MimeType.JSON);
      }
      var rows = sheet.getRange(2, 1, sheet.getLastRow()-1, 4).getValues();
      function dateNum(ds) {
        var p = normDate(ds).split("/");
        if (p.length !== 3) return -1;
        return (parseInt(p[2],10)||0)*10000 + (parseInt(p[1],10)||0)*100 + (parseInt(p[0],10)||0);
      }
      var best = null, bestNum = -1;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][0] !== params.branch) continue;
        var n = dateNum(rows[i][1]);
        if (n > bestNum) { bestNum = n; best = rows[i]; }
      }
      if (!best) {
        return ContentService.createTextOutput(JSON.stringify({ok:true, state:null})).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        state: JSON.parse(best[3]),
        date: normDate(best[1]),
        updated_at: String(best[2])
      })).setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ok:false, error:err.message})).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (params.type === "state_get") {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName("CloudState");
      if (!sheet || sheet.getLastRow() < 2) {
        return ContentService.createTextOutput(JSON.stringify({ok:true, state:null})).setMimeType(ContentService.MimeType.JSON);
      }
      var rows = sheet.getRange(2, 1, sheet.getLastRow()-1, 4).getValues();
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][0] === params.branch && rows[i][1] === params.date) {
          return ContentService.createTextOutput(JSON.stringify({
            ok: true,
            state: JSON.parse(rows[i][3]),
            updated_at: rows[i][2]
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ok:true, state:null})).setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ok:false, error:err.message})).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ── summary ทุกสาขา (สำหรับ HQ dashboard) ──
  if (params.type === "state_list") {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName("CloudState");
      if (!sheet || sheet.getLastRow() < 2) {
        return ContentService.createTextOutput(JSON.stringify({ok:true, states:[]})).setMimeType(ContentService.MimeType.JSON);
      }
      var rows = sheet.getRange(2, 1, sheet.getLastRow()-1, 4).getValues();
      var states = [];
      rows.forEach(function(row) {
        if (!row[0] || !row[1]) return;
        try {
          var st = JSON.parse(row[3]);
          var totalAmount = 0, orderCount = 0, soldPieces = 0, frozenPieces = 0;
          if (st.sales) {
            orderCount = st.sales.length;
            st.sales.forEach(function(s){ totalAmount += (s.totalAmount || 0); });
          }
          if (st.stock) {
            Object.keys(st.stock).forEach(function(k) {
              var s = st.stock[k];
              soldPieces += (s.sold || 0);
              var recv = s.received_pieces || (s.received_packs||0)*10;
              frozenPieces += Math.max(0, recv - (s.fry_out||0));
            });
          }
          states.push({
            branch: row[0], date: normDate(row[1]), updated_at: row[2],
            lastStaff: st.lastStaff || null,
            totalAmount: totalAmount, orderCount: orderCount,
            soldPieces: soldPieces, frozenPieces: frozenPieces,
            pricePerPiece: st.pricePerPiece || 25
          });
        } catch(e2) {}
      });
      // เรียงจากใหม่ไปเก่า
      states.sort(function(a,b){ return (b.date + b.updated_at) > (a.date + a.updated_at) ? 1 : -1; });
      return ContentService.createTextOutput(JSON.stringify({ok:true, states:states})).setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ok:false, error:err.message})).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ok:true, status:"PUFF POS v4 running"})).setMimeType(ContentService.MimeType.JSON);
}

// ── ส่งข้อความ Telegram ──
function notifyTelegram(msg) {
  if (!TG_BOT_TOKEN || TG_BOT_TOKEN === "\u0e27\u0e32\u0e07\u0e15\u0e23\u0e07\u0e19\u0e35\u0e49") return;
  if (!TG_CHAT_ID   || TG_CHAT_ID   === "\u0e27\u0e32\u0e07\u0e15\u0e23\u0e07\u0e19\u0e35\u0e49") return;
  try {
    UrlFetchApp.fetch("https://api.telegram.org/bot" + TG_BOT_TOKEN + "/sendMessage", {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({chat_id: TG_CHAT_ID, text: msg})
    });
  } catch(err) { Logger.log("Telegram error: " + err.message); }
}

function testTelegram() {
  notifyTelegram(
    "\u2705 \u0e17\u0e14\u0e2a\u0e2d\u0e1a\u0e23\u0e30\u0e1a\u0e1a PUFF POS v4\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n" +
    "\u0e01\u0e32\u0e23\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d Telegram \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08!\n" +
    "\ud83d\udd50 \u0e40\u0e27\u0e25\u0e32: " + new Date().toLocaleString("th-TH", {timeZone:"Asia/Bangkok"})
  );
}

function testSheets() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  Logger.log("\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d Sheets \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: " + ss.getName());
}

function testCloudState() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("CloudState");
  Logger.log("CloudState sheet: " + (sheet ? "OK, rows=" + sheet.getLastRow() : "not found"));
}
