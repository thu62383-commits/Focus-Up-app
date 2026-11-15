/**
 * FOCUSUP v2.0 - CORE APPLICATION ENGINE
 * Múi giờ chuẩn: Asia/Ho_Chi_Minh (UTC+7)
 */

// ============================================================================
// 1. TIỆN ÍCH NGÀY THÁNG & MÚI GIỜ VIỆT NAM (Asia/Ho_Chi_Minh)
// ============================================================================
function getVNDateString(dateObj = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(dateObj);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

function getVNTimeString(dateObj = new Date()) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(dateObj);
}

function diffDaysVN(dateStrA, dateStrB) {
  const a = new Date(dateStrA + 'T00:00:00+07:00');
  const b = new Date(dateStrB + 'T00:00:00+07:00');
  return Math.round((b - a) / 86400000);
}

function addDaysVN(dateStr, deltaDays) {
  const d = new Date(dateStr + 'T00:00:00+07:00');
  d.setDate(d.getDate() + deltaDays);
  return getVNDateString(d);
}

function formatDisplayDateVN(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ============================================================================
// 2. HỆ THỐNG CẤP BẬC (RANKS) & CẤU TRÚC DỮ LIỆU CHUẨN
// ============================================================================
const RANKS = [
  { id: 'beginner', icon: '🌱', name: 'Beginner', vn: 'Người mới bắt đầu', minXp: 0 },
  { id: 'learner', icon: '📘', name: 'Learner', vn: 'Người học tập', minXp: 100 },
  { id: 'focused', icon: '🎯', name: 'Focused', vn: 'Người tập trung', minXp: 300 },
  { id: 'disciplined', icon: '🔥', name: 'Disciplined', vn: 'Người kỷ luật', minXp: 700 },
  { id: 'master', icon: '⚡', name: 'Master Focus', vn: 'Bậc thầy tập trung', minXp: 1500 },
  { id: 'legend', icon: '👑', name: 'Focus Legend', vn: 'Huyền thoại tập trung', minXp: 3000 }
];

function getRankInfo(xp) {
  let current = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].minXp) {
      current = RANKS[i];
      next = RANKS[i + 1] || null;
    }
  }
  const progressPct = next
    ? Math.min(100, Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100))
    : 100;
  return { current, next, progressPct };
}

function createDefaultUserData(displayName = '', uid = null) {
  const today = getVNDateString();
  const code = 'FU-' + Math.random().toString(36).substring(2, 7).toUpperCase();
  return {
    uid: uid || generateId('local_user'),
    profile: {
      displayName: displayName,
      friendCode: code,
      startDate: today,
      isOnboarded: Boolean(displayName)
    },
    xp: 0,
    xpTransactions: [], // { id, amount, reason, refId, date, timestamp }
    streak: {
      current: 0,
      longest: 0,
      lastCompletedDate: null,
      breakHistory: [] // { fromDate, toDate, lostStreak }
    },
    // Phân tách dữ liệu độc lập theo từng ngày YYYY-MM-DD
    dailyData: {
      // [dateStr]: {
      //   tasks: [ { id, title, desc, group, duration, completed, xpAwarded, createdAt } ],
      //   focusSessions: [ { id, startTime, endTime, duration, mode } ],
      //   slowActivities: [ { id, title, duration, note } ],
      //   connectActivities: [ { id, title, duration, note } ],
      //   selfLimits: [ 'no_notif', 'limit_short', 'phone_away' ]
      // }
    },
    distractionNotes: [],
    quizScore: null,
    preferences: {
      theme: 'default',
      bgImageUrl: '',
      bgVideoUrl: '',
      videoEnabled: true,
      overlayOpacity: 85,
      audioUrl: '',
      audioLoop: true,
      bgVolume: 50,
      sfxEnabled: true,
      sfxVolume: 40
    },
    privacy: {
      shareProfile: true,
      shareHistory: true,
      allowSearch: true
    },
    blockedUsers: [] // [ { uid, displayName } ]
  };
}

// ============================================================================
// 3. QUẢN LÝ TRẠNG THÁI & LƯU TRỮ (LOCAL + FIREBASE SYNC)
// ============================================================================
const LOCAL_STORAGE_KEY = 'focusup_v2_userdata';
let state = null;
let currentUser = null; // Firebase User object nếu đã đăng nhập
let selectedTaskDate = getVNDateString();
let calCurrentYear = Number(getVNDateString().split('-')[0]);
let calCurrentMonth = Number(getVNDateString().split('-')[1]); // 1-12
let calSelectedDate = getVNDateString();
let authTabMode = 'login';

function ensureDayBucket(dateStr) {
  if (!state.dailyData[dateStr]) {
    state.dailyData[dateStr] = {
      tasks: [],
      focusSessions: [],
      slowActivities: [],
      connectActivities: [],
      selfLimits: []
    };
  }
  const b = state.dailyData[dateStr];
  if (!Array.isArray(b.tasks)) b.tasks = [];
  if (!Array.isArray(b.focusSessions)) b.focusSessions = [];
  if (!Array.isArray(b.slowActivities)) b.slowActivities = [];
  if (!Array.isArray(b.connectActivities)) b.connectActivities = [];
  if (!Array.isArray(b.selfLimits)) b.selfLimits = [];
  return b;
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const def = createDefaultUserData(parsed?.profile?.displayName || '');
      state = {
        ...def,
        ...parsed,
        profile: { ...def.profile, ...(parsed.profile || {}) },
        streak: { ...def.streak, ...(parsed.streak || {}) },
        preferences: { ...def.preferences, ...(parsed.preferences || {}) },
        privacy: { ...def.privacy, ...(parsed.privacy || {}) },
        dailyData: parsed.dailyData || {}
      };
      return;
    }
  } catch (e) {
    console.error('Lỗi đọc dữ liệu local:', e);
  }
  state = createDefaultUserData('');
}

async function saveState(syncCloud = true) {
  try {
    recalculateStreakAndTotals();
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));

    if (syncCloud && window.FocusUpFirebase.enabled && currentUser) {
      const uid = currentUser.uid;
      const db = window.FocusUpFirebase.db;
      await db.collection('users').doc(uid).set(state, { merge: true });
      await syncPublicProfileToCloud();
    }
  } catch (err) {
    console.error('Lỗi lưu dữ liệu:', err);
    showToast('⚠️ Lỗi đồng bộ đám mây, đã lưu tạm trên máy.');
  }
  renderAll();
}

async function syncPublicProfileToCloud() {
  if (!window.FocusUpFirebase.enabled || !currentUser) return;
  const stats = computeGlobalStats();
  const rankInfo = getRankInfo(state.xp);
  await window.FocusUpFirebase.db.collection('public_profiles').doc(currentUser.uid).set({
    uid: currentUser.uid,
    displayName: state.profile.displayName || 'Người dùng FocusUp',
    displayNameLower: (state.profile.displayName || '').toLowerCase(),
    friendCode: state.profile.friendCode,
    allowSearch: state.privacy.allowSearch,
    shareProfile: state.privacy.shareProfile,
    shareHistory: state.privacy.shareHistory,
    xp: state.xp,
    rankName: `${rankInfo.current.icon} ${rankInfo.current.name}`,
    streakCurrent: state.streak.current,
    totalFocusMinutes: stats.totalFocusMinutes,
    totalCompletedTasks: stats.totalCompletedTasks,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

// ============================================================================
// 4. HỆ THỐNG ÂM THANH (WEB AUDIO API + NHẠC NỀN)
// ============================================================================
let audioCtx = null;
let lastSfxTime = 0;

function playSfx(type = 'click') {
  if (!state || !state.preferences.sfxEnabled) return;
  const now = Date.now();
  if (now - lastSfxTime < 120) return; // Chống chồng âm liên tục
  lastSfxTime = now;

  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const vol = Math.max(0.01, (state.preferences.sfxVolume || 40) / 100 * 0.25);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const t = audioCtx.currentTime;
    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t);
      gain.gain.setValueAtTime(vol * 0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.start(t);
      osc.stop(t + 0.06);
    } else if (type === 'add') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.setValueAtTime(660, t + 0.07);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.start(t);
      osc.stop(t + 0.16);
    } else if (type === 'delete') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.12);
      gain.gain.setValueAtTime(vol * 0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t);
      osc.stop(t + 0.12);
    } else if (type === 'complete') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, t + 0.16); // G5
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    } else if (type === 'levelup') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, t);
      osc.frequency.setValueAtTime(659.25, t + 0.1);
      osc.frequency.setValueAtTime(783.99, t + 0.2);
      osc.frequency.setValueAtTime(1046.5, t + 0.3);
      gain.gain.setValueAtTime(vol * 1.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t);
      osc.stop(t + 0.55);
    }
  } catch (e) {
    // Bỏ qua lỗi âm thanh để không ảnh hưởng chức năng chính
  }
}

// ============================================================================
// 5. HỆ THỐNG TÍNH TOÁN XP & CHỐNG GIAN LẬN
// ============================================================================
function grantXP(amount, reason, refId = null) {
  if (amount === 0) return;
  if (refId) {
    // Kiểm tra xem refId đã từng nhận XP dương chưa (tránh nhận trùng khi reload hoặc spam)
    const alreadyGranted = state.xpTransactions.some(tx => tx.refId === refId && tx.amount > 0);
    if (amount > 0 && alreadyGranted) return;
  }

  const prevRank = getRankInfo(state.xp).current.id;
  state.xp = Math.max(0, state.xp + amount);
  const newRank = getRankInfo(state.xp).current;

  state.xpTransactions.unshift({
    id: generateId('xp'),
    amount,
    reason,
    refId,
    date: getVNDateString(),
    timestamp: new Date().toISOString()
  });
  if (state.xpTransactions.length > 200) state.xpTransactions.pop();

  if (newRank.id !== prevRank && amount > 0) {
    playSfx('levelup');
    showToast(`🎉 Chúc mừng! Bạn đã thăng hạng ${newRank.icon} ${newRank.name}!`);
  }
}

function revokeXPByRef(refId, reason) {
  const txIndex = state.xpTransactions.findIndex(tx => tx.refId === refId && tx.amount > 0);
  if (txIndex !== -1) {
    const originalAmount = state.xpTransactions[txIndex].amount;
    // Xóa refId cũ để nếu người dùng tích lại sau này vẫn hợp lệ
    state.xpTransactions[txIndex].refId = refId + '_revoked';
    state.xp = Math.max(0, state.xp - originalAmount);
    state.xpTransactions.unshift({
      id: generateId('xp'),
      amount: -originalAmount,
      reason,
      refId: null,
      date: getVNDateString(),
      timestamp: new Date().toISOString()
    });
  }
}

// ============================================================================
// 6. HỆ THỐNG CHUỖI TẬP TRUNG (FOCUS STREAK) - CHUẨN QUY TẮC 2 NGÀY
// ============================================================================
function recalculateStreakAndTotals() {
  // Lấy tất cả các ngày có ít nhất 1 nhiệm vụ hoàn thành
  const completedDates = Object.keys(state.dailyData)
    .filter(d => (state.dailyData[d].tasks || []).some(t => t.completed))
    .sort();

  if (completedDates.length === 0) {
    state.streak.current = 0;
    state.streak.lastCompletedDate = null;
    return;
  }

  let longest = 0;
  let tempStreak = 0;
  let prevDate = null;
  const breakHistory = [];

  for (const d of completedDates) {
    if (!prevDate) {
      tempStreak = 1;
    } else {
      const gap = diffDaysVN(prevDate, d);
      if (gap <= 2) {
        // gap === 1: liên tiếp; gap === 2: bỏ lỡ 1 ngày -> bảo lưu chuỗi
        tempStreak += 1;
      } else {
        // gap >= 3: tức có >= 2 ngày liên tiếp không hoàn thành -> đứt chuỗi
        breakHistory.push({
          fromDate: prevDate,
          toDate: d,
          lostStreak: tempStreak
        });
        tempStreak = 1;
      }
    }
    if (tempStreak > longest) longest = tempStreak;
    prevDate = d;
  }

  // Kiểm tra tính từ ngày hoàn thành gần nhất đến hôm nay (múi giờ VN)
  const today = getVNDateString();
  const gapToToday = diffDaysVN(prevDate, today);
  const currentStreak = gapToToday <= 2 ? tempStreak : 0;

  state.streak.current = currentStreak;
  state.streak.longest = Math.max(state.streak.longest || 0, longest);
  state.streak.lastCompletedDate = prevDate;
  state.streak.breakHistory = breakHistory;
}

