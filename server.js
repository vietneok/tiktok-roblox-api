const express = require('express');
// [SỬA] Dùng cách kết nối CHÍNH của thư viện bản 2 (chế độ "legacy" bị lỗi làm sập server)
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');

const app = express();
app.use(express.json());

// ==========================================
// TÊN TIKTOK CỦA BẠN
// ==========================================
const tiktokUsername = "viet1226x";

let giftQueue = [];

// ==========================================
// BẢNG QUÀ: Tên quà TikTok  →  Mã thử thách trong Roblox
// (Muốn thêm quà: thêm 1 dòng theo đúng mẫu)
// ==========================================
const GIFT_MAP = {
    // --- QUÀ TIẾN LÊN ---
    "Rose": "HoaHong", "Hoa Hồng": "HoaHong", "Hoa hồng": "HoaHong",
    "Finger Heart": "BanTim", "Bắn Tim": "BanTim", "Bắn tim": "BanTim",
    "Rosa": "Rosa",
    "Perfume": "NuocHoa", "Nước hoa": "NuocHoa", "Nước Hoa": "NuocHoa",
    "Doughnut": "BanhVong", "Bánh vòng": "BanhVong", "Bánh Vòng": "BanhVong",
    "Heart Me": "ThaTim", "Thả tim": "ThaTim", "Thả Tim": "ThaTim",
    "Sao đêm": "SaoDem", "Sao Đêm": "SaoDem",
    "Corgi": "ChoCorgi", "Chó Corgi": "ChoCorgi",
    "Money Gun": "SungBanTien", "Súng bắn tiền": "SungBanTien", "Súng Bắn Tiền": "SungBanTien",
    "Swan": "ThienNga", "Thiên nga": "ThienNga", "Thiên Nga": "ThienNga",
    "Galaxy": "ThienHa", "Thiên hà": "ThienHa", "Thiên Hà": "ThienHa",
    "Whale": "CaVoi", "Cá Voi": "CaVoi", "Cá voi": "CaVoi",

    // --- QUÀ ĐẨY LÙI ---
    "GG": "GG",
    "Shining Star": "AnhSao", "Ánh sao tỏa sáng": "AnhSao", "Ánh sao": "AnhSao",
    "Lucky Clover": "CoBonLa", "Cỏ bốn lá": "CoBonLa",
    "Bravo": "HoanHo", "Hoan hô": "HoanHo",
    "Little Kisses": "LittleKisses",
    "Hat and Mustache": "MuVaRiaMep", "Mũ và ria mép": "MuVaRiaMep", "Mũ và Ria mép": "MuVaRiaMep",
    "Sparkler": "PhaoBongQue", "Pháo bông que": "PhaoBongQue", "Pháo Bông Que": "PhaoBongQue",
    "Cat": "Meo", "Mèo": "Meo",
    "Mermaid": "NangTienCa", "Nàng tiên cá": "NangTienCa", "Nàng Tiên Cá": "NangTienCa",
    "Glowing Jellyfish": "SuaPhatSang", "Sứa phát sáng": "SuaPhatSang", "Sứa Phát Sáng": "SuaPhatSang",
    "Mystery Fireworks": "PhaoHoaBiAn", "Pháo hoa bí ẩn": "PhaoHoaBiAn", "Pháo Hoa Bí Ẩn": "PhaoHoaBiAn",
};

// Danh sách mã thử thách (để làm nút test trên trang /gifts)
const ALL_ACTIONS = [...new Set(Object.values(GIFT_MAP))];

// [MỚI] Ghi lại trạng thái để bạn mở link Render là xem được ngay
let tiktokStatus = "Chưa kết nối";
let lastError = "";
let lastGift = "Chưa có";

// ==========================================
// 1. CÁI ĂNG-TEN: TỰ ĐỘNG DÒ TÌM & KẾT NỐI TIKTOK
// ==========================================
const tiktokLiveConnection = new TikTokLiveConnection(tiktokUsername, {});

