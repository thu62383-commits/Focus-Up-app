/**
 * FOCUSUP - CẤU HÌNH FIREBASE BACKEND
 * -------------------------------------------------------------------------
 * Hướng dẫn:
 * 1. Tạo dự án tại https://console.firebase.google.com/
 * 2. Bật Authentication -> Sign-in method -> Email/Password.
 * 3. Bật Cloud Firestore -> Create database (chọn khu vực asia-southeast1).
 * 4. Vào Project Settings -> Your apps -> Web app (</>) -> Copy firebaseConfig
 *    và dán đè vào đối tượng FIREBASE_CONFIG bên dưới.
 * 5. Nếu chưa điền cấu hình (apiKey rỗng hoặc mặc định), FocusUp tự động chạy
 *    ở chế độ Local Storage an toàn trên trình duyệt của bạn.
 */

const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

window.FocusUpFirebase = {
  enabled: false,
  auth: null,
  db: null,

  init() {
    try {
      if (
        typeof firebase !== "undefined" &&
        FIREBASE_CONFIG &&
        FIREBASE_CONFIG.apiKey &&
        FIREBASE_CONFIG.apiKey.trim() !== "" &&
        !FIREBASE_CONFIG.apiKey.includes("YOUR_")
      ) {
        firebase.initializeApp(FIREBASE_CONFIG);
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.enabled = true;
        console.log("[FocusUp] Firebase Backend đã kết nối thành công.");
      } else {
        this.enabled = false;
        console.log("[FocusUp] Chưa cấu hình Firebase. Đang chạy chế độ Local Storage.");
      }
    } catch (err) {
      console.error("[FocusUp] Lỗi khởi tạo Firebase:", err);
      this.enabled = false;
    }
    return this.enabled;
  }
};
