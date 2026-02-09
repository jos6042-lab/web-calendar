/***********************
 * 0) 색상 팔레트
 ***********************/
const COLORS = {
  red: "#e53935",
  yellow: "#fbc02d",
  green: "#43a047",
  blue: "#1e88e5",
  purple: "#8e24aa",
};
const COLOR_KEYS = Object.keys(COLORS);

/***********************
 * ✅ 6단계: 테마(다크모드) 저장
 ***********************/
const LS_THEME = "wc_theme";
const themeToggleBtn = document.getElementById("themeToggle");

function applyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
  if (themeToggleBtn) themeToggleBtn.textContent = t === "dark" ? "☀️ 라이트" : "🌙 다크";
  localStorage.setItem(LS_THEME, t);
}
function initTheme() {
  const saved = localStorage.getItem(LS_THEME);
  if (saved === "dark" || saved === "light") return applyTheme(saved);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  applyTheme(prefersDark ? "dark" : "light");
}
themeToggleBtn?.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(cur === "dark" ? "light" : "dark");
});

/***********************
 * 1) DOM
 ***********************/
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const signupBtn = document.getElementById("signup");
const loginBtn = document.getElementById("login");
const logoutBtn = document.getElementById("logout");
const statusEl = document.getElementById("authStatus");

const datesContainer = document.getElementById("dates");
const titleEl = document.getElementById("title");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");

const exportBtn = document.getElementById("exportJson");
const importInput = document.getElementById("importJson");

const serverBackupBtn = document.getElementById("serverBackup");
const serverSyncBtn = document.getElementById("serverSync");
const API_BASE = "http://localhost:3000";

const resetLocalBtn = document.getElementById("resetLocal");

const monthSearchEl = document.getElementById("monthSearch");
const monthFilterEl = document.getElementById("monthFilter");
const monthCountEl = document.getElementById("monthCount");
const monthListEl = document.getElementById("monthList");
const monthEmptyEl = document.getElementById("monthEmpty");

/* 일정 모달 */
const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const modalCancel = document.getElementById("modalCancel");
const modalSub = document.getElementById("modalSub");

const scheduleText = document.getElementById("scheduleText");
const colorPalette = document.getElementById("colorPalette");
const addScheduleBtn = document.getElementById("addScheduleBtn");
const scheduleList = document.getElementById("scheduleList");
const emptyText = document.getElementById("emptyText");

/* ✅ 동기화 모달 + Undo */
const syncBackdrop = document.getElementById("syncBackdrop");
const syncClose = document.getElementById("syncClose");
const syncCancel = document.getElementById("syncCancel");
const syncMergeBtn = document.getElementById("syncMerge");
const syncReplaceLocalBtn = document.getElementById("syncReplaceLocal");
const syncReplaceServerBtn = document.getElementById("syncReplaceServer");
const syncStatsEl = document.getElementById("syncStats");

const syncUndoBtn = document.getElementById("syncUndo");
const undoHintEl = document.getElementById("undoHint");

/* ✅ Quick Add */
const quickAddInput = document.getElementById("quickAddInput");
const quickAddBtn = document.getElementById("quickAddBtn");

/***********************
 * 2) 로컬 저장 키
 ***********************/
const LS_USERS = "wc_users";
const LS_SESSION = "wc_session";
const LS_DB_PREFIX = "wc_db_";

/* ✅ Undo 스냅샷 키 (계정별 1개) */
const LS_UNDO_PREFIX = "wc_undo_";

/***********************
 * 3) 상태
 ***********************/
let currentUserEmail = null;
let db = { userId: null, events: [] };

let selectedEl = null;
let selectedDateKey = null;

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

let selectedColorKey = "red";

/* ✅ 서버에서 읽어온 임시 DB */
let cachedRemoteDB = null;

/***********************
 * 4) 유틸
 ***********************/
