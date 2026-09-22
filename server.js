const express = require('express');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
// ĐIỀN TÊN TÀI KHOẢN TIKTOK CỦA BẠN VÀO ĐÂY (bỏ dấu @)
const tiktokUsername = "ten_tiktok_cua_ban"; 

let actionQueue = [];

let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

tiktokLiveConnection.on('gift', data => {
    console.log(`Nhận được quà: ${data.giftName} từ ${data.uniqueId}`);
    
    // Phân loại quà để gửi vào Roblox
    if (data.giftName === 'Rose') {
        actionQueue.push({ action: "Up5m", user: data.uniqueId });
    } else if (data.giftName === 'GG') {
        actionQueue.push({ action: "Down5m", user: data.uniqueId });
    } else if (data.giftName === 'Paper Crane') {
        actionQueue.push({ action: "PushBack", user: data.uniqueId });
    }
});

// Roblox sẽ gọi vào đường dẫn này để lấy lệnh
app.get('/api/roblox', (req, res) => {
    res.json(actionQueue);
    actionQueue = []; // Xóa dữ liệu sau khi Roblox đã lấy để không bị lặp
});

// Port mặc định của Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy ở port ${PORT}`);
    tiktokLiveConnection.connect().catch(err => console.error("Lỗi kết nối TikTok:", err));
});