function computeGlobalStats() {
  let activeDays = 0;
  let totalFocusMinutes = 0;
  let totalSlowMinutes = 0;
  let totalConnectMinutes = 0;
  let totalCompletedTasks = 0;
  let totalPomodoroSessions = 0;

  for (const dateStr of Object.keys(state.dailyData)) {
    const day = state.dailyData[dateStr];
    const doneTasks = (day.tasks || []).filter(t => t.completed).length;
    const focusMins = (day.focusSessions || []).reduce((s, x) => s + (Number(x.duration) || 0), 0);
    const slowMins = (day.slowActivities || []).reduce((s, x) => s + (Number(x.duration) || 0), 0);
    const connMins = (day.connectActivities || []).reduce((s, x) => s + (Number(x.duration) || 0), 0);

    if (doneTasks > 0 || focusMins > 0 || slowMins > 0 || connMins > 0 || (day.selfLimits || []).length > 0) {
      activeDays++;
    }
    totalCompletedTasks += doneTasks;
    totalFocusMinutes += focusMins;
    totalSlowMinutes += slowMins;
    totalConnectMinutes += connMins;
    totalPomodoroSessions += (day.focusSessions || []).length;
  }

  const daysSinceStart = Math.max(1, diffDaysVN(state.profile.startDate || getVNDateString(), getVNDateString()) + 1);
  return {
    activeDays,
    totalFocusMinutes,
    totalSlowMinutes,
    totalConnectMinutes,
    totalCompletedTasks,
    totalPomodoroSessions,
    daysSinceStart
  };
}

// ============================================================================
// 7. ĐIỀU HƯỚNG & UI CHUNG
// ============================================================================
const PAGE_META = {
  home: ['TỔNG QUAN', 'Chào bạn, hôm nay mình tập trung nhé!', 'Hành trình không giới hạn — tiến bộ từng ngày.'],
  tasks: ['NHIỆM VỤ THEO NGÀY', 'Quản lý mục tiêu từng ngày', 'Mỗi ngày có danh sách độc lập, không ảnh hưởng dữ liệu ngày khác.'],
  history: ['LỊCH SỬ HOẠT ĐỘNG', 'Nhật ký & Lịch theo tháng', 'Xem lại, chỉnh sửa hoặc bổ sung hoạt động của bất kỳ ngày nào.'],
  focus: ['PHIÊN TẬP TRUNG', 'Đồng hồ Pomodoro chuyên sâu', 'Tập trung vào một việc duy nhất và ghi nhận thời gian thực tế.'],
  fourself: ['MÔ HÌNH 4 TỰ', 'Tự giới hạn · Tự tổ chức · Tự làm chậm · Tự kết nối', 'Nền tảng cân bằng cuộc sống số và thế giới thực.'],
  rank: ['RANK HỌC TẬP & XP', 'Hệ thống Cấp bậc & Thành tích', 'Tích lũy XP minh bạch qua từng nỗ lực mỗi ngày.'],
  friends: ['CỘNG ĐỒNG BẠN BÈ', 'Kết nối & Đồng hành cùng nhau', 'Tìm kiếm bạn bè, chia sẻ tiến độ an toàn và bảo mật.'],
  leaderboard: ['BẢNG XẾP HẠNG', 'Thi đua tích cực cùng bạn bè', 'So sánh chuỗi tập trung, XP và thời gian học tập.'],
  monthly: ['ĐÁNH GIÁ THÁNG', 'Báo cáo & Biểu đồ tổng kết', 'Phân tích dữ liệu thực tế theo tháng và gợi ý cải thiện.'],
  customize: ['CÁ NHÂN HÓA', 'Giao diện, Hình nền & Âm thanh', 'Tùy biến góc học tập theo phong cách riêng của bạn.'],
  profile: ['HỒ SƠ CÁ NHÂN', 'Thông tin & Kỷ lục của bạn', 'Theo dõi toàn bộ chặng đường phát triển bản thân.'],
  settings: ['CÀI ĐẶT & BẢO MẬT', 'Quyền riêng tư & Dữ liệu', 'Kiểm soát thông tin chia sẻ và sao lưu dữ liệu.']
};

function go(pageId) {
  playSfx('click');
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === pageId));
  document.querySelectorAll('#mainNav button').forEach(b => b.classList.toggle('active', b.dataset.page === pageId));

  const meta = PAGE_META[pageId] || PAGE_META.home;
  document.getElementById('pageEyebrow').textContent = meta[0];
  document.getElementById('pageTitle').textContent = meta[1];
  document.getElementById('pageSub').textContent = meta[2];

  if (pageId === 'history') renderCalendarAndDayDetail();
  if (pageId === 'monthly') renderMonthlyReport();
  if (pageId === 'friends') loadFriendsAndRequests();
  if (pageId === 'leaderboard') renderLeaderboard();
}

document.querySelectorAll('#mainNav button').forEach(btn => {
  btn.addEventListener('click', () => go(btn.dataset.page));
});

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2800);
}

// ============================================================================
// 8. QUẢN LÝ NHIỆM VỤ THEO NGÀY (SỬA TRIỆT ĐỂ LỖI CHECKBOX)
// ============================================================================
document.getElementById('taskDatePicker').value = selectedTaskDate;
document.getElementById('taskDatePicker').addEventListener('change', (e) => {
  if (e.target.value) {
    selectedTaskDate = e.target.value;
    resetTaskForm();
    renderDailyTasks();
  }
});

function getGroupBadgeClass(group) {
  if (group === 'Tự giới hạn') return 'blue';
  if (group === 'Tự làm chậm') return 'pink';
  if (group === 'Tự kết nối') return 'orange';
  return '';
}

