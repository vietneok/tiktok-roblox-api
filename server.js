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

const followedThisSession = new Set(); // mỗi người chỉ tính 1 lần/buổi live (chống follow-unfollow spam)
// (danh sách này được xóa mỗi khi kết nối được buổi live mới, xem connectToTikTok)

// [TỐI ƯU] Kho quà chờ Roblox lấy có giới hạn: lỡ game chưa mở mà quà dồn quá nhiều
// thì bỏ bớt quà CŨ NHẤT, tránh lúc mở game bị "xả" cả đống quà cũ một lúc.
const KHO_TOI_DA = 300;
function dayVaoKho(item) {
    giftQueue.push(item);
    if (giftQueue.length > KHO_TOI_DA) giftQueue.splice(0, giftQueue.length - KHO_TOI_DA);
}

// ==========================================
// BẢNG QUÀ: Tên quà TikTok (tiếng Anh) + giá xu  →  Mã thử thách trong Roblox
// Mã thử thách giữ nguyên theo từng mốc mét (vì model trong game đặt tên theo mã).
// Muốn đổi quà cho 1 mốc: chỉ sửa "ten" và "xu" của dòng đó.
// ==========================================
const BANG_QUA = [
    // --- QUÀ TIẾN LÊN ---
    { ma: "HoaHong",     ten: "Rose",             xu: 1 },     // +100m
    { ma: "BanTim",      ten: "Finger Heart",     xu: 5 },     // +200m
    { ma: "Rosa",        ten: "Rosa",             xu: 10 },    // +500m
    { ma: "NuocHoa",     ten: "Perfume",          xu: 20 },    // +750m
    { ma: "BanhVong",    ten: "Doughnut",         xu: 30 },    // +1km
    { ma: "ThaTim",      ten: "Hand Heart",       xu: 100 },   // +2km
    { ma: "SaoDem",      ten: "Night Star",       xu: 199 },   // +5km
    { ma: "ChoCorgi",    ten: "Corgi",            xu: 299 },   // +10km
    { ma: "SungBanTien", ten: "Money Gun",        xu: 500 },   // +20km
    { ma: "ThienNga",    ten: "Swan",             xu: 699 },   // +30km
    { ma: "ThienHa",     ten: "Galaxy",           xu: 1000 },  // +50km
    { ma: "CaVoi",       ten: "Whale Diving",     xu: 2150 },  // +100km (về đích ngay)

    // --- QUÀ CỘNG WIN ---
    { ma: "PhiCo",       ten: "Flying Jets",      xu: 5000 },  // +5 WIN
    { ma: "SuTu",        ten: "Lion",             xu: 29999 }, // +10 WIN

    // --- QUÀ ĐẨY LÙI ---
    { ma: "GG",          ten: "GG",               xu: 1 },     // -120m
    { ma: "AnhSao",      ten: "Ice cream",        xu: 5 },     // -220m
    { ma: "CoBonLa",     ten: "Lucky Pig",        xu: 10 },    // -520m
    { ma: "HoanHo",      ten: "Bravo!",           xu: 15 },    // -800m
    { ma: "LittleKisses",ten: "little kisses",    xu: 20 },    // -1.05km
    { ma: "MuVaRiaMep",  ten: "Hat and Mustache", xu: 99 },    // -2.05km
    { ma: "PhaoBongQue", ten: "Side by Side",     xu: 199 },   // -5.05km
    { ma: "Meo",         ten: "Boxing Gloves",    xu: 299 },   // -10.05km
    { ma: "NangTienCa",  ten: "Mermaid",          xu: 500 },   // -20.05km
    { ma: "SuaPhatSang", ten: "Glowing Jellyfish",xu: 1000 },  // -50.05km
    { ma: "PhaoHoaBiAn", ten: "Mystery Firework", xu: 1999 },  // -100km (về vạch xuất phát)
];

// Danh sách mã thử thách (để làm nút test trên trang /gifts)
const ALL_ACTIONS = BANG_QUA.map(q => q.ma);

