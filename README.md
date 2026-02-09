# Swagger Token Manager

Chrome extension để quản lý và chuyển đổi token Swagger nhanh chóng mà không cần logout/login.

## Tính năng

- ✅ Lưu nhiều token với tên gọi riêng
- ✅ Chuyển đổi token chỉ với một click
- ✅ Không cần logout/login lại
- ✅ Giao diện đẹp, dễ sử dụng
- ✅ Tự động áp dụng token khi load trang Swagger
- ✅ Lưu trữ token an toàn trong Chrome Storage

## Hướng dẫn cài đặt

### Cài đặt Extension (Chế độ Developer)

1. Mở Chrome và truy cập `chrome://extensions/`

2. Bật chế độ **Developer mode** (góc trên bên phải)

3. Click nút **"Load unpacked"** (Tải tiện ích đã giải nén)

4. Chọn thư mục `e:\swagger-token-manager`

5. Extension sẽ được cài đặt và hiển thị icon trên thanh công cụ

## Hướng dẫn sử dụng

### Thêm Token Mới

1. Click vào icon **Swagger Token Manager** trên thanh công cụ Chrome

2. Nhập **Tên Token** (ví dụ: Dev Token, Production Token, Testing Token)

3. Nhập **Token Value** (JWT token hoặc API key)

4. Click nút **"➕ Thêm Token"**

5. Token sẽ được lưu vào danh sách

### Sử dụng Token

1. Truy cập trang Swagger UI (URL chứa `swagger`, `api-docs`, hoặc `api/docs`)

2. Click vào icon **Swagger Token Manager**

3. Click vào token bạn muốn sử dụng trong danh sách

4. Token sẽ tự động được áp dụng vào Swagger UI

5. Bạn có thể test API ngay lập tức mà không cần logout/login

### Xóa Token

1. Click vào icon **Swagger Token Manager**

2. Click nút **"🗑️ Xóa"** bên cạnh token muốn xóa

3. Token sẽ bị xóa khỏi danh sách

## Cấu trúc thư mục

```
swagger-token-manager/
├── manifest.json          # Cấu hình extension
├── popup.html            # Giao diện popup
├── popup.js              # Logic popup
├── content.js            # Script injection vào Swagger UI
├── styles.css            # CSS styling
├── icons/                # Icons cho extension
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # File này
```

## Cách hoạt động

Extension sử dụng nhiều phương pháp để inject token vào Swagger UI:

1. **Swagger UI API**: Sử dụng `window.ui.authActions.authorize()` nếu có
2. **UI Automation**: Tự động click nút Authorize và điền token
3. **LocalStorage**: Lưu token để tự động áp dụng khi reload trang
4. **Message Passing**: Popup giao tiếp với content script qua Chrome messaging API

## Lưu ý

- Extension chỉ hoạt động trên các trang có Swagger UI
- Token được lưu trữ an toàn trong Chrome Storage (local)
- Token sẽ tự động áp dụng lại khi bạn reload trang Swagger
- Extension tương thích với Swagger UI 2.x và 3.x

## Troubleshooting

### Token không được áp dụng?

- Đảm bảo bạn đang ở trang Swagger UI
- Thử refresh lại trang Swagger
- Kiểm tra Console (F12) để xem log

### Extension không hiển thị?

- Kiểm tra xem extension đã được bật trong `chrome://extensions/`
- Thử reload lại extension

## License

MIT License - Sử dụng tự do cho mục đích cá nhân và phi thương mại.