function renderDailyTasks() {
  document.getElementById('selectedTaskDateDisplay').textContent = formatDisplayDateVN(selectedTaskDate);
  const dayBucket = ensureDayBucket(selectedTaskDate);
  const container = document.getElementById('dailyTaskListContainer');

  if (dayBucket.tasks.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:30px 16px;background:var(--bg);border-radius:14px">
      <p class="muted" style="margin:0">Chưa có nhiệm vụ nào cho ngày <b>${formatDisplayDateVN(selectedTaskDate)}</b>.<br>Hãy tạo nhiệm vụ đầu tiên ở biểu mẫu bên cạnh!</p>
    </div>`;
    return;
  }

  container.innerHTML = dayBucket.tasks.map(task => `
    <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${escHtml(task.id)}">
      <input type="checkbox" class="task-checkbox"
        ${task.completed ? 'checked' : ''}
        onchange="toggleSingleTask('${escHtml(selectedTaskDate)}', '${escHtml(task.id)}', this.checked)">
      <div class="task-body">
        <span class="task-title">${escHtml(task.title)}</span>
        ${task.desc ? `<span class="task-desc">${escHtml(task.desc)}</span>` : ''}
        <div class="task-meta">
          <span class="tag ${getGroupBadgeClass(task.group)}">${escHtml(task.group)}</span>
          <span class="muted" style="font-size:12px">⏱ ${task.duration || 25} phút</span>
          ${task.completed ? '<span class="tag green">✓ Đã hoàn thành (+20 XP)</span>' : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn btn-outline btn-small" onclick="editTask('${escHtml(selectedTaskDate)}', '${escHtml(task.id)}')" title="Sửa">✏️</button>
        <button class="btn btn-danger btn-small" onclick="deleteTask('${escHtml(selectedTaskDate)}', '${escHtml(task.id)}')" title="Xóa">🗑</button>
      </div>
    </div>
  `).join('');
}

function saveTaskForm() {
  const title = document.getElementById('taskTitleInput').value.trim();
  const desc = document.getElementById('taskDescInput').value.trim();
  const group = document.getElementById('taskGroupInput').value;
  const duration = Math.max(1, Math.min(480, Number(document.getElementById('taskDurationInput').value) || 25));
  const editId = document.getElementById('editTaskId').value;

  if (!title) {
    showToast('⚠️ Vui lòng nhập tên nhiệm vụ.');
    return;
  }

  const dayBucket = ensureDayBucket(selectedTaskDate);

  if (editId) {
    const idx = dayBucket.tasks.findIndex(t => t.id === editId);
    if (idx !== -1) {
      dayBucket.tasks[idx].title = title;
      dayBucket.tasks[idx].desc = desc;
      dayBucket.tasks[idx].group = group;
      dayBucket.tasks[idx].duration = duration;
      playSfx('click');
      showToast('✅ Đã cập nhật nhiệm vụ.');
    }
  } else {
    dayBucket.tasks.push({
      id: generateId('task'),
      title,
      desc,
      group,
      duration,
      completed: false,
      createdAt: new Date().toISOString()
    });
    playSfx('add');
    showToast('✅ Đã thêm nhiệm vụ mới.');
  }

  resetTaskForm();
  saveState();
}

function editTask(dateStr, taskId) {
  selectedTaskDate = dateStr;
  document.getElementById('taskDatePicker').value = dateStr;
  const dayBucket = ensureDayBucket(dateStr);
  const task = dayBucket.tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('editTaskId').value = task.id;
  document.getElementById('taskTitleInput').value = task.title;
  document.getElementById('taskDescInput').value = task.desc || '';
  document.getElementById('taskGroupInput').value = task.group || 'Tự tổ chức';
  document.getElementById('taskDurationInput').value = task.duration || 25;
  document.getElementById('taskFormHeading').textContent = 'Chỉnh sửa nhiệm vụ';
  document.getElementById('cancelEditTaskBtn').style.display = 'inline-flex';
  go('tasks');
}

function resetTaskForm() {
  document.getElementById('editTaskId').value = '';
  document.getElementById('taskTitleInput').value = '';
  document.getElementById('taskDescInput').value = '';
  document.getElementById('taskGroupInput').value = 'Tự tổ chức';
  document.getElementById('taskDurationInput').value = 25;
  document.getElementById('taskFormHeading').textContent = 'Thêm nhiệm vụ mới';
  document.getElementById('cancelEditTaskBtn').style.display = 'none';
}

function toggleSingleTask(dateStr, taskId, isChecked) {
  const dayBucket = ensureDayBucket(dateStr);
  const task = dayBucket.tasks.find(t => t.id === taskId);
  if (!task) return;

  // Chỉ cập nhật duy nhất nhiệm vụ có ID khớp
  task.completed = Boolean(isChecked);

  if (task.completed) {
    playSfx('complete');
    grantXP(20, `Hoàn thành nhiệm vụ: ${task.title}`, `task_${task.id}`);
    showToast('🎉 Hoàn thành nhiệm vụ! +20 XP');
  } else {
    playSfx('click');
    revokeXPByRef(`task_${task.id}`, `Hoàn tác nhiệm vụ: ${task.title}`);
    showToast('Đã bỏ đánh dấu hoàn thành nhiệm vụ.');
  }

  saveState();
}

function deleteTask(dateStr, taskId) {
  if (!confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này không?')) return;
  const dayBucket = ensureDayBucket(dateStr);
  const task = dayBucket.tasks.find(t => t.id === taskId);
  if (task && task.completed) {
    revokeXPByRef(`task_${task.id}`, `Xóa nhiệm vụ đã hoàn thành: ${task.title}`);
  }
  dayBucket.tasks = dayBucket.tasks.filter(t => t.id !== taskId);
  playSfx('delete');
  showToast('🗑 Đã xóa nhiệm vụ.');
  saveState();
}

// ============================================================================
// 9. LỊCH SỬ HOẠT ĐỘNG & LỊCH THEO THÁNG
// ============================================================================
function changeCalMonth(delta) {
  calCurrentMonth += delta;
  if (calCurrentMonth > 12) {
    calCurrentMonth = 1;
    calCurrentYear++;
  } else if (calCurrentMonth < 1) {
    calCurrentMonth = 12;
    calCurrentYear--;
  }
  renderCalendarAndDayDetail();
}

function renderCalendarAndDayDetail() {
  const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  document.getElementById('calMonthTitle').textContent = `${monthNames[calCurrentMonth - 1]} / ${calCurrentYear}`;

  const firstDayOfMonth = new Date(calCurrentYear, calCurrentMonth - 1, 1);
  // Quy đổi Thứ 2 = 0 ... Chủ nhật = 6
  let startWeekday = firstDayOfMonth.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  const daysInMonth = new Date(calCurrentYear, calCurrentMonth, 0).getDate();
  const todayStr = getVNDateString();
  const filterGroup = document.getElementById('histFilterGroup').value;
  const filterStatus = document.getElementById('histFilterStatus').value;

  let html = '';
  for (let i = 0; i < startWeekday; i++) {
    html += `<div class="cal-cell empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calCurrentYear}-${String(calCurrentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayData = state.dailyData[dateStr];

    let tasks = dayData ? (dayData.tasks || []) : [];
    if (filterGroup !== 'ALL') tasks = tasks.filter(t => t.group === filterGroup);
    if (filterStatus === 'DONE') tasks = tasks.filter(t => t.completed);
    if (filterStatus === 'PENDING') tasks = tasks.filter(t => !t.completed);

    const hasCompletedTask = tasks.some(t => t.completed);
    const hasAnyActivity = tasks.length > 0 ||
      (dayData && ((dayData.focusSessions || []).length > 0 ||
        (dayData.slowActivities || []).length > 0 ||
        (dayData.connectActivities || []).length > 0));

    let statusClass = '';
    if (hasCompletedTask) statusClass = 'status-done';
    else if (hasAnyActivity) statusClass = 'status-partial';

    const isToday = dateStr === todayStr ? 'today' : '';
    const isSelected = dateStr === calSelectedDate ? 'selected' : '';

    html += `
      <button class="cal-cell ${statusClass} ${isToday} ${isSelected}" onclick="selectHistoryDate('${dateStr}')">
        <span class="cal-day-num">${d}</span>
        <div class="cal-dots">
          ${tasks.length > 0 ? `<span class="cal-dot" style="background:var(--purple)" title="${tasks.length} nhiệm vụ"></span>` : ''}
          ${dayData && (dayData.focusSessions || []).length > 0 ? `<span class="cal-dot" style="background:var(--blue)" title="Có phiên tập trung"></span>` : ''}
          ${dayData && (dayData.slowActivities || []).length > 0 ? `<span class="cal-dot" style="background:var(--pink)" title="Có 30p chậm"></span>` : ''}
          ${dayData && (dayData.connectActivities || []).length > 0 ? `<span class="cal-dot" style="background:var(--orange)" title="Có giờ vàng kết nối"></span>` : ''}
        </div>
      </button>
    `;
  }

  document.getElementById('calendarGrid').innerHTML = html;
  renderHistoryDayDetail(calSelectedDate);
}

function selectHistoryDate(dateStr) {
  calSelectedDate = dateStr;
  renderCalendarAndDayDetail();
}

function renderHistoryDayDetail(dateStr) {
  const panel = document.getElementById('historyDayDetailPanel');
  const dayData = ensureDayBucket(dateStr);
  const filterGroup = document.getElementById('histFilterGroup').value;
  const filterStatus = document.getElementById('histFilterStatus').value;

  let tasks = dayData.tasks || [];
  if (filterGroup !== 'ALL') tasks = tasks.filter(t => t.group === filterGroup);
  if (filterStatus === 'DONE') tasks = tasks.filter(t => t.completed);
  if (filterStatus === 'PENDING') tasks = tasks.filter(t => !t.completed);

  const focusList = dayData.focusSessions || [];
  const slowList = dayData.slowActivities || [];
  const connList = dayData.connectActivities || [];

  panel.innerHTML = `
    <div class="section-head" style="margin-top:0">
      <div>
        <span class="tag">CHI TIẾT NGÀY</span>
        <h3 style="margin:6px 0 0">${formatDisplayDateVN(dateStr)}</h3>
      </div>
      <button class="btn btn-primary btn-small" onclick="openTaskForDate('${dateStr}')">+ Thêm nhiệm vụ ngày này</button>
    </div>

    <h4>1. Nhiệm vụ trong ngày (${tasks.length})</h4>
    ${tasks.length === 0 ? '<p class="muted" style="font-size:13px">Không có nhiệm vụ phù hợp bộ lọc.</p>' : tasks.map(t => `
      <div class="task-item ${t.completed ? 'completed' : ''}" style="padding:10px">
        <input type="checkbox" class="task-checkbox" ${t.completed ? 'checked' : ''}
          onchange="toggleSingleTask('${dateStr}', '${escHtml(t.id)}', this.checked)">
        <div class="task-body">
          <span class="task-title" style="font-size:14px">${escHtml(t.title)}</span>
          <small class="muted">${escHtml(t.group)} · ${t.duration || 25} phút</small>
        </div>
        <div class="task-actions">
          <button class="btn btn-outline btn-small" onclick="editTask('${dateStr}', '${escHtml(t.id)}')">✏️</button>
          <button class="btn btn-danger btn-small" onclick="deleteTask('${dateStr}', '${escHtml(t.id)}')">🗑</button>
        </div>
      </div>
    `).join('')}

    <h4>2. Phiên tập trung Pomodoro (${focusList.length})</h4>
    ${focusList.length === 0 ? '<p class="muted" style="font-size:13px">Chưa ghi nhận phiên tập trung.</p>' : focusList.map(s => `
      <div style="background:var(--bg);padding:9px 12px;border-radius:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;font-size:13px">
        <span>⏱ <b>${s.duration} phút</b> (${escHtml(s.startTime || '')} - ${escHtml(s.endTime || '')})</span>
        <button class="text-btn" style="color:var(--red)" onclick="deleteHistoryActivity('${dateStr}', 'focusSessions', '${escHtml(s.id)}')">Xóa</button>
      </div>
    `).join('')}

    <h4>3. Hoạt động Tự làm chậm (${slowList.length})</h4>
    ${slowList.length === 0 ? '<p class="muted" style="font-size:13px">Chưa có hoạt động không màn hình.</p>' : slowList.map(a => `
      <div style="background:var(--bg);padding:9px 12px;border-radius:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;font-size:13px">
        <span>🐢 <b>${escHtml(a.title)}</b> (${a.duration} phút)</span>
        <button class="text-btn" style="color:var(--red)" onclick="deleteHistoryActivity('${dateStr}', 'slowActivities', '${escHtml(a.id)}')">Xóa</button>
      </div>
    `).join('')}

    <h4>4. Hoạt động Tự kết nối (${connList.length})</h4>
    ${connList.length === 0 ? '<p class="muted" style="font-size:13px">Chưa có giờ vàng kết nối.</p>' : connList.map(c => `
      <div style="background:var(--bg);padding:9px 12px;border-radius:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;font-size:13px">
        <span>🤝 <b>${escHtml(c.title)}</b> (${c.duration} phút) ${c.note ? '— ' + escHtml(c.note) : ''}</span>
        <div>
          <button class="text-btn" onclick="editConnectNote('${dateStr}', '${escHtml(c.id)}')">Sửa</button>
          <button class="text-btn" style="color:var(--red)" onclick="deleteHistoryActivity('${dateStr}', 'connectActivities', '${escHtml(c.id)}')">Xóa</button>
        </div>
      </div>
    `).join('')}
  `;
}

function openTaskForDate(dateStr) {
  selectedTaskDate = dateStr;
  document.getElementById('taskDatePicker').value = dateStr;
  resetTaskForm();
  go('tasks');
}

function deleteHistoryActivity(dateStr, bucketKey, itemId) {
  if (!confirm('Xóa bản ghi hoạt động này khỏi lịch sử?')) return;
  const day = ensureDayBucket(dateStr);
  day[bucketKey] = day[bucketKey].filter(x => x.id !== itemId);
  playSfx('delete');
  saveState();
  renderCalendarAndDayDetail();
}

function editConnectNote(dateStr, itemId) {
  const day = ensureDayBucket(dateStr);
  const item = day.connectActivities.find(x => x.id === itemId);
  if (!item) return;
  const newDur = prompt('Nhập thời lượng mới (phút):', item.duration);
  if (newDur === null) return;
  const newNote = prompt('Nhập ghi chú hoạt động:', item.note || '');
  if (newNote === null) return;

  item.duration = Math.max(1, Math.min(600, Number(newDur) || item.duration));
  item.note = newNote.trim();
  saveState();
  renderCalendarAndDayDetail();
  showToast('✅ Đã cập nhật hoạt động quá khứ.');
}

// ============================================================================
// 10. HỆ THỐNG POMODORO NÂNG CAO
// ============================================================================
let pomoFocusMin = 25;
let pomoBreakMin = 5;
let pomoIsBreak = false;
let pomoTotalSec = 25 * 60;
let pomoRemainSec = 25 * 60;
let pomoInterval = null;
let pomoStartTimeStr = null;

function updatePomodoroDisplay() {
  const m = Math.floor(pomoRemainSec / 60);
  const s = pomoRemainSec % 60;
  document.getElementById('timerDisplay').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const angle = pomoTotalSec > 0 ? ((pomoTotalSec - pomoRemainSec) / pomoTotalSec) * 360 : 0;
  document.getElementById('timerCircle').style.setProperty('--angle', `${angle}deg`);
  document.getElementById('timerMode').textContent = pomoIsBreak ? 'NGHỈ NGẮN' : 'TẬP TRUNG';
  document.getElementById('timerSwitchModeBtn').textContent = pomoIsBreak ? 'Chuyển sang Tập trung' : 'Chuyển sang Nghỉ';
}

function setPomodoroPreset(fMin, bMin) {
  playSfx('click');
  pausePomodoro();
  pomoFocusMin = fMin;
  pomoBreakMin = bMin;
  document.getElementById('customFocusMin').value = fMin;
  document.getElementById('customBreakMin').value = bMin;
  document.querySelectorAll('[data-preset]').forEach(el => {
    el.classList.toggle('selected', Number(el.dataset.preset) === fMin);
  });
  pomoIsBreak = false;
  pomoTotalSec = fMin * 60;
  pomoRemainSec = pomoTotalSec;
  document.getElementById('timerHint').textContent = `Phiên ${fMin} phút tập trung / ${bMin} phút nghỉ`;
  updatePomodoroDisplay();
}

function applyCustomPomodoro() {
  pausePomodoro();
  pomoFocusMin = Math.max(1, Math.min(180, Number(document.getElementById('customFocusMin').value) || 25));
  pomoBreakMin = Math.max(1, Math.min(60, Number(document.getElementById('customBreakMin').value) || 5));
  pomoTotalSec = (pomoIsBreak ? pomoBreakMin : pomoFocusMin) * 60;
  pomoRemainSec = pomoTotalSec;
  document.getElementById('timerHint').textContent = `Tùy chỉnh: ${pomoFocusMin}p tập trung / ${pomoBreakMin}p nghỉ`;
  updatePomodoroDisplay();
}

function switchPomodoroMode() {
  pausePomodoro();
  pomoIsBreak = !pomoIsBreak;
  pomoTotalSec = (pomoIsBreak ? pomoBreakMin : pomoFocusMin) * 60;
  pomoRemainSec = pomoTotalSec;
  updatePomodoroDisplay();
}

function pausePomodoro() {
  if (pomoInterval) {
    clearInterval(pomoInterval);
    pomoInterval = null;
  }
  document.getElementById('timerStartBtn').textContent = '▶ Tiếp tục';
}

function resetPomodoro() {
  pausePomodoro();
  pomoRemainSec = pomoTotalSec;
  pomoStartTimeStr = null;
  document.getElementById('timerStartBtn').textContent = '▶ Bắt đầu';
  updatePomodoroDisplay();
}

function togglePomodoro() {
  if (pomoInterval) {
    pausePomodoro();
    return;
  }
  playSfx('click');
  if (!pomoStartTimeStr) pomoStartTimeStr = getVNTimeString();
  document.getElementById('timerStartBtn').textContent = '⏸ Tạm dừng';

  pomoInterval = setInterval(() => {
    pomoRemainSec--;
    updatePomodoroDisplay();

    if (pomoRemainSec <= 0) {
      clearInterval(pomoInterval);
      pomoInterval = null;
      const endTimeStr = getVNTimeString();
      playSfx('complete');

      if (!pomoIsBreak) {
        const today = getVNDateString();
        const day = ensureDayBucket(today);
        const sessionId = generateId('pomo');
        day.focusSessions.push({
          id: sessionId,
          startTime: pomoStartTimeStr || endTimeStr,
          endTime: endTimeStr,
          duration: pomoFocusMin,
          mode: 'focus'
        });
        grantXP(pomoFocusMin, `Hoàn thành phiên tập trung ${pomoFocusMin} phút`, sessionId);
        showToast(`🎉 Hoàn thành phiên ${pomoFocusMin} phút! +${pomoFocusMin} XP`);
        saveState();
      } else {
        showToast('⏰ Hết giờ nghỉ ngắn, sẵn sàng cho phiên tập trung tiếp theo!');
      }

      pomoStartTimeStr = null;
      switchPomodoroMode();
      document.getElementById('timerStartBtn').textContent = '▶ Bắt đầu';
    }
  }, 1000);
}

function addDistractionNote() {
  const input = document.getElementById('distractionInput');
  const val = input.value.trim();
  if (!val) return;
  state.distractionNotes.unshift({ id: generateId('note'), text: val, date: getVNDateString() });
  if (state.distractionNotes.length > 30) state.distractionNotes.pop();
  input.value = '';
  playSfx('add');
  saveState();
}

function deleteDistractionNote(id) {
  state.distractionNotes = state.distractionNotes.filter(n => n.id !== id);
  saveState();
}

function renderFocusStatsAndHistory() {
  const today = getVNDateString();
  const monthPrefix = today.slice(0, 7); // YYYY-MM

  const todaySessions = ensureDayBucket(today).focusSessions;
  const todayMins = todaySessions.reduce((s, x) => s + x.duration, 0);

  let monthSessionsCount = 0;
  let monthMins = 0;
  let allSessions = [];

  for (const [dStr, dObj] of Object.entries(state.dailyData)) {
    const list = dObj.focusSessions || [];
    if (dStr.startsWith(monthPrefix)) {
      monthSessionsCount += list.length;
      monthMins += list.reduce((s, x) => s + x.duration, 0);
    }
    list.forEach(item => allSessions.push({ ...item, date: dStr }));
  }

  document.getElementById('focusSessionCountBadge').textContent = `Hôm nay: ${todaySessions.length} phiên`;
  document.getElementById('todayFocusStats').textContent = `${todaySessions.length} phiên · ${todayMins} phút`;
  document.getElementById('monthFocusStats').textContent = `${monthSessionsCount} phiên · ${monthMins} phút`;

  document.getElementById('distractionList').innerHTML = state.distractionNotes.slice(0, 5).map(n => `
    <div style="background:var(--bg);padding:8px 12px;border-radius:10px;margin-bottom:6px;display:flex;justify-content:space-between;font-size:13px">
      <span>💭 ${escHtml(n.text)}</span>
      <button class="text-btn" onclick="deleteDistractionNote('${n.id}')">✕</button>
    </div>
  `).join('') || '<small class="muted">Chưa có ghi chú xao nhãng nào.</small>';

  allSessions.sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById('focusHistoryList').innerHTML = allSessions.slice(0, 10).map(s => `
    <div style="padding:9px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;font-size:13px">
      <span>📅 ${formatDisplayDateVN(s.date)} (${escHtml(s.startTime)} - ${escHtml(s.endTime)})</span>
      <span class="tag blue">${s.duration} phút</span>
    </div>
  `).join('') || '<small class="muted">Chưa có lịch sử phiên tập trung.</small>';
}

// ============================================================================
// 11. MÔ HÌNH 4 TỰ (TỰ GIỚI HẠN, TỰ KIỂM TRA, TỰ LÀM CHẬM, TỰ KẾT NỐI)
// ============================================================================
const SELF_LIMIT_ITEMS = [
  { id: 'sl_notif', label: 'Tắt thông báo mạng xã hội trong giờ học' },
  { id: 'sl_shorts', label: 'Giới hạn xem video ngắn (Reels/TikTok/Shorts) dưới 30 phút' },
  { id: 'sl_bed', label: 'Đặt điện thoại xa giường ngủ trước khi đi ngủ 30 phút' },
  { id: 'sl_single', label: 'Chỉ mở đúng 1 tab/ứng dụng phục vụ việc đang làm' }
];

function renderSelfLimitChecklist() {
  const today = getVNDateString();
  const day = ensureDayBucket(today);
  document.getElementById('selfLimitChecklist').innerHTML = SELF_LIMIT_ITEMS.map(item => {
    const checked = day.selfLimits.includes(item.id);
    return `
      <label style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px;cursor:pointer;background:var(--surface)">
        <input type="checkbox" class="task-checkbox" style="margin:0" ${checked ? 'checked' : ''}
          onchange="toggleSelfLimitItem('${item.id}', this.checked)">
        <span>${escHtml(item.label)}</span>
      </label>
    `;
  }).join('');
}

function toggleSelfLimitItem(itemId, checked) {
  const today = getVNDateString();
  const day = ensureDayBucket(today);
  const refId = `selflimit_${today}_${itemId}`;

  if (checked && !day.selfLimits.includes(itemId)) {
    day.selfLimits.push(itemId);
    playSfx('complete');
    grantXP(10, 'Thực hành cam kết Tự giới hạn', refId);
    showToast('✅ Đã ghi nhận Tự giới hạn! +10 XP');
  } else if (!checked) {
    day.selfLimits = day.selfLimits.filter(x => x !== itemId);
    revokeXPByRef(refId, 'Hoàn tác cam kết Tự giới hạn');
  }
  saveState();
}

// Quiz tự quan sát thói quen số
const QUIZ_QUESTIONS = [
  'Bạn thường mở điện thoại kiểm tra thông báo ngay cả khi đang làm dở bài tập?',
  'Bạn có hay chuyển tab liên tục giữa bài học, tin nhắn và video ngắn?',
  'Bạn cảm thấy khó tập trung đọc một trang sách dài mà không cầm điện thoại?',
  'Bạn thường mở mạng xã hội theo phản xạ vô thức khi vừa rảnh 1-2 phút?'
];
let quizAnswers = {};

function renderQuizWidget() {
  const container = document.getElementById('quizContainer');
  container.innerHTML = QUIZ_QUESTIONS.map((q, idx) => `
    <div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--line)">
      <div style="font-size:13.5px;font-weight:650;margin-bottom:6px">${idx + 1}. ${q}</div>
      <div class="pill-row">
        ${['Hiếm khi', 'Thỉnh thoảng', 'Thường xuyên'].map((opt, val) => `
          <button class="pill ${quizAnswers[idx] === val ? 'selected' : ''}" onclick="selectQuizAns(${idx}, ${val})">${opt}</button>
        `).join('')}
      </div>
    </div>
  `).join('') + `<button class="btn btn-soft btn-small" onclick="evaluateQuiz()">Đánh giá ngay</button>`;

  if (state.quizScore !== null) {
    const msg = state.quizScore < 35
      ? 'Thói quen số của bạn đang ở mức cân bằng tốt!'
      : state.quizScore < 70
        ? 'Bạn có dấu hiệu phân tâm nhẹ — hãy áp dụng Pomodoro 20 phút.'
        : 'Mức độ phân tâm cao ("Não bỏng ngô") — hãy ưu tiên Tự giới hạn & 30 phút chậm.';
    document.getElementById('quizResultBox').innerHTML = `
      <div style="background:var(--purple-light);padding:12px;border-radius:12px;margin-top:12px;font-size:13px">
        <b>Chỉ số phân tâm tự quan sát: ${state.quizScore}%</b><br>${msg}
      </div>`;
  }
}

function selectQuizAns(idx, val) {
  quizAnswers[idx] = val;
  renderQuizWidget();
}

function evaluateQuiz() {
  if (Object.keys(quizAnswers).length < QUIZ_QUESTIONS.length) {
    showToast('⚠️ Vui lòng chọn đủ 4 câu hỏi.');
    return;
  }
  const sum = Object.values(quizAnswers).reduce((a, b) => a + b, 0);
  state.quizScore = Math.round((sum / (QUIZ_QUESTIONS.length * 2)) * 100);
  playSfx('complete');
  saveState();
}

// 30 phút chậm (Tự làm chậm)
let selectedSlowActivityName = 'Đọc sách giấy';
let slowRemainSec = 30 * 60;
let slowInterval = null;

function selectSlowPreset(btn, name) {
  selectedSlowActivityName = name;
  document.querySelectorAll('#slowActivityPills .pill').forEach(p => p.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('slowCurrentLabel').textContent = name;
}

function updateSlowTimerUI() {
  const m = Math.floor(slowRemainSec / 60);
  const s = slowRemainSec % 60;
  document.getElementById('slowTimerDisplay').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function toggleSlowTimer() {
  if (slowInterval) {
    clearInterval(slowInterval);
    slowInterval = null;
    document.getElementById('slowStartBtn').textContent = '▶ Tiếp tục';
    return;
  }
  document.getElementById('slowStartBtn').textContent = '⏸ Tạm dừng';
  slowInterval = setInterval(() => {
    slowRemainSec--;
    updateSlowTimerUI();
    if (slowRemainSec <= 0) {
      clearInterval(slowInterval);
      slowInterval = null;
      slowRemainSec = 30 * 60;
      updateSlowTimerUI();
      document.getElementById('slowStartBtn').textContent = '▶ Bắt đầu 30p';
      recordSlowActivity(30);
    }
  }, 1000);
}

function resetSlowTimer() {
  if (slowInterval) clearInterval(slowInterval);
  slowInterval = null;
  slowRemainSec = 30 * 60;
  updateSlowTimerUI();
  document.getElementById('slowStartBtn').textContent = '▶ Bắt đầu 30p';
}

function logSlowActivityManual() {
  recordSlowActivity(30);
}

function recordSlowActivity(mins) {
  const today = getVNDateString();
  const day = ensureDayBucket(today);
  const id = generateId('slow');
  day.slowActivities.push({ id, title: selectedSlowActivityName, duration: mins });
  playSfx('complete');
  grantXP(15, `Tự làm chậm: ${selectedSlowActivityName}`, id);
  showToast(`🐢 Tuyệt vời! Đã ghi nhận ${mins} phút chậm (+15 XP).`);
  saveState();
}

// Tự kết nối (Giờ vàng kết nối)
function saveConnectActivity() {
  const title = document.getElementById('connectActivityInput').value.trim();
  const duration = Math.max(5, Math.min(600, Number(document.getElementById('connectMinInput').value) || 30));
  const note = document.getElementById('connectNoteInput').value.trim();

  if (!title) {
    showToast('⚠️ Vui lòng nhập hoạt động kết nối.');
    return;
  }
  const today = getVNDateString();
  const day = ensureDayBucket(today);
  const id = generateId('conn');
  day.connectActivities.push({ id, title, duration, note });

  document.getElementById('connectActivityInput').value = '';
  document.getElementById('connectNoteInput').value = '';
  playSfx('complete');
  grantXP(15, `Giờ vàng kết nối: ${title}`, id);
  showToast('🤝 Đã lưu giờ vàng kết nối! +15 XP');
  saveState();
}

function renderFourSelfHistories() {
  const today = getVNDateString();
  const day = ensureDayBucket(today);

  document.getElementById('slowHistoryList').innerHTML = day.slowActivities.map(a => `
    <div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--line)">
      🐢 <b>${escHtml(a.title)}</b> — ${a.duration} phút
    </div>
  `).join('') || '<small class="muted">Hôm nay chưa ghi nhận hoạt động chậm.</small>';

  document.getElementById('connectHistoryList').innerHTML = day.connectActivities.map(c => `
    <div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--line)">
      🤝 <b>${escHtml(c.title)}</b> (${c.duration} phút) ${c.note ? '· ' + escHtml(c.note) : ''}
    </div>
  `).join('') || '<small class="muted">Hôm nay chưa ghi nhận giờ vàng kết nối.</small>';
}

// ============================================================================
// 12. RANK HỌC TẬP, HUY HIỆU & LỊCH SỬ XP
// ============================================================================
function renderRankPage() {
  const info = getRankInfo(state.xp);
  document.getElementById('rankPageCurrentName').textContent = `${info.current.icon} ${info.current.name} — ${info.current.vn}`;
  document.getElementById('rankPageXpTotal').textContent = `${state.xp} XP`;
  document.getElementById('rankPageBar').style.width = `${info.progressPct}%`;
  document.getElementById('rankPageNextGoal').textContent = info.next
    ? `Còn ${info.next.minXp - state.xp} XP để đạt ${info.next.icon} ${info.next.name}`
    : 'Bạn đã đạt cấp bậc cao nhất!';

  document.getElementById('rankTiersList').innerHTML = RANKS.map(r => {
    const unlocked = state.xp >= r.minXp;
    const isCurrent = info.current.id === r.id;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid ${isCurrent ? 'var(--purple)' : 'var(--line)'};border-radius:14px;margin-bottom:8px;background:${isCurrent ? 'var(--purple-light)' : 'var(--surface)'};opacity:${unlocked ? '1' : '0.55'}">
        <div>
          <strong style="font-size:15px">${r.icon} ${r.name}</strong>
          <small class="muted" style="display:block">${r.vn}</small>
        </div>
        <span class="tag ${unlocked ? 'green' : ''}">${r.minXp} XP ${unlocked ? '✓' : '🔒'}</span>
      </div>
    `;
  }).join('');

  // Huy hiệu thành tích động dựa trên dữ liệu thực
  const stats = computeGlobalStats();
  const badges = [
    { name: 'Khởi đầu mới', icon: '🌱', ok: stats.totalCompletedTasks >= 1 },
    { name: 'Chuỗi 3 ngày', icon: '🔥', ok: state.streak.longest >= 3 },
    { name: 'Chuỗi 7 ngày', icon: '⚡', ok: state.streak.longest >= 7 },
    { name: '100 phút tập trung', icon: '⏱️', ok: stats.totalFocusMinutes >= 100 },
    { name: '500 phút tập trung', icon: '🧠', ok: stats.totalFocusMinutes >= 500 },
    { name: 'Người sống chậm', icon: '🐢', ok: stats.totalSlowMinutes >= 60 },
    { name: 'Kết nối chân thành', icon: '🤝', ok: stats.totalConnectMinutes >= 60 }
  ];

  document.getElementById('achievementsList').innerHTML = badges.map(b => `
    <span class="tag ${b.ok ? 'green' : ''}" style="opacity:${b.ok ? '1' : '0.45'}">
      ${b.icon} ${b.name} ${b.ok ? '✓' : ''}
    </span>
  `).join('');

  document.getElementById('xpHistoryList').innerHTML = state.xpTransactions.slice(0, 25).map(tx => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px">
      <div>
        <span>${escHtml(tx.reason)}</span>
        <small class="muted" style="display:block">${formatDisplayDateVN(tx.date)}</small>
      </div>
      <span class="tag ${tx.amount >= 0 ? 'green' : 'red'}">${tx.amount >= 0 ? '+' : ''}${tx.amount} XP</span>
    </div>
  `).join('') || '<small class="muted">Chưa có giao dịch XP nào.</small>';
}

// ============================================================================
// 13. ĐÁNH GIÁ VÀ TỔNG KẾT THÁNG (DỮ LIỆU THỰC TẾ 100%)
// ============================================================================
document.getElementById('reportMonthPicker').value = getVNDateString().slice(0, 7);

function computeMonthMetrics(ymStr) {
  // ymStr: YYYY-MM
  const [y, m] = ymStr.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  let activeDays = 0;
  let daysWithCompletedTask = 0;
  let totalTasks = 0;
  let completedTasks = 0;
  let focusMinutes = 0;
  let slowMinutes = 0;
  let connectMinutes = 0;
  let pomodoroCount = 0;
  let selfLimitCount = 0;

  const dailyFocusArr = [];
  const dailyTasksArr = [];
  let maxMonthStreak = 0;
  let curMonthStreak = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${ymStr}-${String(d).padStart(2, '0')}`;
    const day = state.dailyData[dateStr];

    const dTasks = day ? (day.tasks || []) : [];
    const dDone = dTasks.filter(t => t.completed).length;
    const dFocus = day ? (day.focusSessions || []).reduce((s, x) => s + x.duration, 0) : 0;
    const dSlow = day ? (day.slowActivities || []).reduce((s, x) => s + x.duration, 0) : 0;
    const dConn = day ? (day.connectActivities || []).reduce((s, x) => s + x.duration, 0) : 0;
    const dLimits = day ? (day.selfLimits || []).length : 0;

    if (dDone > 0 || dFocus > 0 || dSlow > 0 || dConn > 0 || dLimits > 0) activeDays++;
    if (dDone > 0) {
      daysWithCompletedTask++;
      curMonthStreak++;
      if (curMonthStreak > maxMonthStreak) maxMonthStreak = curMonthStreak;
    } else {
      curMonthStreak = 0;
    }

    totalTasks += dTasks.length;
    completedTasks += dDone;
    focusMinutes += dFocus;
    slowMinutes += dSlow;
    connectMinutes += dConn;
    pomodoroCount += day ? (day.focusSessions || []).length : 0;
    selfLimitCount += dLimits;

    dailyFocusArr.push({ day: d, val: dFocus });
    dailyTasksArr.push({ day: d, val: dDone });
  }

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    ymStr,
    daysInMonth,
    activeDays,
    daysWithCompletedTask,
    totalTasks,
    completedTasks,
    focusMinutes,
    slowMinutes,
    connectMinutes,
    pomodoroCount,
    selfLimitCount,
    maxMonthStreak,
    completionRate,
    dailyFocusArr,
    dailyTasksArr
  };
}

function renderMonthlyReport() {
  const ym = document.getElementById('reportMonthPicker').value || getVNDateString().slice(0, 7);
  document.getElementById('monthlyReportTitle').textContent = `Tổng kết Tháng ${ym.split('-')[1]}/${ym.split('-')[0]}`;

  const cur = computeMonthMetrics(ym);

  // Tính tháng trước để so sánh
  let [y, m] = ym.split('-').map(Number);
  m -= 1;
  if (m < 1) { m = 12; y -= 1; }
  const prevYm = `${y}-${String(m).padStart(2, '0')}`;
  const prev = computeMonthMetrics(prevYm);

  document.getElementById('monthlyKpiGrid').innerHTML = `
    <div class="card stat"><div class="stat-icon" style="background:var(--purple-light)">📅</div><div><strong>${cur.activeDays} / ${cur.daysInMonth}</strong><small>Ngày có hoạt động (${cur.daysWithCompletedTask} ngày xong NV)</small></div></div>
    <div class="card stat"><div class="stat-icon" style="background:var(--green-light)">✅</div><div><strong>${cur.completedTasks} / ${cur.totalTasks}</strong><small>Nhiệm vụ hoàn thành (${cur.completionRate}%)</small></div></div>
    <div class="card stat"><div class="stat-icon" style="background:var(--blue-light)">⏱️</div><div><strong>${cur.focusMinutes} phút</strong><small>${cur.pomodoroCount} phiên Pomodoro</small></div></div>
    <div class="card stat"><div class="stat-icon" style="background:var(--pink-light)">🐢</div><div><strong>${cur.slowMinutes} phút</strong><small>Không màn hình (Chuỗi max: ${cur.maxMonthStreak}d)</small></div></div>
  `;

  // Vẽ biểu đồ cột thời gian tập trung theo ngày
  const maxFocus = Math.max(10, ...cur.dailyFocusArr.map(x => x.val));
  document.getElementById('chartFocusByDay').innerHTML = cur.dailyFocusArr.map(item => `
    <div class="bar-col" title="Ngày ${item.day}: ${item.val} phút">
      <span class="bar-val">${item.val > 0 ? item.val : ''}</span>
      <div class="bar-fill" style="height:${Math.round((item.val / maxFocus) * 110)}px"></div>
      <span class="bar-label">${item.day}</span>
    </div>
  `).join('');

  // Vẽ biểu đồ cột nhiệm vụ hoàn thành theo ngày
  const maxTasks = Math.max(2, ...cur.dailyTasksArr.map(x => x.val));
  document.getElementById('chartTasksByDay').innerHTML = cur.dailyTasksArr.map(item => `
    <div class="bar-col" title="Ngày ${item.day}: ${item.val} nhiệm vụ">
      <span class="bar-val">${item.val > 0 ? item.val : ''}</span>
      <div class="bar-fill" style="height:${Math.round((item.val / maxTasks) * 110)}px;background:linear-gradient(180deg, var(--green), #36b3e9)"></div>
      <span class="bar-label">${item.day}</span>
    </div>
  `).join('');

  // Phân bổ 4 Tự
  const total4Self = Math.max(1, cur.selfLimitCount + cur.pomodoroCount + cur.slowMinutes + cur.connectMinutes);
  const breakdownItems = [
    { label: '🔕 Tự giới hạn (Cam kết)', val: `${cur.selfLimitCount} lần`, pct: Math.round((cur.selfLimitCount / total4Self) * 100), color: 'var(--blue)' },
    { label: '📝 Tự tổ chức (Phiên Pomodoro)', val: `${cur.pomodoroCount} phiên (${cur.focusMinutes}p)`, pct: Math.round((cur.pomodoroCount / total4Self) * 100), color: 'var(--purple)' },
    { label: '🐢 Tự làm chậm (Không màn hình)', val: `${cur.slowMinutes} phút`, pct: Math.round((cur.slowMinutes / total4Self) * 100), color: 'var(--pink)' },
    { label: '🤝 Tự kết nối (Giờ vàng)', val: `${cur.connectMinutes} phút`, pct: Math.round((cur.connectMinutes / total4Self) * 100), color: 'var(--orange)' }
  ];

  document.getElementById('chartFourSelfBreakdown').innerHTML = breakdownItems.map(b => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
        <b>${b.label}</b><span>${b.val}</span>
      </div>
      <div class="progress"><span style="width:${Math.min(100, Math.max(4, b.pct))}%;background:${b.color}"></span></div>
    </div>
  `).join('');

  // So sánh tháng trước & gợi ý tự động dựa trên số liệu thực
  const diffFocus = cur.focusMinutes - prev.focusMinutes;
  const diffTasks = cur.completedTasks - prev.completedTasks;

  let advice = 'Tiếp tục duy trì nhịp độ hiện tại và đặt mục tiêu nhỏ rõ ràng mỗi sáng.';
  if (cur.activeDays === 0) {
    advice = 'Tháng này chưa có dữ liệu hoạt động. Hãy bắt đầu bằng 1 nhiệm vụ nhỏ 15 phút ngay hôm nay!';
  } else if (cur.completionRate < 50) {
    advice = 'Tỷ lệ hoàn thành nhiệm vụ dưới 50%. Gợi ý: Chia nhỏ nhiệm vụ và giới hạn tối đa 3 việc quan trọng mỗi ngày.';
  } else if (cur.slowMinutes < 60) {
    advice = 'Bạn tập trung tốt nhưng thời gian "Tự làm chậm" không màn hình còn ít. Hãy dành 30 phút đọc sách hoặc đi bộ mỗi ngày.';
  } else {
    advice = 'Sự cân bằng giữa học tập và nghỉ ngơi không màn hình của bạn rất ấn tượng! Hãy thử nâng phiên Pomodoro lên 25-45 phút.';
  }

  document.getElementById('monthlyComparisonBox').innerHTML = `
    <div style="background:var(--bg);padding:14px;border-radius:14px;margin-bottom:12px;font-size:13.5px">
      <b>So với tháng trước (${prevYm}):</b>
      <ul style="margin:8px 0 0;padding-left:18px">
        <li>Thời gian tập trung: <b>${diffFocus >= 0 ? '+' : ''}${diffFocus} phút</b> (${cur.focusMinutes}p so với ${prev.focusMinutes}p)</li>
        <li>Nhiệm vụ hoàn thành: <b>${diffTasks >= 0 ? '+' : ''}${diffTasks} nhiệm vụ</b> (${cur.completedTasks} so với ${prev.completedTasks})</li>
      </ul>
    </div>
    <div style="background:var(--purple-light);padding:14px;border-radius:14px;font-size:13.5px">
      <b>💡 Nhận xét & Gợi ý cải thiện:</b>
      <p style="margin:6px 0 0">${advice}</p>
    </div>
  `;
}

// ============================================================================
// 14. TÙY CHỈNH GIAO DIỆN, HÌNH NỀN & ÂM THANH
// ============================================================================
function applyPreferencesToDOM() {
  const p = state.preferences;
  document.documentElement.setAttribute('data-theme', p.theme || 'default');

  document.querySelectorAll('#themeColorPicker .pill').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.themeVal === (p.theme || 'default'));
  });

  // Overlay opacity
  const alpha = (p.overlayOpacity ?? 85) / 100;
  const isDark = p.theme === 'dark';
  const overlayColor = isDark ? `rgba(17, 19, 31, ${alpha})` : `rgba(245, 246, 252, ${alpha})`;
  document.getElementById('bgOverlayLayer').style.background = overlayColor;
  document.getElementById('overlayOpacityRange').value = p.overlayOpacity ?? 85;
  document.getElementById('overlayOpacityLabel').textContent = `${p.overlayOpacity ?? 85}%`;

  // Background Image & Video
  const bgLayer = document.getElementById('bgMediaLayer');
  const videoEl = document.getElementById('bgVideoEl');
  document.getElementById('customBgImageUrl').value = p.bgImageUrl || '';
  document.getElementById('customBgVideoUrl').value = p.bgVideoUrl || '';
  document.getElementById('toggleVideoBgCheck').checked = p.videoEnabled !== false;

  if (p.bgVideoUrl && p.videoEnabled !== false) {
    bgLayer.style.backgroundImage = 'none';
    if (videoEl.src !== p.bgVideoUrl) {
      videoEl.src = p.bgVideoUrl;
    }
    videoEl.style.display = 'block';
    videoEl.play().catch(() => {});
  } else {
    videoEl.pause();
    videoEl.style.display = 'none';
    bgLayer.style.backgroundImage = p.bgImageUrl ? `url("${p.bgImageUrl}")` : 'none';
  }

  // Audio settings
  const audioEl = document.getElementById('bgAudioPlayer');
  document.getElementById('customAudioUrlInput').value = p.audioUrl || '';
  document.getElementById('audioLoopCheck').checked = p.audioLoop !== false;
  document.getElementById('bgVolumeRange').value = p.bgVolume ?? 50;
  document.getElementById('bgVolumeLabel').textContent = `${p.bgVolume ?? 50}%`;
  audioEl.loop = p.audioLoop !== false;
  audioEl.volume = (p.bgVolume ?? 50) / 100;

  document.getElementById('sfxEnableCheck').checked = p.sfxEnabled !== false;
  document.getElementById('sfxVolumeRange').value = p.sfxVolume ?? 40;
  document.getElementById('sfxVolumeLabel').textContent = `${p.sfxVolume ?? 40}%`;
}