// So tên quà KHÔNG phân biệt hoa/thường và bỏ qua dấu câu ("Bravo!" = "bravo")
function chuanHoaTen(ten) {
    return String(ten || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
const QUA_THEO_TEN = {};
for (const q of BANG_QUA) QUA_THEO_TEN[chuanHoaTen(q.ten)] = q;

// [MỚI] Tìm quà theo tên + kiểm tra giá.
// Có quà trùng tên nhưng khác giá ở nước khác (vd "Boxing Gloves" có bản 5 xu và 299 xu):
// nếu quà thật RẺ HƠN NHIỀU so với giá trong bảng thì KHÔNG tính, tránh bị phá bằng quà rẻ.
function timQua(tenQua, xuThat) {
    const q = QUA_THEO_TEN[chuanHoaTen(tenQua)];
    if (!q) return { qua: null, lyDo: 'chưa có trong bảng' };
    if (xuThat && q.xu && xuThat < q.xu * 0.5) {
        return { qua: null, lyDo: `trùng tên nhưng rẻ hơn nhiều (${xuThat} xu, bảng ghi ${q.xu} xu)` };
    }
    return { qua: q, lyDo: '' };
}
function timMaQua(tenQua, xuThat) {
    const kq = timQua(tenQua, xuThat);
    return kq.qua ? kq.qua.ma : null;
}
function tenQuaTheoMa(ma) {
    const q = BANG_QUA.find(x => x.ma === ma);
    return q ? q.ten : ma;
}

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
        followedThisSession.clear(); // [TỐI ƯU] buổi live mới: ai follow cũng được tính lại
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
    const displayName = user.nickname || ""; // tên hiển thị TikTok; trống thì Roblox tự hiện @ID
    const amount = data.repeatCount || 1;
    const giftCoins = giftInfo.diamondCount || giftInfo.diamond_count || 0; // giá thật của quà (xu)

    console.log(`[QUÀ TỚI] ${senderName} tặng ${amount}x ${giftName} (${giftCoins} xu, id ${data.giftId})`);

    // Tra tên + giá quà trong BANG_QUA (ở đầu file)
    const { qua, lyDo } = timQua(giftName, giftCoins);

    // Đẩy quà vào kho cho Roblox lấy
    if (qua) {
        dayVaoKho({ action: qua.ma, user: senderName, name: displayName, amount: amount, gift: giftName });
        lastGift = `${senderName} tặng ${amount}x ${giftName} → ${qua.ma}`;
    } else {
        console.log(`[QUÀ KHÔNG TÍNH] "${giftName}" (${giftCoins} xu, id ${data.giftId}): ${lyDo}`);
        lastGift = `KHÔNG TÍNH: "${giftName}" từ ${senderName} (${lyDo})`;
    }
});

// ==========================================
// [MỚI] XỬ LÝ KHI CÓ NGƯỜI FOLLOW
// ==========================================