function pad2(n) {
  return String(n).padStart(2, "0");
}
function makeDateKey(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}
function uuid(prefix = "id") {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return String(h);
}
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(LS_USERS)) || {};
  } catch {
    return {};
  }
}
function setUsers(users) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}
function setSession(email) {
  localStorage.setItem(LS_SESSION, JSON.stringify({ email }));
}
function getSession() {
  try {
    return JSON.parse(localStorage.getItem(LS_SESSION)) || null;
  } catch {
    return null;
  }
}
function clearSession() {
  localStorage.removeItem(LS_SESSION);
}
function dbKey(email) {
  return `${LS_DB_PREFIX}${email.toLowerCase()}`;
}
function undoKey(email) {
  return `${LS_UNDO_PREFIX}${email.toLowerCase()}`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isValidDBShape(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (!Array.isArray(obj.events)) return false;
  for (const e of obj.events) {
    if (!e || typeof e !== "object") return false;
    if (typeof e.id !== "string") return false;
    if (typeof e.date !== "string") return false;
    if (typeof e.title !== "string") return false;
    if (typeof e.color !== "string") return false;
  }
  return true;
}

function normalizeDB(obj) {
  return {
    userId: obj.userId || uuid("user"),
    events: (obj.events || []).map((e) => ({
      id: e.id || uuid("evt"),
      date: e.date,
      title: e.title ?? "",
      color: COLORS[e.color] ? e.color : "blue",
      createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
    })),
  };
}

function mergeEvents(baseEvents, incomingEvents) {
  const map = new Map();
  baseEvents.forEach((ev) => map.set(ev.id, ev));
  incomingEvents.forEach((ev) => map.set(ev.id, ev));
  return Array.from(map.values());
}

function sortByDateThenTime(a, b) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return (a.createdAt || 0) - (b.createdAt || 0);
}

// ✅ 제목이 "HH:MM ..."로 시작하면 시간 일정으로 간주
function extractStartTimeFromTitle(title) {
  const t = String(title || "").trim();
  const m = t.match(/^(\d{1,2}):(\d{2})\s+/);
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm, key: `${pad2(hh)}:${pad2(mm)}` };
}


/** ✅ 로딩 중 버튼 처리 개선: 이전 텍스트 + 이전 disabled 복원 */
function setBtnLoading(btn, loadingText, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset._prevText = btn.textContent;
    btn.dataset._prevDisabled = String(btn.disabled);
    btn.textContent = loadingText;
    btn.disabled = true;
  } else {
    if (btn.dataset._prevText) btn.textContent = btn.dataset._prevText;
    const prevDisabled = btn.dataset._prevDisabled === "true";
    btn.disabled = prevDisabled;
    delete btn.dataset._prevText;
    delete btn.dataset._prevDisabled;
  }
}

/***********************
 * ✅ Undo 스냅샷 기능 (1회)
 ***********************/
function saveUndoSnapshot(reason = "작업 전 스냅샷") {
  if (!currentUserEmail) return;

  const snapshot = {
    savedAt: Date.now(),
    reason,
    db: normalizeDB(db),
  };

  localStorage.setItem(undoKey(currentUserEmail), JSON.stringify(snapshot));
  updateUndoUI();
}