function setThemeColor(themeVal) {
  state.preferences.theme = themeVal;
  applyPreferencesToDOM();
  saveState();
}

function applyPresetBg(url) {
  state.preferences.bgImageUrl = url;
  state.preferences.bgVideoUrl = '';
  applyPreferencesToDOM();
  saveState();
  showToast('🎨 Đã cập nhật hình nền.');
}

function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function applyCustomImageUrl() {
  const url = document.getElementById('customBgImageUrl').value.trim();
  if (!url) {
    state.preferences.bgImageUrl = '';
    applyPreferencesToDOM();
    saveState();
    return;
  }
  if (!isValidHttpUrl(url)) {
    showToast('⚠️ Đường dẫn hình ảnh không hợp lệ (cần bắt đầu bằng http:// hoặc https://).');
    return;
  }
  const img = new Image();
  img.onload = () => {
    state.preferences.bgImageUrl = url;
    state.preferences.bgVideoUrl = '';
    applyPreferencesToDOM();
    saveState();
    showToast('✅ Đã áp dụng hình nền mới!');
  };
  img.onerror = () => {
    showToast('❌ Không thể tải hình ảnh từ URL này. Vui lòng kiểm tra lại.');
  };
  img.src = url;
}

function applyCustomVideoUrl() {
  const url = document.getElementById('customBgVideoUrl').value.trim();
  if (!url) {
    state.preferences.bgVideoUrl = '';
    applyPreferencesToDOM();
    saveState();
    return;
  }
  if (!isValidHttpUrl(url)) {
    showToast('⚠️ Đường dẫn video không hợp lệ.');
    return;
  }
  const videoEl = document.getElementById('bgVideoEl');
  videoEl.onerror = () => {
    showToast('❌ Trình duyệt không tải được video từ URL này.');
    state.preferences.bgVideoUrl = '';
    applyPreferencesToDOM();
  };
  state.preferences.bgVideoUrl = url;
  state.preferences.videoEnabled = true;
  applyPreferencesToDOM();
  saveState();
  showToast('✅ Đã áp dụng hình nền động!');
}