tiktokLiveConnection.on(WebcastEvent.FOLLOW, data => {
    const user = data.user || {};
    const senderName = user.uniqueId || user.displayId || user.nickname || "Ẩn danh";
    const displayName = user.nickname || ""; // trống thì Roblox tự hiện @ID

    if (followedThisSession.has(senderName)) return;
    followedThisSession.add(senderName);

    console.log(`[FOLLOW] ${displayName} (@${senderName}) vừa follow`);
    dayVaoKho({ action: "Follow", user: senderName, name: displayName, amount: 1 });
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

// [MỚI] Lấy danh sách quà thẳng từ TikTok (cách miễn phí, không cần gói trả phí của Euler)
async function layDanhSachQua() {
    const roomId = tiktokLiveConnection.roomId;
    if (!roomId) throw new Error('Chưa kết nối được phòng live');
    const wc = tiktokLiveConnection.webClient;
    const body = await wc.getJsonObjectFromWebcastApi('gift/list/', { ...wc.clientParams, room_id: roomId }, false);
    const gifts = body && body.data && body.data.gifts;
    if (Array.isArray(gifts) && gifts.length > 0) return gifts;
    throw new Error('TikTok không trả về danh sách quà');
}

app.get('/gifts', async (req, res) => {
    // Phần 1: nút test từng thử thách (không tốn xu)
    const buttons = ["Follow", ...ALL_ACTIONS].map(a =>
        `<a href="/test?action=${a}" target="_blank" style="display:inline-block;margin:4px;padding:8px 12px;background:#eee;border-radius:6px;text-decoration:none">${a === 'Follow' ? 'Follow' : escapeHtml(tenQuaTheoMa(a))}</a>`
    ).join('');

    // Phần 2: danh sách quà thật của TikTok (cần đang live)
    let giftTable = '';
    try {
        const gifts = await layDanhSachQua();
        const list = (Array.isArray(gifts) ? gifts : [])
            .map(g => ({
                name: g.name || '',
                coins: g.diamond_count || 0,
                id: g.id,
                // [MỚI] ảnh quà để nhận ra quà giống như trong app TikTok
                img: (g.image && g.image.url_list && g.image.url_list[0])
                    || (g.icon && g.icon.url_list && g.icon.url_list[0]) || ''
            }))
            .sort((a, b) => a.coins - b.coins);

        const rows = list.map(g => {
            const code = timMaQua(g.name, g.coins);
            const status = code ? `✅ ${code}` : '—';
            const bg = code ? '#e8f8e8' : '#fff';
            const imgTag = g.img ? `<img src="${escapeHtml(g.img)}" width="48" height="48" referrerpolicy="no-referrer" loading="lazy">` : '';
            return `<tr style="background:${bg}"><td>${imgTag}</td><td>${escapeHtml(g.name)}</td><td>${g.coins}</td><td>${status}</td><td>${g.id}</td></tr>`;
        }).join('');

        giftTable = `<p>Có ${list.length} quà, xếp từ rẻ đến đắt. <b>Dòng xanh</b> là quà đã có trong bảng.</p>
            <p>Tìm quà theo <b>ảnh + số xu</b>, rồi xem cột "Tên quà" để biết tên chính xác TikTok gửi về.</p>
            <table border="1" cellpadding="6" style="border-collapse:collapse">
            <tr><th>Ảnh</th><th>Tên quà (TikTok gửi về)</th><th>Xu</th><th>Mã thử thách</th><th>ID</th></tr>${rows}</table>`;
    } catch (err) {
        giftTable = `<p>⚠️ Chưa lấy được danh sách quà từ TikTok (cần <b>đang live</b> và trang chủ báo <b>ĐÃ KẾT NỐI</b>).</p>
            <p>Lý do: ${escapeHtml(err && err.message ? err.message : err)}</p>
            <p>👉 Cách khác (miễn phí): mở <a href="https://www.eulerstream.com/tools/tiktok-gifts-calculator" target="_blank">bảng quà TikTok của Euler Stream</a>,
            tìm quà theo <b>ảnh + số xu</b>, rồi lấy <b>tên tiếng Anh</b> ghi dưới ảnh.</p>`;
    }

    res.send(`<meta name="viewport" content="width=device-width, initial-scale=1">
        <h2>🎁 Test quà miễn phí</h2>
        <p>Vào game trên điện thoại trước, rồi bấm nút bất kỳ:</p>
        <div>${buttons}</div>
        <p>Thử tên dài: <a href="/test?action=Follow&user=test_ten_dai&name=${encodeURIComponent('Nguyễn Văn Siêu Dài Ơi Là Dài 🌸')}" target="_blank">Follow tên dài</a>
         · <a href="/test?action=CaVoi&amount=10&user=test_ten_dai2&name=${encodeURIComponent('Người Xem Có Cái Tên Rất Là Dài')}" target="_blank">Cá Voi x10 tên dài</a></p>
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
    const displayName = req.query.name || senderName;
    const amount = parseInt(req.query.amount) || 1;

    const giftName = req.query.gift || tenQuaTheoMa(actionCode);

    dayVaoKho({ action: actionCode, user: senderName, name: displayName, amount: amount, gift: giftName });
    res.send(`✅ Đã giả lập thành công! [${senderName}] vừa tặng ${amount}x [${giftName} → ${actionCode}]. Hãy vào Roblox để xem nhân vật bơi nhé!`);
});

// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server All-in-One đang chạy trên port ${PORT}`);
});