function loadUndoSnapshot() {
  if (!currentUserEmail) return null;
  try {
    const raw = localStorage.getItem(undoKey(currentUserEmail));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearUndoSnapshot() {
  if (!currentUserEmail) return;
  localStorage.removeItem(undoKey(currentUserEmail));
  updateUndoUI();
}

function fmtTime(ms) {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function updateUndoUI() {
  if (!syncUndoBtn || !undoHintEl) return;
  if (!currentUserEmail) {
    syncUndoBtn.disabled = true;
    undoHintEl.textContent = "스냅샷이 없어요.";
    return;
  }

  const snap = loadUndoSnapshot();
  if (!snap?.db || !isValidDBShape(snap.db)) {
    syncUndoBtn.disabled = true;
    undoHintEl.textContent = "스냅샷이 없어요.";
    return;
  }

  syncUndoBtn.disabled = false;
  const when = fmtTime(snap.savedAt);
  undoHintEl.textContent = `${when} 저장됨 · ${snap.reason}`;
}

/***********************
 * 5) DB 로드/세이브
 ***********************/
function loadDB(email) {
  try {
    const raw = localStorage.getItem(dbKey(email));
    if (raw) return JSON.parse(raw);
  } catch {}

  // 예전 키 마이그레이션
  const oldKey = `wc_sched_${email.toLowerCase()}`;
  try {
    const oldRaw = localStorage.getItem(oldKey);
    if (!oldRaw) return { userId: uuid("user"), events: [] };

    const oldObj = JSON.parse(oldRaw);
    const events = [];

    Object.keys(oldObj).forEach((date) => {
      oldObj[date].forEach((item) => {
        events.push({
          id: item.id || uuid("evt"),
          date,
          title: item.text || "",
          color: item.color || "blue",
          createdAt: Date.now(),
        });
      });
    });

    const newDB = { userId: uuid("user"), events };
    localStorage.setItem(dbKey(email), JSON.stringify(newDB));
    return newDB;
  } catch {
    return { userId: uuid("user"), events: [] };
  }
}
function saveDB(email) {
  localStorage.setItem(dbKey(email), JSON.stringify(db));
}

/***********************
 * 6) Auth UI
 ***********************/
function updateAuthUI() {
  if (currentUserEmail) {
    statusEl.textContent = `로그인 상태: ✅ ${currentUserEmail}`;
    logoutBtn.disabled = false;
  } else {
    statusEl.textContent = "로그인 상태: ❌ 로그아웃";
    logoutBtn.disabled = true;
  }

  const enabled = !!currentUserEmail;

  exportBtn.disabled = !enabled;
  importInput.disabled = !enabled;

  const label = importInput.closest(".file-btn");
  if (label) label.classList.toggle("disabled", !enabled);

  serverBackupBtn.disabled = !enabled;
  serverSyncBtn.disabled = !enabled;
  resetLocalBtn.disabled = !enabled;

  if (!enabled) {
    monthCountEl.textContent = "로그인 후 확인 가능";
    monthListEl.innerHTML = "";
    monthEmptyEl.style.display = "none";
  }

  updateUndoUI();
}

function login(email) {
  currentUserEmail = email;
  setSession(email);
  db = loadDB(email);
  updateAuthUI();
  renderCalendar(currentYear, currentMonth);
}

function logout() {
  currentUserEmail = null;
  clearSession();
  db = { userId: null, events: [] };
  cachedRemoteDB = null;

  if (selectedEl) selectedEl.classList.remove("selected");
  selectedEl = null;
  selectedDateKey = null;

  closeModal();
  closeSyncModal();
  updateAuthUI();
  renderCalendar(currentYear, currentMonth);
}

/***********************
 * 6-1) Auth events
 ***********************/
signupBtn.addEventListener("click", () => {
  const email = emailEl.value.trim().toLowerCase();
  const pw = passwordEl.value.trim();

  if (!email || !pw) return alert("이메일/비밀번호를 입력하세요.");
  if (pw.length < 6) return alert("비밀번호는 6자 이상으로 해줘.");

  const users = getUsers();
  if (users[email]) return alert("이미 가입된 이메일이야.");

  users[email] = { pwHash: simpleHash(pw) };
  setUsers(users);

  const initDB = { userId: uuid("user"), events: [] };
  localStorage.setItem(dbKey(email), JSON.stringify(initDB));

  alert("회원가입 성공! 이제 로그인해봐.");
});

loginBtn.addEventListener("click", () => {
  const email = emailEl.value.trim().toLowerCase();
  const pw = passwordEl.value.trim();

  if (!email || !pw) return alert("이메일/비밀번호를 입력하세요.");

  const users = getUsers();
  if (!users[email]) return alert("가입된 계정이 없어. 회원가입부터 해줘.");
  if (users[email].pwHash !== simpleHash(pw)) return alert("비밀번호가 틀렸어.");

  login(email);
});

logoutBtn.addEventListener("click", () => logout());

/***********************
 * 7) events 조회
 ***********************/
function getEventsByDate(dateKey) {
  return db.events.filter((e) => e.date === dateKey);
}

/***********************
 * 5단계: 월 패널
 ***********************/
function getEventsInMonth(year, month) {
  const prefix = `${year}-${pad2(month + 1)}-`;
  return db.events.filter((e) => typeof e.date === "string" && e.date.startsWith(prefix));
}

function renderMonthPanel() {
  if (!currentUserEmail) return;

  const q = (monthSearchEl.value || "").trim().toLowerCase();
  const color = monthFilterEl.value || "all";

  let list = getEventsInMonth(currentYear, currentMonth).slice().sort(sortByDateThenTime);
  if (color !== "all") list = list.filter((e) => e.color === color);
  if (q) list = list.filter((e) => (e.title || "").toLowerCase().includes(q));

  monthListEl.innerHTML = "";
  monthCountEl.textContent = `총 ${list.length}개 (검색/필터 반영)`;

  if (list.length === 0) {
    monthEmptyEl.style.display = "block";
    return;
  }
  monthEmptyEl.style.display = "none";

  for (const item of list) {
    const row = document.createElement("div");
    row.className = "panel-item";

    const left = document.createElement("div");
    left.className = "panel-left";

    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.background = COLORS[item.color] || COLORS.blue;

    const badge = document.createElement("div");
    badge.className = "badge-date";
    badge.textContent = item.date;

    const text = document.createElement("div");
    text.className = "panel-text";
    text.textContent = item.title;

    left.appendChild(dot);
    left.appendChild(badge);
    left.appendChild(text);

    const del = document.createElement("button");
    del.className = "panel-del";
    del.textContent = "삭제";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      db.events = db.events.filter((ev) => ev.id !== item.id);
      saveDB(currentUserEmail);

      if (selectedDateKey && modalBackdrop.classList.contains("show")) renderScheduleList(selectedDateKey);
      renderCalendar(currentYear, currentMonth);
      renderMonthPanel(); // ✅ 패널 즉시 갱신
    });

    row.addEventListener("click", () => {
      jumpToDate(item.date);
      openModal(item.date);
    });

    row.appendChild(left);
    row.appendChild(del);
    monthListEl.appendChild(row);
  }
}

function jumpToDate(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return;

  const targetYear = y;
  const targetMonth = m - 1;

  if (targetYear !== currentYear || targetMonth !== currentMonth) {
    currentYear = targetYear;
    currentMonth = targetMonth;
    renderCalendar(currentYear, currentMonth);
  }

  requestAnimationFrame(() => {
    const node = datesContainer.querySelector(`.date[data-date="${dateKey}"]`);
    if (!node) return;
    if (selectedEl) selectedEl.classList.remove("selected");
    node.classList.add("selected");
    selectedEl = node;
    selectedDateKey = dateKey;
  });
}

monthSearchEl.addEventListener("input", renderMonthPanel);
monthFilterEl.addEventListener("change", renderMonthPanel);

/***********************
 * 8) 캘린더 렌더
 ***********************/
function renderCalendar(year, month) {
  datesContainer.innerHTML = "";
  titleEl.textContent = `${year}년 ${month + 1}월`;

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  const now = new Date();
  const isThisMonth = now.getFullYear() === year && now.getMonth() === month;
  const todayNumber = now.getDate();

  // ✅ 재렌더링 시 선택 DOM 재지정
  selectedEl = null;

  // 빈칸
  for (let i = 0; i < firstDay; i++) datesContainer.appendChild(document.createElement("div"));

  for (let day = 1; day <= lastDate; day++) {
    const dateKey = makeDateKey(year, month, day);
    const list = currentUserEmail ? getEventsByDate(dateKey) : [];

    const dateEl = document.createElement("div");
    dateEl.className = "date";
    dateEl.dataset.date = dateKey;

    const dow = new Date(year, month, day).getDay();
    if (dow === 0) dateEl.classList.add("sun");
    if (dow === 6) dateEl.classList.add("sat");

    if (isThisMonth && day === todayNumber) dateEl.classList.add("today");

    // ✅ 선택 유지
    if (selectedDateKey === dateKey) {
      dateEl.classList.add("selected");
      selectedEl = dateEl;
    }

    const numEl = document.createElement("div");
    numEl.className = "date-number";
    numEl.textContent = day;
    dateEl.appendChild(numEl);

    if (list.length > 0) {
  // 1) 시간 일정 / 종일 일정 분리
  const timed = [];
  const allDay = [];

  for (const item of list) {
    const time = extractStartTimeFromTitle(item.title);
    if (time) timed.push({ ...item, _timeKey: time.key });
    else allDay.push(item);
  }

  // 2) 시간 일정은 시간순 정렬 후 bar로 표시 (최대 3개)
  if (timed.length > 0) {
    timed.sort((a, b) => a._timeKey.localeCompare(b._timeKey));

    const bars = document.createElement("div");
    bars.className = "bars";

    timed.slice(0, 3).forEach((item) => {
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.background = COLORS[item.color] || COLORS.blue;
      bar.title = item.title;
      bars.appendChild(bar);
    });

    // 3개 초과는 +N 표시(작게)
    if (timed.length > 3) {
      const more = document.createElement("span");
      more.className = "more";
      more.textContent = `+${timed.length - 3}`;
      bars.appendChild(more);
    }

    dateEl.appendChild(bars);
  }

  // 3) 종일 일정은 기존 dot로 표시(최대 6개)
  if (allDay.length > 0) {
    const dots = document.createElement("div");
    dots.className = "dots";

    allDay.slice(0, 6).forEach((item) => {
      const dot = document.createElement("div");
      dot.className = "dot";
      dot.style.background = COLORS[item.color] || COLORS.blue;
      dot.title = item.title;
      dots.appendChild(dot);
    });

    if (allDay.length > 6) {
      const more = document.createElement("span");
      more.className = "more";
      more.textContent = `+${allDay.length - 6}`;
      dots.appendChild(more);
    }

    dateEl.appendChild(dots);
  }
}


    dateEl.addEventListener("click", () => onDateClick(dateEl, dateKey));
    datesContainer.appendChild(dateEl);
  }

  if (currentUserEmail) renderMonthPanel();
}

function onDateClick(dateEl, dateKey) {
  if (!currentUserEmail) return alert("로그인 후 사용 가능합니다.");

  if (selectedEl) selectedEl.classList.remove("selected");
  dateEl.classList.add("selected");
  selectedEl = dateEl;

  selectedDateKey = dateKey;
  openModal(dateKey);
}

/***********************
 * 9) 월 이동
 ***********************/
prevBtn.addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar(currentYear, currentMonth);
});
nextBtn.addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar(currentYear, currentMonth);
});

