const express = require('express');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
app.use(express.json());

// ==========================================
// TÊN TIKTOK CỦA BẠN
// ==========================================
const tiktokUsername = "viet1226x";

let giftQueue = [];

// [MỚI] Ghi lại trạng thái để bạn mở link Render là xem được ngay
let tiktokStatus = "Chưa kết nối";
let lastError = "";
let lastGift = "Chưa có";

// ==========================================
// 1. CÁI ĂNG-TEN: TỰ ĐỘNG DÒ TÌM & KẾT NỐI TIKTOK
// ==========================================
const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

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
        console.log(`[OK] Đã kết nối thành công Live của: ${state.roomInfo.owner.uniqueId}`);
    }).catch(err => {
        // [MỚI] In ra LÝ DO lỗi thật, trước đây bị giấu mất
        lastError = (err && err.message) ? err.message : String(err);
        tiktokStatus = "Chưa kết nối được";
        console.error(`[CHỜ LIVE] Chưa kết nối được. Lý do: ${lastError}`);
        scheduleReconnect();
    });
}

// Bắt sự kiện khi bạn tắt Live hoặc rớt mạng để tự động quét lại
tiktokLiveConnection.on('disconnected', () => {
    tiktokStatus = "Mất kết nối";
    console.log('[NGẮT KẾT NỐI] Luồng Live đã tắt hoặc rớt mạng. Chờ Live lại...');
    scheduleReconnect();
});

// Kích hoạt ăng-ten
connectToTikTok();

// ==========================================
// XỬ LÝ KHI CÓ NGƯỜI TẶNG QUÀ
// ==========================================
tiktokLiveConnection.on('gift', data => {
    if (data.giftType === 1 && !data.repeatEnd) return;

    const giftName = data.giftName;
    const senderName = data.uniqueId;
    const amount = data.repeatCount || 1;

    console.log(`[QUÀ TỚI] ${senderName} tặng ${amount}x ${giftName} (id ${data.giftId})`);

    let actionCode = null;

    // --- QUÀ TIẾN LÊN ---
    if (giftName === "Hoa Hồng" || giftName === "Hoa hồng" || giftName === "Rose") actionCode = "HoaHong";
    else if (giftName === "Bắn Tim" || giftName === "Bắn tim" || giftName === "Finger Heart") actionCode = "BanTim";
    else if (giftName === "Rosa") actionCode = "Rosa";
    else if (giftName === "Nước hoa" || giftName === "Nước Hoa" || giftName === "Perfume") actionCode = "NuocHoa";
    else if (giftName === "Bánh vòng" || giftName === "Bánh Vòng" || giftName === "Doughnut") actionCode = "BanhVong";
    else if (giftName === "Thả tim" || giftName === "Thả Tim" || giftName === "Heart Me") actionCode = "ThaTim";
    else if (giftName === "Sao đêm" || giftName === "Sao Đêm") actionCode = "SaoDem";
    else if (giftName === "Chó Corgi" || giftName === "Corgi") actionCode = "ChoCorgi";
    else if (giftName === "Súng bắn tiền" || giftName === "Súng Bắn Tiền" || giftName === "Money Gun") actionCode = "SungBanTien";
    else if (giftName === "Thiên nga" || giftName === "Thiên Nga" || giftName === "Swan") actionCode = "ThienNga";
    else if (giftName === "Thiên hà" || giftName === "Thiên Hà" || giftName === "Galaxy") actionCode = "ThienHa";
    else if (giftName === "Cá Voi" || giftName === "Cá voi" || giftName === "Whale") actionCode = "CaVoi";

    // --- QUÀ ĐẨY LÙI ---
    else if (giftName === "GG") actionCode = "GG";
    else if (giftName === "Ánh sao tỏa sáng" || giftName === "Ánh sao" || giftName === "Shining Star") actionCode = "AnhSao";
    else if (giftName === "Cỏ bốn lá" || giftName === "Lucky Clover") actionCode = "CoBonLa";
    else if (giftName === "Hoan hô" || giftName === "Bravo") actionCode = "HoanHo";
    else if (giftName === "Little Kisses") actionCode = "LittleKisses";
    else if (giftName === "Mũ và ria mép" || giftName === "Mũ và Ria mép" || giftName === "Hat and Mustache") actionCode = "MuVaRiaMep";
    else if (giftName === "Pháo bông que" || giftName === "Pháo Bông Que" || giftName === "Sparkler") actionCode = "PhaoBongQue";
    else if (giftName === "Mèo" || giftName === "Cat") actionCode = "Meo";
    else if (giftName === "Nàng tiên cá" || giftName === "Nàng Tiên Cá" || giftName === "Mermaid") actionCode = "NangTienCa";
    else if (giftName === "Sứa phát sáng" || giftName === "Sứa Phát Sáng" || giftName === "Glowing Jellyfish") actionCode = "SuaPhatSang";
    else if (giftName === "Pháo hoa bí ẩn" || giftName === "Pháo Hoa Bí Ẩn" || giftName === "Mystery Fireworks") actionCode = "PhaoHoaBiAn";

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