// [MỚI] Chỉ hẹn giờ kết nối lại 1 lần, tránh bị kết nối chồng 2 lần
let reconnectTimer = null;
function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectToTikTok();
    }, 15000);
}

function connectToTikTok() {
    console.log(`Đang dò tìm luồng Live của [${tiktokUsername}]...`);
    tiktokStatus = "Đang dò tìm...";

    tiktokLiveConnection.connect().then(state => {
        tiktokStatus = "ĐÃ KẾT NỐI";
        lastError = "";
        console.log(`[OK] Đã kết nối thành công Live của: ${tiktokUsername} (phòng ${state.roomId})`);
    }).catch(err => {
        // [MỚI] In ra LÝ DO lỗi thật, trước đây bị giấu mất
        lastError = (err && err.message) ? err.message : String(err);
        tiktokStatus = "Chưa kết nối được";
        console.error(`[CHỜ LIVE] Chưa kết nối được. Lý do: ${lastError}`);
        scheduleReconnect();
    });
}

// Bắt sự kiện khi bạn tắt Live hoặc rớt mạng để tự động quét lại
tiktokLiveConnection.on(ControlEvent.DISCONNECTED, () => {
    tiktokStatus = "Mất kết nối";
    console.log('[NGẮT KẾT NỐI] Luồng Live đã tắt hoặc rớt mạng. Chờ Live lại...');
    scheduleReconnect();
});

// [MỚI] Bắt lỗi chung, tránh server bị sập khi TikTok trả lỗi lạ
tiktokLiveConnection.on(ControlEvent.ERROR, err => {
    const info = (err && err.info) ? err.info : '';
    const detail = (err && err.exception && err.exception.message) ? err.exception.message : '';
    console.error('[LỖI TIKTOK]', info, detail);
});

// [MỚI] Lưới an toàn: có lỗi lạ thì ghi lại chứ KHÔNG để server sập
process.on('uncaughtException', err => {
    lastError = 'Lỗi lạ: ' + (err && err.message ? err.message : String(err));
    console.error('[LỖI LẠ - ĐÃ CHẶN]', err);
});
process.on('unhandledRejection', err => {
    console.error('[LỖI LẠ - ĐÃ CHẶN]', err);
});

// Kích hoạt ăng-ten
connectToTikTok();

// ==========================================
// XỬ LÝ KHI CÓ NGƯỜI TẶNG QUÀ
// ==========================================
tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
    // [SỬA] Bản 2 để thông tin quà trong data.gift, người tặng trong data.user
    const giftInfo = data.gift || data.giftDetails || {};
    const giftType = (giftInfo.type !== undefined) ? giftInfo.type : giftInfo.giftType;
    if (giftType === 1 && !data.repeatEnd) return; // quà combo chưa bấm xong thì đợi

    const giftName = giftInfo.name || giftInfo.giftName || "";
    const user = data.user || {};
    const senderName = user.uniqueId || user.displayId || user.nickname || "Ẩn danh";
    const amount = data.repeatCount || 1;

    console.log(`[QUÀ TỚI] ${senderName} tặng ${amount}x ${giftName} (id ${data.giftId})`);

    // Tra tên quà trong bảng GIFT_MAP (ở cuối phần cài đặt phía trên)
    const actionCode = GIFT_MAP[giftName] || null;

    // Đẩy quà vào kho cho Roblox lấy
    if (actionCode) {
        giftQueue.push({ action: actionCode, user: senderName, amount: amount });
        lastGift = `${senderName} tặng ${amount}x ${giftName} → ${actionCode}`;
    } else {
        // [MỚI] Quà có tên chưa khớp bảng: trước đây bị bỏ qua im lặng
        console.log(`[QUÀ CHƯA CÓ TRONG BẢNG] Tên TikTok gửi về là: "${giftName}" (id ${data.giftId})`);
        lastGift = `CHƯA KHỚP BẢNG: "${giftName}" từ ${senderName}`;
    }
});