/***********************
 * 10) 일정 모달
 ***********************/
function buildPalette() {
  colorPalette.innerHTML = "";
  COLOR_KEYS.forEach((key) => {
    const chip = document.createElement("div");
    chip.className = "color-chip" + (key === selectedColorKey ? " selected" : "");
    chip.style.background = COLORS[key];
    chip.addEventListener("click", () => {
      selectedColorKey = key;
      buildPalette();
    });
    colorPalette.appendChild(chip);
  });
}

function openModal(dateKey) {
  modalSub.textContent = dateKey;
  scheduleText.value = "";
  buildPalette();
  renderScheduleList(dateKey);

  modalBackdrop.classList.add("show");
  modalBackdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => scheduleText.focus(), 50);
}

function closeModal() {
  modalBackdrop.classList.remove("show");
  modalBackdrop.setAttribute("aria-hidden", "true");
}

function renderScheduleList(dateKey) {
  const list = getEventsByDate(dateKey).slice().sort(sortByDateThenTime);
  scheduleList.innerHTML = "";

  if (list.length === 0) {
    emptyText.style.display = "block";
    return;
  }
  emptyText.style.display = "none";

  list.forEach((item) => {
    const row = document.createElement("div");
    row.className = "item";

    const left = document.createElement("div");
    left.className = "item-left";

    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.background = COLORS[item.color] || COLORS.blue;

    const text = document.createElement("div");
    text.className = "item-text";
    text.textContent = item.title;

    left.appendChild(dot);
    left.appendChild(text);

    const del = document.createElement("button");
    del.className = "item-del";
    del.textContent = "삭제";
    del.addEventListener("click", () => {
      db.events = db.events.filter((e) => e.id !== item.id);
      saveDB(currentUserEmail);
      renderScheduleList(dateKey);
      renderCalendar(currentYear, currentMonth);
      renderMonthPanel(); // ✅ 패널 즉시 갱신
    });

    row.appendChild(left);
    row.appendChild(del);
    scheduleList.appendChild(row);
  });
}