function toggleVideoBgPlayback() {
  state.preferences.videoEnabled = document.getElementById('toggleVideoBgCheck').checked;
  applyPreferencesToDOM();
  saveState();
}

function updateOverlayOpacity(val) {
  state.preferences.overlayOpacity = Number(val);
  applyPreferencesToDOM();
  saveState();
}

function resetAppearanceDefaults() {
  state.preferences.theme = 'default';
  state.preferences.bgImageUrl = '';
  state.preferences.bgVideoUrl = '';
  state.preferences.overlayOpacity = 85;
  applyPreferencesToDOM();
  saveState();
  showToast('↺ Đã khôi phục giao diện mặc định.');
}

// Nhạc nền
function loadCustomAudioUrl() {
  const url = document.getElementById('customAudioUrlInput').value.trim();
  if (!url || !isValidHttpUrl(url)) {
    showToast('⚠️ Vui lòng nhập URL tệp âm thanh/video hợp lệ.');
    return;
  }
  const audioEl = document.getElementById('bgAudioPlayer');
  audioEl.onerror = () => {
    document.getElementById('audioStatusText').textContent = '❌ Lỗi: Không phát được định dạng hoặc URL bị chặn.';
    showToast('❌ Không thể tải nguồn âm thanh này.');
  };
  audioEl.onloadedmetadata = () => {
    document.getElementById('audioStatusText').textContent = '✅ Đã sẵn sàng phát nhạc nền.';
  };
  audioEl.src = url;
  state.preferences.audioUrl = url;
  saveState();
  showToast('🎵 Đã lưu nguồn nhạc nền. Nhấn Phát nhạc để nghe.');
}