// ==========================================
// [MỚI] TRANG KIỂM TRA: mở link Render là thấy tình trạng
// ==========================================
app.get('/', (req, res) => {
    res.send(`
        <h2>TikTok ↔ Roblox</h2>
        <p>Kênh TikTok: <b>${tiktokUsername}</b></p>
        <p>Trạng thái TikTok: <b>${tiktokStatus}</b></p>
        <p>Lỗi gần nhất: ${lastError || "Không có"}</p>
        <p>Quà gần nhất: ${lastGift}</p>
        <p>Quà đang chờ Roblox lấy: ${giftQueue.length}</p>
    `);
});

// ==========================================
// [MỚI] TRANG /gifts: XEM TÊN QUÀ THẬT & TEST MIỄN PHÍ
// ==========================================
function escapeHtml(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

app.get('/gifts', async (req, res) => {
    // Phần 1: nút test từng thử thách (không tốn xu)
    const buttons = ALL_ACTIONS.map(a =>
        `<a href="/test?action=${a}" target="_blank" style="display:inline-block;margin:4px;padding:8px 12px;background:#eee;border-radius:6px;text-decoration:none">${a}</a>`
    ).join('');

    // Phần 2: danh sách quà thật của TikTok (cần đang live)
    let giftTable = '';
    try {
        const gifts = await tiktokLiveConnection.fetchAvailableGifts();
        const list = (Array.isArray(gifts) ? gifts : [])
            .map(g => ({ name: g.name || '', coins: g.diamond_count || 0, id: g.id }))
            .sort((a, b) => a.coins - b.coins);

        const rows = list.map(g => {
            const code = GIFT_MAP[g.name];
            const status = code ? `✅ ${code}` : '—';
            const bg = code ? '#e8f8e8' : '#fff';
            return `<tr style="background:${bg}"><td>${escapeHtml(g.name)}</td><td>${g.coins}</td><td>${status}</td><td>${g.id}</td></tr>`;
        }).join('');

        giftTable = `<p>Có ${list.length} quà. Dòng xanh là quà đã có trong bảng.</p>
            <table border="1" cellpadding="6" style="border-collapse:collapse">
            <tr><th>Tên quà (TikTok gửi về)</th><th>Xu</th><th>Mã thử thách</th><th>ID</th></tr>${rows}</table>`;
    } catch (err) {
        giftTable = `<p>⚠️ Chưa lấy được danh sách quà. Bạn cần <b>đang live</b> và trang chủ báo <b>ĐÃ KẾT NỐI</b>.</p>
            <p>Lý do: ${escapeHtml(err && err.message ? err.message : err)}</p>`;
    }

    res.send(`<meta name="viewport" content="width=device-width, initial-scale=1">
        <h2>🎁 Test quà miễn phí</h2>
        <p>Vào game trên điện thoại trước, rồi bấm nút bất kỳ:</p>
        <div>${buttons}</div>
        <h2>📋 Danh sách quà thật của TikTok</h2>
        ${giftTable}`);
});

// ==========================================
// 2. CÁI KHO: ROBLOX GỌI VÀO LẤY QUÀ
// ==========================================
app.get('/api/roblox', (req, res) => {
    res.json(giftQueue);
    giftQueue = [];
});

// ==========================================
// 3. ĐƯỜNG LINK GIẢ LẬP ĐỂ BẠN TEST (WEB HACK)
// ==========================================
app.get('/test', (req, res) => {
    const actionCode = req.query.action || "HoaHong";
    const senderName = req.query.user || "Người_Test_Web";
    const amount = parseInt(req.query.amount) || 1;

    giftQueue.push({ action: actionCode, user: senderName, amount: amount });
    res.send(`✅ Đã giả lập thành công! [${senderName}] vừa tặng ${amount}x [${actionCode}]. Hãy vào Roblox để xem nhân vật bơi nhé!`);
});

// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server All-in-One đang chạy trên port ${PORT}`);
});