addScheduleBtn.addEventListener("click", () => {
  if (!selectedDateKey) return;

  const title = scheduleText.value.trim();
  if (!title) return alert("일정 내용을 입력하세요.");

  db.events.push({
    id: uuid("evt"),
    date: selectedDateKey,
    title,
    color: selectedColorKey,
    createdAt: Date.now(),
  });

  saveDB(currentUserEmail);
  scheduleText.value = "";
  renderScheduleList(selectedDateKey);
  renderCalendar(currentYear, currentMonth);
  renderMonthPanel(); // ✅ 패널 즉시 갱신
});

// ✅ Enter로도 추가
scheduleText.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addScheduleBtn.click();
});

modalClose.addEventListener("click", closeModal);
modalCancel.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (syncBackdrop.classList.contains("show")) closeSyncModal();
    else closeModal();
  }
});

/***********************
 * ✅ 동기화 모달 열기/닫기 + 상태표시 + Undo UI
 ***********************/
function openSyncModal() {
  syncBackdrop.classList.add("show");
  syncBackdrop.setAttribute("aria-hidden", "false");
  updateUndoUI();
}
function closeSyncModal() {
  syncBackdrop.classList.remove("show");
  syncBackdrop.setAttribute("aria-hidden", "true");
}
syncClose.addEventListener("click", closeSyncModal);
syncCancel.addEventListener("click", closeSyncModal);
syncBackdrop.addEventListener("click", (e) => {
  if (e.target === syncBackdrop) closeSyncModal();
});