function toggleBgAudioPlay() {
  const audioEl = document.getElementById('bgAudioPlayer');
  if (!state.preferences.audioUrl) {
    showToast('⚠️ Bạn chưa nhập URL nhạc nền.');
    return;
  }
  if (!audioEl.src) audioEl.src = state.preferences.audioUrl;

  if (audioEl.paused) {
    audioEl.play().then(() => {
      document.getElementById('audioPlayPauseBtn').textContent = '⏸ Tạm dừng';
      document.getElementById('quickAudioBtn').textContent = '🔊 Đang phát nhạc';
    }).catch(() => {
      showToast('❌ Trình duyệt chặn phát hoặc URL âm thanh không hỗ trợ.');
    });
  } else {
    audioEl.pause();
    document.getElementById('audioPlayPauseBtn').textContent = '▶ Phát nhạc';
    document.getElementById('quickAudioBtn').textContent = '🔇 Nhạc nền';
  }
}

function toggleBgAudioQuick() {
  if (!state.preferences.audioUrl) {
    go('customize');
    showToast('Hãy nhập link nhạc nền của bạn tại đây.');
    return;
  }
  toggleBgAudioPlay();
}

function updateAudioSettings() {
  state.preferences.audioLoop = document.getElementById('audioLoopCheck').checked;
  state.preferences.bgVolume = Number(document.getElementById('bgVolumeRange').value);
  applyPreferencesToDOM();
  saveState();
}

function updateSfxSettings() {
  state.preferences.sfxEnabled = document.getElementById('sfxEnableCheck').checked;
  state.preferences.sfxVolume = Number(document.getElementById('sfxVolumeRange').value);
  applyPreferencesToDOM();
  saveState();
}

function resetAudioDefaults() {
  const audioEl = document.getElementById('bgAudioPlayer');
  audioEl.pause();
  audioEl.src = '';
  state.preferences.audioUrl = '';
  state.preferences.bgVolume = 50;
  state.preferences.sfxEnabled = true;
  state.preferences.sfxVolume = 40;
  document.getElementById('audioPlayPauseBtn').textContent = '▶ Phát nhạc';
  document.getElementById('quickAudioBtn').textContent = '🔇 Nhạc nền';
  applyPreferencesToDOM();
  saveState();
  showToast('↺ Đã khôi phục cài đặt âm thanh.');
}

// ============================================================================
// 15. HỆ THỐNG TÀI KHOẢN, HỒ SƠ, SAO LƯU & BẠN BÈ (FIREBASE + LOCAL)
// ============================================================================
function openAuthModal(forceOnboarding = false) {
  const modal = document.getElementById('authModal');
  modal.classList.add('open');
  document.getElementById('closeAuthModalBtn').style.display = forceOnboarding ? 'none' : 'inline-block';
  document.getElementById('quickDisplayNameInput').value = state.profile.displayName || '';

  const fbEnabled = window.FocusUpFirebase.enabled;
  document.getElementById('firebaseAuthSection').style.display = fbEnabled ? 'block' : 'none';
  if (fbEnabled && currentUser) {
    document.getElementById('logoutFirebaseBtn').style.display = 'inline-flex';
  } else {
    document.getElementById('logoutFirebaseBtn').style.display = 'none';
  }
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('open');
}

function saveQuickLocalProfile() {
  const name = document.getElementById('quickDisplayNameInput').value.trim();
  if (!name) {
    showToast('⚠️ Vui lòng nhập tên hiển thị.');
    return;
  }
  state.profile.displayName = name;
  state.profile.isOnboarded = true;
  playSfx('complete');
  saveState();
  closeAuthModal();
  showToast(`👋 Xin chào ${name}!`);
}

function updateDisplayName() {
  const newName = document.getElementById('editDisplayNameInput').value.trim();
  if (!newName) {
    showToast('⚠️ Tên hiển thị không được để trống.');
    return;
  }
  state.profile.displayName = newName;
  saveState();
  showToast('✅ Đã cập nhật tên hiển thị.');
}

function switchAuthTab(mode) {
  authTabMode = mode;
  document.getElementById('tabLoginBtn').classList.toggle('selected', mode === 'login');
  document.getElementById('tabRegisterBtn').classList.toggle('selected', mode === 'register');
  document.getElementById('registerNameWrap').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('submitFirebaseAuthBtn').textContent = mode === 'register' ? 'Đăng ký tài khoản' : 'Đăng nhập';
}

async function handleFirebaseAuthSubmit() {
  if (!window.FocusUpFirebase.enabled) return;
  const email = document.getElementById('authEmailInput').value.trim();
  const pass = document.getElementById('authPassInput').value;
  const regName = document.getElementById('authRegNameInput').value.trim();

  if (!email || pass.length < 6) {
    showToast('⚠️ Vui lòng nhập email hợp lệ và mật khẩu ít nhất 6 ký tự.');
    return;
  }

  try {
    if (authTabMode === 'register') {
      if (!regName) {
        showToast('⚠️ Vui lòng nhập tên hiển thị khi đăng ký.');
        return;
      }
      const cred = await window.FocusUpFirebase.auth.createUserWithEmailAndPassword(email, pass);
      state.uid = cred.user.uid;
      state.profile.displayName = regName;
      state.profile.isOnboarded = true;
      await saveState(true);
      closeAuthModal();
      showToast('🎉 Đăng ký tài khoản Cloud thành công!');
    } else {
      await window.FocusUpFirebase.auth.signInWithEmailAndPassword(email, pass);
      closeAuthModal();
      showToast('✅ Đăng nhập thành công!');
    }
  } catch (err) {
    showToast('❌ Lỗi xác thực: ' + err.message);
  }
}

