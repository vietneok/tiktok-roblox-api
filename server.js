const express = require('express');
const { WebcastChat } = require('tiktok-live-connector');

const app = express();
app.use(express.json());

// ==========================================
// TÊN TIKTOK CỦA BẠN (Đã điền)
// ==========================================
const tiktokUsername = "viet1226x"; 

let giftQueue = [];

// ==========================================
// 1. CÁI ĂNG-TEN: TỰ BẮT SỰ KIỆN TỪ TIKTOK LIVE
// ==========================================
const tiktokLiveConnection = new WebcastChat(tiktokUsername);

tiktokLiveConnection.connect().then(state => {
    console.log(`[OK] Đã kết nối Live của: ${state.roomInfo.owner.uniqueId}`);
}).catch(err => {
    console.error('[LỖI] Không thể kết nối. Hãy chắc chắn bạn đang phát Live!', err);
});

tiktokLiveConnection.on('gift', data => {
    if (data.giftType === 1 && !data.repeatEnd) return;

    const giftName = data.giftName;
    const senderName = data.uniqueId;
    const amount = data.repeatCount || 1;

    console.log(`[QUÀ TỚI] ${senderName} tặng ${amount}x ${giftName}`);

    let actionCode = null; 
    
    // --- QUÀ TIẾN LÊN ---
    if (giftName === "Hoa Hồng" || giftName === "Rose") actionCode = "HoaHong";
    else if (giftName === "Bắn Tim" || giftName === "Finger Heart") actionCode = "BanTim";
    else if (giftName === "Rosa") actionCode = "Rosa";
    else if (giftName === "Nước hoa" || giftName === "Perfume") actionCode = "NuocHoa";
    else if (giftName === "Bánh vòng" || giftName === "Doughnut") actionCode = "BanhVong";
    else if (giftName === "Thả tim" || giftName === "Heart Me") actionCode = "ThaTim";
    else if (giftName === "Sao đêm") actionCode = "SaoDem";
    else if (giftName === "Chó Corgi" || giftName === "Corgi") actionCode = "ChoCorgi";
    else if (giftName === "Súng bắn tiền") actionCode = "SungBanTien";
    else if (giftName === "Thiên nga" || giftName === "Swan") actionCode = "ThienNga";
    else if (giftName === "Thiên hà" || giftName === "Galaxy") actionCode = "ThienHa";
    else if (giftName === "Cá Voi" || giftName === "Whale") actionCode = "CaVoi";

    // --- QUÀ ĐẨY LÙI ---
    else if (giftName === "GG") actionCode = "GG";
    else if (giftName === "Ánh sao tỏa sáng" || giftName === "Shining Star") actionCode = "AnhSao";
    else if (giftName === "Cỏ bốn lá" || giftName === "Lucky Clover") actionCode = "CoBonLa";
    else if (giftName === "Hoan hô" || giftName === "Bravo") actionCode = "HoanHo";
    else if (giftName === "Little Kisses") actionCode = "LittleKisses";
    else if (giftName === "Mũ và ria mép") actionCode = "MuVaRiaMep";
    else if (giftName === "Pháo bông que" || giftName === "Sparkler") actionCode = "PhaoBongQue";
    else if (giftName === "Mèo" || giftName === "Cat") actionCode = "Meo";
    else if (giftName === "Nàng tiên cá" || giftName === "Mermaid") actionCode = "NangTienCa";
    else if (giftName === "Sứa phát sáng" || giftName === "Glowing Jellyfish") actionCode = "SuaPhatSang";
    else if (giftName === "Pháo hoa bí ẩn" || giftName === "Mystery Fireworks") actionCode = "PhaoHoaBiAn";

    if (actionCode) {
        giftQueue.push({ action: actionCode, user: senderName, amount: amount });
    }
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