function setSyncStats(localCount, serverCount) {
  if (!syncStatsEl) return;
  syncStatsEl.textContent = `로컬: ${localCount}개 / 서버: ${serverCount}개`;
}

/***********************
 * ✅ 3단계: JSON 내보내기/가져오기
 ***********************/
exportBtn.addEventListener("click", () => {
  if (!currentUserEmail) return alert("로그인 후 사용 가능합니다.");
  const payload = { exportedAt: new Date().toISOString(), email: currentUserEmail, db };
  const safeName = currentUserEmail.replaceAll("@", "_").replaceAll(".", "_");
  downloadText(`webcalendar_${safeName}_${Date.now()}.json`, JSON.stringify(payload, null, 2));
});

importInput.addEventListener("change", async (e) => {
  if (!currentUserEmail) return alert("로그인 후 사용 가능합니다.");

  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const incomingRaw = parsed?.db ? parsed.db : parsed;
    if (!isValidDBShape(incomingRaw)) return alert("가져오기 실패: JSON 형식이 올바르지 않아요.");

    saveUndoSnapshot("JSON 가져오기 전");

    const incoming = normalizeDB(incomingRaw);
    const before = db.events.length;

    db.events = mergeEvents(db.events, incoming.events);
    if (!db.userId) db.userId = incoming.userId || uuid("user");
    saveDB(currentUserEmail);

    renderCalendar(currentYear, currentMonth);
    if (selectedDateKey && modalBackdrop.classList.contains("show")) renderScheduleList(selectedDateKey);
    renderMonthPanel();

    alert(`가져오기 완료 ✅\n이벤트: ${before}개 → ${db.events.length}개`);
  } catch {
    alert("가져오기 실패: JSON 파일 오류");
  } finally {
    importInput.value = "";
  }
});

/***********************
 * ✅ 4단계: Node API
 ***********************/
async function apiGetDB(email) {
  const res = await fetch(`${API_BASE}/api/db/${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error("GET 실패");
  return res.json();
}
async function apiSaveDB(email, dbPayload) {
  const res = await fetch(`${API_BASE}/api/db/${encodeURIComponent(email)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ db: dbPayload }),
  });
  if (!res.ok) throw new Error("POST 실패");
  return res.json();
}

/* 서버 백업 */
serverBackupBtn.addEventListener("click", async () => {
  if (!currentUserEmail) return alert("로그인 후 사용 가능합니다.");

  try {
    setBtnLoading(serverBackupBtn, "백업중...", true);
    const safe = normalizeDB(db);
    const result = await apiSaveDB(currentUserEmail, safe);
    alert(`서버 백업 완료 ✅\n이벤트: ${result?.count ?? safe.events.length}개`);
  } catch {
    alert("서버 백업 실패 ❌\n서버 실행 확인: localhost:3000");
  } finally {
    setBtnLoading(serverBackupBtn, "백업중...", false);
  }
});

/***********************
 * ✅ 서버에서 불러오기 -> 서버 DB 캐시 + 모달 오픈
 ***********************/
serverSyncBtn.addEventListener("click", async () => {
  if (!currentUserEmail) return alert("로그인 후 사용 가능합니다.");

  try {
    setBtnLoading(serverSyncBtn, "불러오는중...", true);

    const remote = await apiGetDB(currentUserEmail);
    if (!remote?.db || !isValidDBShape(remote.db)) {
      cachedRemoteDB = null;
      return alert("서버 데이터 형식이 올바르지 않아요.");
    }

    cachedRemoteDB = normalizeDB(remote.db);

    setSyncStats(db.events.length, cachedRemoteDB.events.length);
    openSyncModal();
  } catch {
    cachedRemoteDB = null;
    alert("서버에서 불러오기 실패 ❌\n서버 실행 확인: localhost:3000");
  } finally {
    setBtnLoading(serverSyncBtn, "불러오는중...", false);
  }
});