async function handleFirebaseLogout() {
  if (!window.FocusUpFirebase.enabled) return;
  await window.FocusUpFirebase.auth.signOut();
  currentUser = null;
  state = createDefaultUserData('');
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  closeAuthModal();
  renderAll();
  openAuthModal(true);
  showToast('Đã đăng xuất tài khoản Cloud.');
}

// ============================================================================
// 16. HỆ THỐNG BẠN BÈ & BẢNG XẾP HẠNG (CLOUD FIRESTORE)
// ============================================================================
function renderFriendsNotice() {
  const box = document.getElementById('friendFirebaseNotice');
  document.getElementById('myFriendCodeDisplay').textContent = state.profile.friendCode;

  if (!window.FocusUpFirebase.enabled) {
    box.innerHTML = `
      <span class="tag orange">CHẾ ĐỘ LOCAL</span>
      <h3 style="margin:8px 0 4px">Cần kết nối Firebase Backend để sử dụng tính năng Bạn bè thật</h3>
      <p class="muted" style="font-size:13.5px;margin:0">
        FocusUp cam kết không tạo danh sách bạn bè giả bằng localStorage. Để tìm kiếm người dùng thật, gửi lời mời kết bạn và đồng bộ bảng xếp hạng giữa nhiều thiết bị, vui lòng cấu hình Firebase trong tệp <code>firebase-config.js</code> và đăng nhập tài khoản Cloud.
      </p>
    `;
  } else if (!currentUser) {
    box.innerHTML = `
      <span class="tag blue">CHƯA ĐĂNG NHẬP CLOUD</span>
      <h3 style="margin:8px 0 4px">Đăng nhập tài khoản để kết nối bạn bè</h3>
      <p class="muted" style="font-size:13.5px;margin:0 0 10px">Firebase đã sẵn sàng. Hãy đăng nhập hoặc đăng ký tài khoản Cloud để kết bạn.</p>
      <button class="btn btn-primary btn-small" onclick="openAuthModal()">Đăng nhập / Đăng ký ngay</button>
    `;
  } else {
    box.innerHTML = `
      <span class="tag green">ĐÃ KẾT NỐI CLOUD</span>
      <p class="muted" style="font-size:13px;margin:6px 0 0">
        Bạn đang đăng nhập bằng tài khoản Cloud. Mọi dữ liệu kết bạn và quyền riêng tư được bảo vệ bởi Firebase Security Rules.
      </p>
    `;
  }
}

async function searchUsers() {
  if (!window.FocusUpFirebase.enabled || !currentUser) {
    showToast('⚠️ Vui lòng cấu hình Firebase và đăng nhập để tìm bạn bè.');
    return;
  }
  const keyword = document.getElementById('friendSearchInput').value.trim();
  if (!keyword) return;

  const db = window.FocusUpFirebase.db;
  const resultsEl = document.getElementById('friendSearchResults');
  resultsEl.innerHTML = '<small class="muted">Đang tìm kiếm...</small>';

  try {
    // Tìm theo friendCode chính xác hoặc displayNameLower
    const snapCode = await db.collection('public_profiles')
      .where('friendCode', '==', keyword.toUpperCase())
      .where('allowSearch', '==', true)
      .get();

    const snapName = await db.collection('public_profiles')
      .where('displayNameLower', '==', keyword.toLowerCase())
      .where('allowSearch', '==', true)
      .get();

    const map = new Map();
    snapCode.forEach(doc => map.set(doc.id, doc.data()));
    snapName.forEach(doc => map.set(doc.id, doc.data()));
    map.delete(currentUser.uid);

    // Lọc bỏ người đã bị chặn
    const blockedIds = new Set((state.blockedUsers || []).map(b => b.uid));
    const users = [...map.values()].filter(u => !blockedIds.has(u.uid));

    if (users.length === 0) {
      resultsEl.innerHTML = '<small class="muted">Không tìm thấy người dùng phù hợp (hoặc họ đã tắt tìm kiếm).</small>';
      return;
    }

    resultsEl.innerHTML = users.map(u => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px">
        <div>
          <b>${escHtml(u.displayName)}</b> <span class="tag">${escHtml(u.friendCode)}</span>
          <small class="muted" style="display:block">${escHtml(u.rankName || '🌱 Beginner')}</small>
        </div>
        <button class="btn btn-primary btn-small" onclick="sendFriendRequest('${u.uid}', '${escHtml(u.displayName)}')">+ Kết bạn</button>
      </div>
    `).join('');
  } catch (err) {
    resultsEl.innerHTML = `<small style="color:var(--red)">Lỗi tìm kiếm: ${escHtml(err.message)}</small>`;
  }
}

async function sendFriendRequest(toUid, toName) {
  if (!window.FocusUpFirebase.enabled || !currentUser) return;
  const db = window.FocusUpFirebase.db;
  const reqId = `${currentUser.uid}_${toUid}`;

  try {
    await db.collection('friend_requests').doc(reqId).set({
      fromUid: currentUser.uid,
      fromName: state.profile.displayName,
      fromCode: state.profile.friendCode,
      toUid,
      toName,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    playSfx('add');
    showToast(`📨 Đã gửi lời mời kết bạn tới ${toName}!`);
  } catch (err) {
    showToast('❌ Không thể gửi lời mời: ' + err.message);
  }
}

async function loadFriendsAndRequests() {
  renderFriendsNotice();
  if (!window.FocusUpFirebase.enabled || !currentUser) {
    document.getElementById('friendRequestsList').innerHTML = '<small class="muted">Chưa có dữ liệu.</small>';
    document.getElementById('friendsListContainer').innerHTML = '<small class="muted">Chưa có danh sách bạn bè.</small>';
    return;
  }

  const db = window.FocusUpFirebase.db;

  // 1. Lời mời đang chờ
  const reqSnap = await db.collection('friend_requests')
    .where('toUid', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .get();

  const reqBadge = document.getElementById('friendReqBadge');
  if (reqSnap.size > 0) {
    reqBadge.textContent = reqSnap.size;
    reqBadge.style.display = 'inline-block';
  } else {
    reqBadge.style.display = 'none';
  }

  document.getElementById('friendRequestsList').innerHTML = reqSnap.docs.map(doc => {
    const r = doc.data();
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px">
        <div>
          <b>${escHtml(r.fromName)}</b>
          <small class="muted" style="display:block">Mã: ${escHtml(r.fromCode)}</small>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-primary btn-small" onclick="respondFriendRequest('${doc.id}', '${r.fromUid}', '${escHtml(r.fromName)}', true)">Chấp nhận</button>
          <button class="btn btn-outline btn-small" onclick="respondFriendRequest('${doc.id}', '${r.fromUid}', '${escHtml(r.fromName)}', false)">Từ chối</button>
        </div>
      </div>
    `;
  }).join('') || '<small class="muted">Không có lời mời kết bạn nào.</small>';

  // 2. Danh sách bạn bè
  const friendsSnap = await db.collection('users').doc(currentUser.uid).collection('friends').get();
  document.getElementById('friendsCountLabel').textContent = friendsSnap.size;

  const friendCards = [];
  for (const fDoc of friendsSnap.docs) {
    const fUid = fDoc.id;
    const pubDoc = await db.collection('public_profiles').doc(fUid).get();
    const pub = pubDoc.exists ? pubDoc.data() : { displayName: fDoc.data().displayName || 'Bạn bè', shareProfile: false };

    friendCards.push(`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid var(--line);border-radius:14px;margin-bottom:10px">
        <div>
          <b>${escHtml(pub.displayName)}</b>
          ${pub.shareProfile
            ? `<small class="muted" style="display:block">${escHtml(pub.rankName || '')} · ${pub.xp || 0} XP · 🔥 ${pub.streakCurrent || 0} ngày</small>`
            : `<small class="muted" style="display:block">🔒 Đang ẩn tiến trình cá nhân</small>`
          }
        </div>
        <div style="display:flex;gap:6px">
          ${pub.shareProfile ? `<button class="btn btn-soft btn-small" onclick="viewFriendDetailModal('${fUid}')">Xem hồ sơ</button>` : ''}
          <button class="btn btn-outline btn-small" onclick="removeFriend('${fUid}', '${escHtml(pub.displayName)}')">Hủy</button>
          <button class="btn btn-danger btn-small" onclick="blockUser('${fUid}', '${escHtml(pub.displayName)}')">Chặn</button>
        </div>
      </div>
    `);
  }

  document.getElementById('friendsListContainer').innerHTML = friendCards.join('') || '<small class="muted">Bạn chưa kết bạn với ai.</small>';
}

async function respondFriendRequest(reqId, fromUid, fromName, accept) {
  const db = window.FocusUpFirebase.db;
  if (accept) {
    await db.collection('users').doc(currentUser.uid).collection('friends').doc(fromUid).set({
      uid: fromUid,
      displayName: fromName,
      since: new Date().toISOString()
    });
    await db.collection('users').doc(fromUid).collection('friends').doc(currentUser.uid).set({
      uid: currentUser.uid,
      displayName: state.profile.displayName,
      since: new Date().toISOString()
    });
    await db.collection('friend_requests').doc(reqId).delete();
    playSfx('complete');
    showToast(`🤝 Bạn và ${fromName} đã trở thành bạn bè!`);
  } else {
    await db.collection('friend_requests').doc(reqId).delete();
    showToast('Đã từ chối lời mời.');
  }
  loadFriendsAndRequests();
}

async function removeFriend(friendUid, friendName) {
  if (!confirm(`Hủy kết bạn với ${friendName}?`)) return;
  const db = window.FocusUpFirebase.db;
  await db.collection('users').doc(currentUser.uid).collection('friends').doc(friendUid).delete();
  await db.collection('users').doc(friendUid).collection('friends').doc(currentUser.uid).delete();
  showToast(`Đã hủy kết bạn với ${friendName}.`);
  loadFriendsAndRequests();
}

async function blockUser(targetUid, targetName) {
  if (!confirm(`Chặn ${targetName}? Họ sẽ bị xóa khỏi danh sách bạn bè và không thể tìm thấy hay gửi lời mời cho bạn.`)) return;
  const db = window.FocusUpFirebase.db;
  await db.collection('users').doc(currentUser.uid).collection('friends').doc(targetUid).delete();
  await db.collection('users').doc(targetUid).collection('friends').doc(currentUser.uid).delete();
  await db.collection('users').doc(currentUser.uid).collection('blocked').doc(targetUid).set({
    uid: targetUid,
    displayName: targetName,
    blockedAt: new Date().toISOString()
  });

  state.blockedUsers.push({ uid: targetUid, displayName: targetName });
  await saveState(true);
  loadFriendsAndRequests();
  showToast(`🚫 Đã chặn ${targetName}.`);
}

async function unblockUser(targetUid) {
  if (window.FocusUpFirebase.enabled && currentUser) {
    await window.FocusUpFirebase.db.collection('users').doc(currentUser.uid).collection('blocked').doc(targetUid).delete();
  }
  state.blockedUsers = (state.blockedUsers || []).filter(b => b.uid !== targetUid);
  await saveState(true);
  showToast('Đã bỏ chặn người dùng.');
}

