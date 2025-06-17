// ======= CẤU HÌNH =======
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/xxx'; //THAY BẰNG WEBHOOK CỦA BẠN

// ======= GỬI TIN NHẮN LÊN DISCORD =======
function sendDiscordMessage(content) {
  if (content.length > 1900) content = content.substring(0, 1900) + '\n... (tin nhắn quá dài, đã cắt bớt)';
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ content }),
    muteHttpExceptions: true,
  };
  try {
    const response = UrlFetchApp.fetch(DISCORD_WEBHOOK_URL, options);
    Logger.log('Đã gửi Discord: ' + response.getResponseCode());
  } catch (e) {
    Logger.log('Lỗi gửi Discord: ' + e.toString());
  }
}

// ======= TRA CỨU LỊCH CÚP ĐIỆN THEO MÃ KH =======
function getLichCupDien(maKhachHang) {
  if (!maKhachHang) return '⚠️ Mã KH trống.';

  const tz = Session.getScriptTimeZone();
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 86400000);
  const tuNgay = Utilities.formatDate(today, tz, "dd-MM-yyyy");
  const denNgay = Utilities.formatDate(nextWeek, tz, "dd-MM-yyyy");

  const url = `https://www.cskh.evnspc.vn/TraCuu/GetThongTinLichNgungGiamCungCapDien?tuNgay=${tuNgay}&denNgay=${denNgay}&maKH=${encodeURIComponent(maKhachHang)}&ChucNang=MaKhachHang`;

  try {
    const html = UrlFetchApp.fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      muteHttpExceptions: true
    }).getContentText();

    if (html.includes('không có lịch ngừng giảm cung cấp điện')) {
      return `✅ Mã KH ${maKhachHang} - Không có lịch cúp điện từ ${tuNgay} đến ${denNgay}.`;
    }

    const lichMatches = [...html.matchAll(/<div class="item">([\s\S]*?)<\/div>/g)];
    if (lichMatches.length === 0) return `⚠️ Mã KH ${maKhachHang} - Không đọc được lịch cúp.`;

    let msg = `🔌 Mã KH ${maKhachHang} - Có ${lichMatches.length} đợt cúp điện:\n\n`;
    lichMatches.forEach((m, i) => {
      const b = m[1];
      const khuVuc = (b.match(/<strong>Khu vực: <\/strong>(.*?)<\/p>/) || [])[1]?.trim() || 'Không rõ';
      const tu = (b.match(/<strong>Từ: <\/strong>(.*?)<br>/) || [])[1]?.trim() || 'Không rõ';
      const den = (b.match(/<strong>Đến: <\/strong>(.*?)<\/p>/) || [])[1]?.trim() || 'Không rõ';
      const lyDo = (b.match(/<strong>Lý do: <\/strong>(.*?)<\/p>/) || [])[1]?.trim() || 'Không rõ';
      msg += `📍 Khu vực: ${khuVuc}\n⏰ ${tu} → ${den}\n🔧 Lý do: ${lyDo}\n---\n`;
    });

    return msg.trim();

  } catch (e) {
    return `❌ Mã KH ${maKhachHang} - Lỗi khi gọi API: ${e.toString()}`;
  }
}

// ======= GỬI BÁO CÁO HÀNG NGÀY =======
function sendDiscordDailyCupDienReport() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const values = sheet.getRange('A:A').getValues();
  const maKHList = values.map(r => String(r[0] || '').trim()).filter(Boolean);

  if (maKHList.length === 0) {
    sendDiscordMessage('ℹ️ Không có mã khách hàng trong cột A.');
    return;
  }

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  sendDiscordMessage(`📰 *Bắt đầu tra cứu lịch cúp điện ngày ${today} cho ${maKHList.length} mã KH...*`);
  Utilities.sleep(1500);

  for (const maKH of maKHList) {
    const result = getLichCupDien(maKH);
    sendDiscordMessage(result);
    Utilities.sleep(2000); // tránh spam server
  }

  sendDiscordMessage('📢 *Hoàn tất tra cứu lịch cúp điện hôm nay.*');
}

// ======= TRIGGER HÀNG NGÀY LÚC 8h =======
function createDailyTrigger() {
  deleteDailyTrigger();
  ScriptApp.newTrigger('sendDiscordDailyCupDienReport').timeBased().everyDays(1).atHour(8).create();
  SpreadsheetApp.getUi().alert('✅ Đã bật gửi lịch cúp điện hàng ngày lúc 8h sáng.');
}

function deleteDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'sendDiscordDailyCupDienReport') {
      ScriptApp.deleteTrigger(t);
    }
  }
  SpreadsheetApp.getUi().alert('🗑️ Đã xóa Trigger gửi hàng ngày.');
}

// ======= THÊM MENU VÀO GOOGLE SHEET =======
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Lịch Cúp Điện')
    .addItem('Gửi báo cáo hôm nay lên Discord', 'sendDiscordDailyCupDienReport')
    .addSeparator()
    .addItem('Bật gửi hàng ngày lúc 8h', 'createDailyTrigger')
    .addItem('Tắt gửi hàng ngày', 'deleteDailyTrigger')
    .addToUi();
}