/* (1) 병합 */
syncMergeBtn.addEventListener("click", () => {
  if (!currentUserEmail) return;
  if (!cachedRemoteDB) return alert("서버 데이터를 먼저 불러와야 해요.");

  saveUndoSnapshot("서버 병합 전");

  const before = db.events.length;
  db.events = mergeEvents(db.events, cachedRemoteDB.events);
  if (!db.userId) db.userId = cachedRemoteDB.userId || uuid("user");

  saveDB(currentUserEmail);

  renderCalendar(currentYear, currentMonth);
  if (selectedDateKey && modalBackdrop.classList.contains("show")) renderScheduleList(selectedDateKey);
  renderMonthPanel();

  closeSyncModal();
  alert(`병합 완료 ✅\n이벤트: ${before}개 → ${db.events.length}개`);
});

/* (2) 서버로 덮어쓰기 (로컬 = 서버로 교체) */
syncReplaceLocalBtn.addEventListener("click", () => {
  if (!currentUserEmail) return;
  if (!cachedRemoteDB) return alert("서버 데이터를 먼저 불러와야 해요.");

  const ok = confirm(
    `정말 "서버로 덮어쓰기" 할까요?\n\n` +
      `로컬 ${db.events.length}개 → 서버 ${cachedRemoteDB.events.length}개로 교체됩니다.\n` +
      `⚠️ 로컬 기존 데이터는 사라져요.`
  );
  if (!ok) return;

  saveUndoSnapshot("서버로 덮어쓰기 전");

  db = cachedRemoteDB;
  saveDB(currentUserEmail);

  closeModal();
  selectedDateKey = null;
  if (selectedEl) selectedEl.classList.remove("selected");
  selectedEl = null;

  renderCalendar(currentYear, currentMonth);
  renderMonthPanel();
  closeSyncModal();
  alert(`서버로 덮어쓰기 완료 ✅\n이벤트: ${db.events.length}개`);
});

/* (3) 로컬을 서버로 덮어쓰기 (서버 = 로컬로 교체 업로드) */
syncReplaceServerBtn.addEventListener("click", async () => {
  if (!currentUserEmail) return;

  const ok = confirm(
    `정말 "로컬을 서버로 덮어쓰기" 할까요?\n\n` +
      `서버 데이터가 현재 로컬 데이터(${db.events.length}개)로 교체됩니다.\n` +
      `⚠️ 서버 기존 데이터는 사라져요.`
  );
  if (!ok) return;

  try {
    setBtnLoading(syncReplaceServerBtn, "업로드중...", true);
    const safe = normalizeDB(db);
    const result = await apiSaveDB(currentUserEmail, safe);
    closeSyncModal();
    alert(`로컬 → 서버 덮어쓰기 완료 ✅\n서버 이벤트: ${result?.count ?? safe.events.length}개`);
  } catch {
    alert("로컬 → 서버 덮어쓰기 실패 ❌\n서버 실행 확인: localhost:3000");
  } finally {
    setBtnLoading(syncReplaceServerBtn, "업로드중...", false);
  }
});

/* ✅ Undo 실행 */
syncUndoBtn.addEventListener("click", () => {
  if (!currentUserEmail) return;

  const snap = loadUndoSnapshot();
  if (!snap?.db || !isValidDBShape(snap.db)) return alert("복구할 스냅샷이 없어요.");

  const ok = confirm(
    `되돌리기(Undo) 할까요?\n\n` +
      `저장 시각: ${fmtTime(snap.savedAt)}\n` +
      `사유: ${snap.reason}\n\n` +
      `현재 로컬 데이터가 스냅샷으로 복구됩니다.`
  );
  if (!ok) return;

  db = normalizeDB(snap.db);
  saveDB(currentUserEmail);

  closeModal();
  selectedDateKey = null;
  if (selectedEl) selectedEl.classList.remove("selected");
  selectedEl = null;

  renderCalendar(currentYear, currentMonth);
  renderMonthPanel();
  alert("되돌리기 완료 ✅");

  /* ✅ Undo는 1회성: 복구 후 스냅샷 삭제 */
  clearUndoSnapshot();
});

/***********************
 * ✅ 데모용: 로컬 초기화 (Undo 지원)
 ***********************/
resetLocalBtn.addEventListener("click", () => {
  if (!currentUserEmail) return alert("로그인 후 사용 가능합니다.");

  const ok = confirm(
    "현재 계정의 로컬(브라우저) 일정 데이터를 모두 삭제할까요?\n" + "⚠️ 서버 백업을 먼저 해두는 걸 추천해요."
  );
  if (!ok) return;

  saveUndoSnapshot("로컬 초기화 전");

  db = { userId: db.userId || uuid("user"), events: [] };
  saveDB(currentUserEmail);

  closeModal();
  selectedDateKey = null;
  if (selectedEl) selectedEl.classList.remove("selected");
  selectedEl = null;

  renderCalendar(currentYear, currentMonth);
  renderMonthPanel();
  alert("로컬 데이터 초기화 완료 ✅\n이제 '서버에서 불러오기'로 복원해보세요.");
});

