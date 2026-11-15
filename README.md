# FocusUp v2.0 — Nền tảng Quản lý Thói quen Số & Tập trung Học tập Toàn diện

## 1. Cấu trúc thư mục dự án
- `index.html`: Giao diện chính (12 không gian chức năng đầy đủ).
- `styles.css`: Hệ thống giao diện hiện đại (Glassmorphism, Responsive, 6 bảng màu & Dark Mode, lớp phủ hình nền động).
- `app.js`: Toàn bộ logic xử lý (Quản lý nhiệm vụ độc lập theo ngày, Lịch sử tháng, Pomodoro nâng cao, Mô hình 4 Tự, XP & Rank, Focus Streak múi giờ Việt Nam, Báo cáo tháng, Âm thanh Web Audio API, Bạn bè & Bảng xếp hạng).
- `firebase-config.js`: Tệp cấu hình kết nối Firebase Authentication & Cloud Firestore.
- `firestore.rules`: Quy tắc bảo mật phía máy chủ (Firebase Security Rules) bảo vệ quyền riêng tư và chống sửa dữ liệu trái phép.

---

## 2. Hướng dẫn chạy trên máy tính (Local)
1. Giải nén thư mục `focusup_upgraded`.
2. Mở trực tiếp tệp `index.html` bằng trình duyệt bất kỳ (Chrome, Edge, Safari, Firefox) hoặc mở qua tiện ích **Live Server** trên VS Code.
3. Ngay lần đầu truy cập, ứng dụng chạy mượt mà ở chế độ **Local Storage** (dữ liệu lưu bền vững trên trình duyệt, có thể xuất/nhập file `.JSON` sao lưu bất kỳ lúc nào).

---

## 3. Hướng dẫn tạo Firebase Project & Kích hoạt Cloud + Bạn bè thật
1. Truy cập [Firebase Console](https://console.firebase.google.com/) và nhấn **Add project** (tạo dự án mới).
2. Vào menu **Build → Authentication → Get started → Sign-in method**, bật **Email/Password**.
3. Vào menu **Build → Firestore Database → Create database**, chọn chế độ Production mode và khu vực gần Việt Nam (`asia-southeast1` - Singapore).
4. Vào tab **Rules** trong Firestore Database, sao chép toàn bộ nội dung tệp `firestore.rules` dán vào và nhấn **Publish**.
5. Vào **Project Settings (biểu tượng bánh răng) → General → Your apps → Web (`</>`)**, đăng ký ứng dụng web và sao chép đối tượng `firebaseConfig`.
6. Mở tệp `firebase-config.js`, dán các khóa (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`) vào biến `FIREBASE_CONFIG` và lưu lại.

---

## 4. Hướng dẫn triển khai lên Hosting / GitHub Pages
- **Cách 1 (GitHub Pages miễn phí):**
  1. Tạo repository mới trên GitHub và tải toàn bộ các tệp trong thư mục `focusup_upgraded` lên nhánh `main`.
  2. Vào **Settings → Pages → Build and deployment**, chọn Branch `main` và nhấn **Save**.
  3. Sau 1-2 phút, website sẽ hoạt động trực tuyến qua đường dẫn `https://<ten-tai-khoan>.github.io/<ten-repo>/`.
- **Cách 2 (Firebase Hosting):**
  1. Cài đặt CLI: `npm install -g firebase-tools`
  2. Chạy `firebase login` và `firebase init hosting` (chọn thư mục public là `.`).
  3. Chạy `firebase deploy` để xuất bản.
