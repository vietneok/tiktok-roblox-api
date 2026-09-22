const express = require('express');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();

// ĐIỀN TÊN TÀI KHOẢN TIKTOK CỦA BẠN VÀO ĐÂY (bỏ dấu @)
// Ví dụ: "idoltiktok123"
const tiktokUsername = "ten_tiktok_cua_ban"; 

// Mảng lưu trữ các lệnh để gửi cho Roblox
let actionQueue = [];

// Khởi tạo kết nối với luồng Live TikTok
let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

// Lắng nghe sự kiện tặng quà trên Live
tiktokLiveConnection.on('gift', data => {
    console.log(`Nhận được quà: ${data.giftName} từ ${data.uniqueId}`);
    
    // Phân loại quà
    if (data.giftName === 'Rose') {
        actionQueue.push({ action: "Up5m", user: data.uniqueId });
    } else if (data.giftName === 'GG') {
        actionQueue.push({ action: "Down5m", user: data.uniqueId });
    } else if (data.giftName === 'Paper Crane') {
        actionQueue.push({ action: "PushBack", user: data.uniqueId });
    }
});

// --- API 1: ĐƯỜNG DẪN CHO ROBLOX LẤY DỮ LIỆU ---
app.get('/api/roblox', (req, res) => {
    res.json(actionQueue);
    actionQueue = []; // Xóa hàng đợi sau khi Roblox đã lấy đi để không bị lặp lại
});

// --- API 2: ĐƯỜNG DẪN TEST DÀNH CHO BẠN ---
// Truy cập link này trên web để giả lập người xem tặng quà
app.get('/api/test/:action', (req, res) => {
    const actionType = req.params.action;
    
    if (actionType === 'up') {
        actionQueue.push({ action: "Up5m", user: "Test_User_VIP" });
        res.send("Đã giả lập thành công người xem tặng Hoa hồng (Đẩy lên 5m)!");
    } else if (actionType === 'down') {
        actionQueue.push({ action: "Down5m", user: "Test_User_VIP" });
        res.send("Đã giả lập thành công người xem tặng GG (Kéo xuống 5m)!");
    } else if (actionType === 'back') {
        actionQueue.push({ action: "PushBack", user: "Test_User_VIP" });
        res.send("Đã giả lập thành công người xem tặng Hạc giấy (Đẩy lùi 50m)!");
    } else {
        res.send("Lỗi: Nhập sai tên lệnh. Hãy thử /api/test/up , /api/test/down , hoặc /api/test/back");
    }
});

// --- KHỞI ĐỘNG SERVER ---
// Chạy server trên Port mặc định của Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy ở port ${PORT}`);
    
    // Kết nối vào TikTok
    tiktokLiveConnection.connect().then(state => {
        console.log(`Đã kết nối thành công với phiên Live của ${state.roomId}`);
    }).catch(err => {
        console.error("Lỗi kết nối TikTok (Có thể bạn chưa bật Live):", err);
    });
});