/***********************
 * ✅ Quick Add (빠른 추가)
 * 지원 포맷:
 * 1) M/D HH:MM 제목        예) 1/20 19:00 헬스
 * 2) M/D 제목              예) 1/20 헬스  (시간 없으면 종일)
 * 3) YYYY-MM-DD HH:MM 제목 예) 2026-01-20 19:00 약속
 * 4) YYYY-MM-DD 제목       예) 2026-01-20 생일
 ***********************/
function parseQuickAdd(text) {
  const raw = (text || "").trim();
  if (!raw) return null;

  const s = raw.replace(/\s+/g, " ");

  // YYYY-MM-DD HH:MM title
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})\s+(.+)$/);
  if (m) {
    const y = Number(m[1]),
      mo = Number(m[2]),
      d = Number(m[3]);
    const hh = Number(m[4]),
      mm = Number(m[5]);
    const title = m[6].trim();
    if (!title) return null;
    return { y, mo, d, hh, mm, title };
  }

  // YYYY-MM-DD title
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(.+)$/);
  if (m) {
    const y = Number(m[1]),
      mo = Number(m[2]),
      d = Number(m[3]);
    const title = m[4].trim();
    if (!title) return null;
    return { y, mo, d, hh: null, mm: null, title };
  }

  // M/D HH:MM title
  m = s.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\s+(.+)$/);
  if (m) {
    const y = new Date().getFullYear();
    const mo = Number(m[1]),
      d = Number(m[2]);
    const hh = Number(m[3]),
      mm = Number(m[4]);
    const title = m[5].trim();
    if (!title) return null;
    return { y, mo, d, hh, mm, title };
  }

  // M/D title
  m = s.match(/^(\d{1,2})\/(\d{1,2})\s+(.+)$/);
  if (m) {
    const y = new Date().getFullYear();
    const mo = Number(m[1]),
      d = Number(m[2]);
    const title = m[3].trim();
    if (!title) return null;
    return { y, mo, d, hh: null, mm: null, title };
  }

  return null;
}

function safeDateKeyFromParsed(p) {
  if (!p) return null;
  const y = p.y,
    mo = p.mo,
    d = p.d;
  if (!y || !mo || !d) return null;

  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;

  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

function doQuickAdd() {
  if (!currentUserEmail) return alert("로그인 후 사용 가능합니다.");
  if (!quickAddInput) return alert("Quick Add 입력창이 없어요. index.html 확인!");

  const parsed = parseQuickAdd(quickAddInput.value || "");
  if (!parsed) {
    return alert(
      "형식이 맞지 않아요.\n예) 1/20 19:00 헬스  |  1/20 헬스  |  2026-01-20 19:00 약속"
    );
  }

  const dateKey = safeDateKeyFromParsed(parsed);
  if (!dateKey) return alert("날짜가 올바르지 않아요.");

  // 시간 있으면 제목 앞에 붙여서 더 직관적으로
  const timePrefix =
    parsed.hh != null && parsed.mm != null ? `${pad2(parsed.hh)}:${pad2(parsed.mm)} ` : "";
  const title = `${timePrefix}${parsed.title}`.trim();

  db.events.push({
    id: uuid("evt"),
    date: dateKey,
    title,
    color: selectedColorKey || "blue",
    createdAt: Date.now(),
  });

  saveDB(currentUserEmail);

  // UX: 해당 날짜로 점프 + 선택 + (원하면) 모달까지 열기
  jumpToDate(dateKey);
  renderCalendar(currentYear, currentMonth);
  renderMonthPanel();

  quickAddInput.value = "";
  quickAddInput.focus();
}

quickAddBtn?.addEventListener("click", doQuickAdd);
quickAddInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doQuickAdd();
});

/***********************
 * 11) 시작
 ***********************/
(function init() {
  initTheme();

  const session = getSession();
  if (session?.email) {
    currentUserEmail = session.email;
    db = loadDB(currentUserEmail);
  }

  updateAuthUI();
  renderCalendar(currentYear, currentMonth);
})();