async function viewFriendDetailModal(friendUid) {
  const modal = document.getElementById('friendProfileModal');
  const body = document.getElementById('friendModalBody');
  modal.classList.add('open');
  body.innerHTML = '<p class="muted">Đang tải dữ liệu bảo mật từ Cloud...</p>';

  try {
    const doc = await window.FocusUpFirebase.db.collection('users').doc(friendUid).get();
    if (!doc.exists) {
      body.innerHTML = '<p>Người dùng không tồn tại hoặc đã tắt quyền chia sẻ dữ liệu.</p>';
      return;
    }
    const fData = doc.data();
    const rInfo = getRankInfo(fData.xp || 0);
    document.getElementById('friendModalTitle').textContent = `Hồ sơ của ${fData.profile?.displayName || 'Bạn bè'}`;

    const todayStr = getVNDateString();
    const todayTasks = fData.privacy?.shareHistory ? ((fData.dailyData?.[todayStr]?.tasks) || []) : [];

    body.innerHTML = `
      <div class="grid two-eq" style="margin-bottom:14px">
        <div style="background:var(--bg);padding:12px;border-radius:12px">
          <small class="muted">Cấp bậc & XP</small>
          <strong style="display:block">${rInfo.current.icon} ${rInfo.current.name} (${fData.xp || 0} XP)</strong>
        </div>
        <div style="background:var(--bg);padding:12px;border-radius:12px">
          <small class="muted">Chuỗi tập trung</small>
          <strong style="display:block">🔥 ${fData.streak?.current || 0} ngày (Kỷ lục: ${fData.streak?.longest || 0})</strong>
        </div>
      </div>
      ${fData.privacy?.shareHistory ? `
        <h4>Hoạt động hôm nay (${formatDisplayDateVN(todayStr)})</h4>
        ${todayTasks.length === 0 ? '<small class="muted">Hôm nay bạn ấy chưa tạo nhiệm vụ nào.</small>' : todayTasks.map(t => `
          <div style="padding:8px 0;border-bottom:1px solid var(--line);font-size:13px">
            ${t.completed ? '✅' : '⏳'} <b>${escHtml(t.title)}</b> (${escHtml(t.group)})
          </div>
        `).join('')}
      ` : '<p class="muted">🔒 Người dùng này chỉ chia sẻ thống kê tổng quan, ẩn chi tiết hoạt động theo ngày.</p>'}
    `;
  } catch (err) {
    body.innerHTML = `<p style="color:var(--red)">🔒 Không có quyền truy cập dữ liệu người dùng này (Security Rules chặn).</p>`;
  }
}

async function renderLeaderboard() {
  const container = document.getElementById('leaderboardContainer');
  const sortBy = document.getElementById('leaderboardSortBy').value;
  const myStats = computeGlobalStats();
  const myRank = getRankInfo(state.xp);

  const entries = [{
    uid: state.uid,
    displayName: (state.profile.displayName || 'Bạn') + ' (Bạn)',
    xp: state.xp,
    rankName: `${myRank.current.icon} ${myRank.current.name}`,
    streak: state.streak.current,
    focusMinutes: myStats.totalFocusMinutes,
    isMe: true
  }];

  if (window.FocusUpFirebase.enabled && currentUser) {
    const db = window.FocusUpFirebase.db;
    const friendsSnap = await db.collection('users').doc(currentUser.uid).collection('friends').get();
    for (const fDoc of friendsSnap.docs) {
      const pubDoc = await db.collection('public_profiles').doc(fDoc.id).get();
      if (pubDoc.exists && pubDoc.data().shareProfile) {
        const p = pubDoc.data();
        entries.push({
          uid: p.uid,
          displayName: p.displayName,
          xp: p.xp || 0,
          rankName: p.rankName || '🌱 Beginner',
          streak: p.streakCurrent || 0,
          focusMinutes: p.totalFocusMinutes || 0,
          isMe: false
        });
      }
    }
  }

  entries.sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));

  container.innerHTML = entries.map((e, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
    const metricText = sortBy === 'xp'
      ? `${e.xp} XP`
      : sortBy === 'streak'
        ? `🔥 ${e.streak} ngày`
        : `⏱ ${e.focusMinutes} phút`;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px;border:1px solid ${e.isMe ? 'var(--purple)' : 'var(--line)'};border-radius:14px;margin-bottom:10px;background:${e.isMe ? 'var(--purple-light)' : 'var(--surface)'}">
        <div style="display:flex;align-items:center;gap:12px">
          <strong style="font-size:18px;width:32px;text-align:center">${medal}</strong>
          <div>
            <b>${escHtml(e.displayName)}</b>
            <small class="muted" style="display:block">${escHtml(e.rankName)}</small>
          </div>
        </div>
        <span class="tag ${idx === 0 ? 'orange' : 'blue'}" style="font-size:13px">${metricText}</span>
      </div>
    `;
  }).join('');
}

// ============================================================================
// 17. CÀI ĐẶT QUYỀN RIÊNG TƯ & XUẤT/NHẬP DỮ LIỆU JSON
// ============================================================================
function savePrivacySettings() {
  state.privacy.shareProfile = document.getElementById('privShareProfileCheck').checked;
  state.privacy.shareHistory = document.getElementById('privShareHistoryCheck').checked;
  state.privacy.allowSearch = document.getElementById('privAllowSearchCheck').checked;
  saveState(true);
  showToast('🔒 Đã cập nhật cài đặt quyền riêng tư.');
}

function exportUserDataJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FocusUp_Backup_${getVNDateString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇ Đã tải xuống bản sao lưu dữ liệu.');
}

function importUserDataJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.dailyData || !imported.profile) {
        throw new Error('Cấu trúc tệp không hợp lệ.');
      }
      state = { ...createDefaultUserData(), ...imported };
      saveState(true);
      showToast('✅ Khôi phục dữ liệu thành công!');
    } catch (err) {
      showToast('❌ Lỗi đọc tệp sao lưu: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ============================================================================
// 18. CẬP NHẬT TOÀN BỘ GIAO DIỆN (MASTER RENDER)
// ============================================================================
function renderAll() {
  const todayStr = getVNDateString();
  const stats = computeGlobalStats();
  const rankInfo = getRankInfo(state.xp);
  const name = state.profile.displayName || 'Bạn mới';

  // Header & Sidebar
  document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  document.getElementById('sideAvatar').textContent = name.charAt(0).toUpperCase();
  document.getElementById('sideUserName').textContent = name;
  document.getElementById('sideUserRank').textContent = `${rankInfo.current.icon} ${rankInfo.current.name} · ${state.xp} XP`;

  const banner = document.getElementById('storageModeBanner');
  if (window.FocusUpFirebase.enabled && currentUser) {
    banner.className = 'mode-banner cloud';
    banner.innerHTML = `<b>☁️ Đã đồng bộ Cloud</b><br>Dữ liệu được bảo vệ an toàn trên tài khoản của bạn.`;
    document.getElementById('authActionBtn').textContent = `👤 ${name}`;
  } else {
    banner.className = 'mode-banner';
    banner.innerHTML = `<b>💾 Chế độ Local Storage</b><br>Dữ liệu lưu trên thiết bị này.`;
    document.getElementById('authActionBtn').textContent = window.FocusUpFirebase.enabled ? 'Đăng nhập Cloud' : `👤 ${name}`;
  }

  // Home Dashboard
  document.getElementById('daysUsedBadge').textContent = `NGÀY THỨ ${stats.daysSinceStart} SỬ DỤNG FOCUSUP`;
  document.getElementById('homeStreakStat').textContent = `${state.streak.current} ngày`;
  document.getElementById('homeStreakSub').textContent = `Chuỗi tập trung (Kỷ lục: ${state.streak.longest} ngày)`;
  document.getElementById('homeFocusStat').textContent = `${stats.totalFocusMinutes} phút`;
  document.getElementById('homeTasksStat').textContent = `${stats.totalCompletedTasks}`;
  document.getElementById('homeXpStat').textContent = `${state.xp} XP`;
  document.getElementById('homeRankStat').textContent = `${rankInfo.current.icon} ${rankInfo.current.name}`;

  document.getElementById('homeRankTitle').textContent = `${rankInfo.current.icon} ${rankInfo.current.name}`;
  document.getElementById('homeRankProgressText').textContent = rankInfo.next
    ? `${state.xp} / ${rankInfo.next.minXp} XP`
    : `${state.xp} XP (Tối đa)`;
  document.getElementById('homeRankBar').style.width = `${rankInfo.progressPct}%`;

  // Home Today Tasks
  document.getElementById('homeTodayDateStr').textContent = formatDisplayDateVN(todayStr);
  const todayTasks = ensureDayBucket(todayStr).tasks;
  document.getElementById('homeTodayTaskList').innerHTML = todayTasks.length === 0
    ? '<p class="muted" style="font-size:13.5px">Hôm nay chưa có nhiệm vụ nào. Nhấn "+ Thêm / Sửa" để lập kế hoạch!</p>'
    : todayTasks.map(t => `
      <div class="task-item ${t.completed ? 'completed' : ''}" style="padding:10px 12px">
        <input type="checkbox" class="task-checkbox" ${t.completed ? 'checked' : ''}
          onchange="toggleSingleTask('${todayStr}', '${escHtml(t.id)}', this.checked)">
        <div class="task-body">
          <span class="task-title" style="font-size:14px">${escHtml(t.title)}</span>
          <span class="tag ${getGroupBadgeClass(t.group)}">${escHtml(t.group)}</span>
        </div>
      </div>
    `).join('');

  // Profile Page
  document.getElementById('profileBigAvatar').textContent = name.charAt(0).toUpperCase();
  document.getElementById('profileRankBadge').textContent = `${rankInfo.current.icon} ${rankInfo.current.name}`;
  document.getElementById('profileNameHeading').textContent = name;
  document.getElementById('profileFriendCode').textContent = state.profile.friendCode;
  document.getElementById('profileStartDate').textContent = formatDisplayDateVN(state.profile.startDate);
  document.getElementById('editDisplayNameInput').value = state.profile.displayName || '';

  document.getElementById('profDaysSinceStart').textContent = `${stats.daysSinceStart} ngày`;
  document.getElementById('profActiveDays').textContent = `${stats.activeDays} ngày`;
  document.getElementById('profTotalFocus').textContent = `${stats.totalFocusMinutes} phút`;
  document.getElementById('profTotalTasks').textContent = `${stats.totalCompletedTasks}`;
  document.getElementById('profRankXp').textContent = `${rankInfo.current.name} · ${state.xp} XP`;
  document.getElementById('profStreaks').textContent = `${state.streak.current} / ${state.streak.longest} ngày`;

  // Settings Privacy & Blocked
  document.getElementById('privShareProfileCheck').checked = state.privacy.shareProfile !== false;
  document.getElementById('privShareHistoryCheck').checked = state.privacy.shareHistory !== false;
  document.getElementById('privAllowSearchCheck').checked = state.privacy.allowSearch !== false;

  document.getElementById('blockedUsersList').innerHTML = (state.blockedUsers || []).map(b => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px">
      <span>🚫 ${escHtml(b.displayName)}</span>
      <button class="btn btn-outline btn-small" onclick="unblockUser('${b.uid}')">Bỏ chặn</button>
    </div>
  `).join('') || '<small class="muted">Danh sách chặn trống.</small>';

  // Sub-views
  renderDailyTasks();
  renderFocusStatsAndHistory();
  renderSelfLimitChecklist();
  renderQuizWidget();
  renderFourSelfHistories();
  renderRankPage();
}

// ============================================================================
// 19. KHỞI CHẠY ỨNG DỤNG
// ============================================================================
(function bootstrap() {
  loadLocalState();
  applyPreferencesToDOM();
  updatePomodoroDisplay();
  updateSlowTimerUI();

  const fbReady = window.FocusUpFirebase.init();
  if (fbReady) {
    document.getElementById('firebaseConfigStatusText').innerHTML =
      '✅ <b>Firebase đã được cấu hình.</b> Bạn có thể đăng nhập/đăng ký tài khoản Cloud để đồng bộ dữ liệu & kết bạn.';

    window.FocusUpFirebase.auth.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        const doc = await window.FocusUpFirebase.db.collection('users').doc(user.uid).get();
        if (doc.exists) {
          const def = createDefaultUserData('', user.uid);
          const cloudData = doc.data();
          state = {
            ...def,
            ...cloudData,
            uid: user.uid,
            profile: { ...def.profile, ...(cloudData.profile || {}) },
            streak: { ...def.streak, ...(cloudData.streak || {}) },
            preferences: { ...def.preferences, ...(cloudData.preferences || {}) },
            privacy: { ...def.privacy, ...(cloudData.privacy || {}) },
            dailyData: cloudData.dailyData || {}
          };
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
        } else {
          state.uid = user.uid;
          await saveState(true);
        }
        applyPreferencesToDOM();
        renderAll();
        loadFriendsAndRequests();
      } else {
        currentUser = null;
        renderAll();
      }
    });
  }

  recalculateStreakAndTotals();
  renderAll();

  // Nếu lần đầu truy cập chưa có tên hiển thị -> mở hộp thoại chào mừng
  if (!state.profile.isOnboarded || !state.profile.displayName) {
    openAuthModal(true);
  }
})();
