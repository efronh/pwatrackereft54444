// DOM Elements
const viewTodayBtn = document.getElementById('view-today-btn');
const viewCalendarBtn = document.getElementById('view-calendar-btn');
const viewTasksBtn = document.getElementById('view-tasks-btn');
const viewStatsBtn = document.getElementById('view-stats-btn');
const viewToday = document.getElementById('view-today');
const viewCalendar = document.getElementById('view-calendar');
const viewTasks = document.getElementById('view-tasks');
const viewStats = document.getElementById('view-stats');

const localTimeEl = document.getElementById('local-time');
const heroDateEl = document.getElementById('hero-date');
const heroDayEl = document.getElementById('hero-day-name');
const heroGreetingEl = document.getElementById('hero-greeting');

const waterCurrentEl = document.getElementById('water-current');
const waterGoalEl = document.getElementById('water-goal');
const waterBarEl = document.getElementById('water-bar');
const waterAddBtns = document.querySelectorAll('.water-add-btn');
const statsMoodAvgEl = document.getElementById('stats-mood-avg');
const statsBestDayEl = document.getElementById('stats-best-day');
const statsStatusEl = document.getElementById('stats-status');
const statsChartRootEl = document.getElementById('stats-chart-root');
const statsWaterChangeEl = document.getElementById('stats-water-change');
const statsWaterCurrentEl = document.getElementById('stats-water-current');
const statsWaterTargetEl = document.getElementById('stats-water-target');
const authModalOverlay = document.getElementById('auth-modal-overlay');
const authUsernameInput = document.getElementById('auth-username');
const authPinInput = document.getElementById('auth-pin');
const authErrorEl = document.getElementById('auth-error');
const authLoginBtn = document.getElementById('auth-login-btn');
const authRegisterBtn = document.getElementById('auth-register-btn');

let isAuthBusy = false;
const LOCAL_AUTH_USERS_KEY = 'localAuthUsers';
const LOCAL_AUTH_SESSION_KEY = 'localAuthSession';

function sanitizeUsername(usernameRaw) {
    return String(usernameRaw || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '');
}

function formatDisplayName(nameRaw) {
    const cleaned = String(nameRaw || '').trim();
    if (!cleaned) return '';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 24);
}

function updateGreeting(displayNameRaw) {
    if (!heroGreetingEl) return;
    const display = formatDisplayName(displayNameRaw || localStorage.getItem('preferredUsername'));
    heroGreetingEl.textContent = display ? `Hello ${display}` : 'Hello';
}

function buildSupabaseEmailFromUsername(username) {
    return `${username}@trackerapp.dev`;
}

function validateAuthInputs(usernameRaw, pinRaw) {
    const username = sanitizeUsername(usernameRaw);
    const displayUsername = String(usernameRaw || '').trim();
    const pin = String(pinRaw || '').trim();
    if (!username || username.length < 3) {
        throw new Error('Kullanici adi en az 3 karakter olmali.');
    }
    if (!/^\d{6}$/.test(pin)) {
        throw new Error('PIN tam 6 haneli olmali.');
    }
    return { username, displayUsername: displayUsername || username, pin };
}

function setAuthError(message) {
    if (authErrorEl) authErrorEl.textContent = message || '';
}

function setAuthBusy(isBusy) {
    isAuthBusy = isBusy;
    if (authLoginBtn) authLoginBtn.disabled = isBusy;
    if (authRegisterBtn) authRegisterBtn.disabled = isBusy;
    if (authUsernameInput) authUsernameInput.disabled = isBusy;
    if (authPinInput) authPinInput.disabled = isBusy;
}

function hideAuthModal() {
    if (authModalOverlay) authModalOverlay.style.display = 'none';
}

function showAuthModal() {
    if (authModalOverlay) authModalOverlay.style.display = 'flex';
}

function getLocalUsers() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_AUTH_USERS_KEY) || '{}');
    } catch (_) {
        return {};
    }
}

function saveLocalUsers(users) {
    localStorage.setItem(LOCAL_AUTH_USERS_KEY, JSON.stringify(users));
}

function setLocalSession(username) {
    localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify({
        username,
        loggedInAt: Date.now()
    }));
}

function getLocalSession() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_AUTH_SESSION_KEY) || 'null');
    } catch (_) {
        return null;
    }
}

function tryLocalRegister(username, pin) {
    const users = getLocalUsers();
    if (users[username]) {
        throw new Error('Bu kullanici adi zaten kayitli. Giris Yap ile devam et.');
    }
    users[username] = { pin };
    saveLocalUsers(users);
    setLocalSession(username);
}

function tryLocalLogin(username, pin) {
    const users = getLocalUsers();
    if (!users[username] || users[username].pin !== pin) {
        throw new Error('Kullanici adi veya PIN hatali.');
    }
    setLocalSession(username);
}

async function loginWithUsernamePin() {
    if (isAuthBusy) return;
    setAuthError('');
    setAuthBusy(true);
    try {
        const { username, displayUsername, pin } = validateAuthInputs(authUsernameInput?.value, authPinInput?.value);
        const syntheticEmail = buildSupabaseEmailFromUsername(username);
        if (window.db && window.db.loginUser) {
            try {
                await window.db.loginUser(syntheticEmail, pin);
            } catch (supabaseErr) {
                // Demo-safe fallback: local auth session if Supabase auth is unavailable.
                tryLocalLogin(username, pin);
            }
        } else {
            tryLocalLogin(username, pin);
        }
        localStorage.setItem('preferredUsername', displayUsername);
        updateGreeting(displayUsername);
        hideAuthModal();
        renderWeeklyStats();
    } catch (err) {
        setAuthError(err?.message || 'Giris basarisiz.');
    } finally {
        setAuthBusy(false);
    }
}

async function registerWithUsernamePin() {
    if (isAuthBusy) return;
    setAuthError('');
    setAuthBusy(true);
    try {
        const { username, displayUsername, pin } = validateAuthInputs(authUsernameInput?.value, authPinInput?.value);
        const syntheticEmail = buildSupabaseEmailFromUsername(username);
        if (window.db && window.db.registerUser && window.db.loginUser) {
            try {
                await window.db.registerUser(syntheticEmail, pin);
                // Always attempt sign-in after sign-up for consistent UX.
                await window.db.loginUser(syntheticEmail, pin);
            } catch (supabaseErr) {
                // Fallback for demo continuity (e.g. email confirm or auth policy issues).
                tryLocalRegister(username, pin);
            }
        } else {
            tryLocalRegister(username, pin);
        }

        localStorage.setItem('preferredUsername', displayUsername);
        updateGreeting(displayUsername);
        hideAuthModal();
        renderWeeklyStats();
    } catch (err) {
        const raw = err?.message || 'Kayit basarisiz.';
        if (/already registered|already been registered|user already registered/i.test(raw)) {
            setAuthError('Bu kullanici adi zaten kayitli. Giris Yap ile devam et.');
        } else if (/Password should be at least 6 characters/i.test(raw)) {
            setAuthError('PIN Supabase kurali nedeniyle 6 hane olmali.');
        } else {
            setAuthError(raw);
        }
    } finally {
        setAuthBusy(false);
    }
}

async function initAuthGate() {
    try {
        const localSession = getLocalSession();
        if (localSession?.username) {
            updateGreeting(localSession.username);
            hideAuthModal();
            return;
        }
        if (window.db && window.db.checkUser) {
            const sessionUser = await window.db.checkUser();
            if (sessionUser) {
                const guessedName = localStorage.getItem('preferredUsername') || String(sessionUser.email || '').split('@')[0];
                updateGreeting(guessedName);
                hideAuthModal();
                return;
            }
        }
        updateGreeting(localStorage.getItem('preferredUsername'));
        showAuthModal();
        if (authUsernameInput) {
            const saved = localStorage.getItem('preferredUsername');
            if (saved) authUsernameInput.value = saved;
        }
    } catch (err) {
        console.error('Auth init failed', err);
        showAuthModal();
        setAuthError('Baglanti hatasi. Tekrar dene.');
    }
}

async function hardResetUserDataIfRequested() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') !== '1') return false;

    try {
        if (window.db && window.db.checkUser && window.db.supabase) {
            const user = await window.db.checkUser();
            if (user) {
                const uid = user.id;
                await Promise.allSettled([
                    window.db.supabase.from('water_logs').delete().eq('user_id', uid),
                    window.db.supabase.from('mood_logs').delete().eq('user_id', uid),
                    window.db.supabase.from('app_data').delete().eq('user_id', uid)
                ]);
                await window.db.supabase.auth.signOut();
            }
        }
    } catch (err) {
        console.warn('Remote reset warning:', err);
    }

    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', window.location.pathname);
    window.location.reload();
    return true;
}

let draggedHour = null;

// Modal Elements
const eventModalOverlay = document.getElementById('event-modal-overlay');
const eventModalTitle = document.getElementById('event-modal-title');
const eventModalInput = document.getElementById('event-modal-input');
const eventModalDuration = document.getElementById('event-modal-duration');
const eventModalCancel = document.getElementById('event-modal-cancel');
const eventModalSave = document.getElementById('event-modal-save');

let pendingEventSave = null;

// Global Quick Add Modal Elements
const globalEventModalOverlay = document.getElementById('global-event-modal-overlay');
const globalEventName = document.getElementById('global-event-name');
const globalEventStart = document.getElementById('global-event-start');
const globalEventEnd = document.getElementById('global-event-end');
const globalEventCancel = document.getElementById('global-event-cancel');
const globalEventSave = document.getElementById('global-event-save');
const addBtn = document.getElementById('add-btn');

// Note Modal Elements
const noteModalOverlay = document.getElementById('note-modal-overlay');
const noteModalTitle = document.getElementById('note-modal-title');
const noteModalInput = document.getElementById('note-modal-input');
const noteModalCancel = document.getElementById('note-modal-cancel');
const noteModalSave = document.getElementById('note-modal-save');
const noteModalDelete = document.getElementById('note-modal-delete');
let pendingNoteSaveCallback = null;
let pendingNoteDeleteCallback = null;

if (noteModalCancel) {
    noteModalCancel.addEventListener('click', () => {
        noteModalOverlay.classList.add('hidden-view');
    });
}
if (noteModalSave) {
    noteModalSave.addEventListener('click', () => {
        if (pendingNoteSaveCallback) pendingNoteSaveCallback(noteModalInput.value);
        noteModalOverlay.classList.add('hidden-view');
    });
}
if (noteModalDelete) {
    noteModalDelete.addEventListener('click', () => {
        if (pendingNoteDeleteCallback) pendingNoteDeleteCallback();
        noteModalOverlay.classList.add('hidden-view');
    });
}

function openNoteModal(eventName, defaultNote, onSave, onDelete) {
    noteModalTitle.textContent = `${eventName} Notes`;
    noteModalInput.value = defaultNote || '';
    pendingNoteSaveCallback = onSave;
    pendingNoteDeleteCallback = onDelete;
    noteModalOverlay.classList.remove('hidden-view');
    noteModalInput.focus();
}

// Global Date State
const _initDate = new Date();
let selectedYearVal = _initDate.getFullYear();
let selectedMonthVal = _initDate.getMonth();
let selectedDayVal = _initDate.getDate();
let selectedDateKey = `${selectedYearVal}-${selectedMonthVal}-${selectedDayVal}`;

const eventModalDelete = document.getElementById('event-modal-delete');
let pendingEventDelete = null;

function openEventModal(title, defaultVal, defaultDur, onSave, onDelete) {
    eventModalTitle.textContent = title;
    eventModalInput.value = defaultVal;
    if(eventModalDuration) eventModalDuration.value = defaultDur || 1;
    eventModalOverlay.classList.remove('hidden-view');
    eventModalInput.focus();
    pendingEventSave = onSave;
}
function closeEventModal() {
    eventModalOverlay.classList.add('hidden-view');
    pendingEventSave = null;
    pendingEventDelete = null;
}
eventModalCancel.addEventListener('click', closeEventModal);
eventModalSave.addEventListener('click', () => {
    let durVal = eventModalDuration ? parseFloat(eventModalDuration.value) : 1;
    if (pendingEventSave) pendingEventSave(eventModalInput.value, durVal);
    closeEventModal();
});
if (eventModalDelete) {
    eventModalDelete.addEventListener('click', () => {
        if (pendingEventDelete) pendingEventDelete();
        closeEventModal();
    });
}
eventModalOverlay.addEventListener('click', (e) => {
    if (e.target === eventModalOverlay) closeEventModal();
});

// State
let waterState = {
    current: 0,
    goal: 2000
};

// View Toggling
function switchView(viewName) {
    // Hide all
    [viewToday, viewCalendar, viewTasks, viewStats].forEach(v => {
        v.classList.remove('active-view');
        v.classList.add('hidden-view');
    });
    // Remove active styles from pills
    [viewTodayBtn, viewCalendarBtn, viewTasksBtn, viewStatsBtn].forEach(b => b.classList.remove('active'));

    if (viewName === 'today') {
        viewTodayBtn.classList.add('active');
        viewToday.classList.add('active-view');
        viewToday.classList.remove('hidden-view');
        renderTodayEvents();
        if(addBtn) addBtn.style.display = 'flex';
    } else if (viewName === 'calendar') {
        viewCalendarBtn.classList.add('active');
        viewCalendar.classList.add('active-view');
        viewCalendar.classList.remove('hidden-view');
        if(addBtn) addBtn.style.display = 'flex';
    } else if (viewName === 'tasks') {
        viewTasksBtn.classList.add('active');
        viewTasks.classList.add('active-view');
        viewTasks.classList.remove('hidden-view');
        if(addBtn) addBtn.style.display = 'none';
    } else if (viewName === 'stats') {
        viewStatsBtn.classList.add('active');
        viewStats.classList.add('active-view');
        viewStats.classList.remove('hidden-view');
        if(addBtn) addBtn.style.display = 'none';
        renderWeeklyStats();
    }
}

viewTodayBtn.addEventListener('click', () => switchView('today'));
viewCalendarBtn.addEventListener('click', () => switchView('calendar'));
viewTasksBtn.addEventListener('click', () => switchView('tasks'));
viewStatsBtn.addEventListener('click', () => switchView('stats'));

function getISODateOnly(date) {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60000));
    return localDate.toISOString().split('T')[0];
}

function getLast7Dates() {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        days.push(getISODateOnly(d));
    }
    return days;
}

function numberOrZero(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function moodToScore(moodVal) {
    const moodMap = {
        happy: 5,
        proud: 4,
        nervous: 3,
        tired: 2,
        sad: 2,
        angry: 1
    };
    return moodMap[String(moodVal || '').toLowerCase()] || 0;
}

function pickDateValue(row) {
    return row.log_date || row.date || row.created_at || row.logged_at || row.inserted_at || row.timestamp || null;
}

function pickWaterValue(row) {
    return numberOrZero(
        row.amount_ml ?? row.water_ml ?? row.amount ?? row.value_ml ?? row.value ?? row.intake_ml
    );
}

function pickMoodValue(row) {
    if (row.mood_score !== undefined && row.mood_score !== null) return numberOrZero(row.mood_score);
    if (row.score !== undefined && row.score !== null) return numberOrZero(row.score);
    if (row.mood !== undefined && row.mood !== null) return moodToScore(row.mood);
    if (row.mood_label !== undefined && row.mood_label !== null) return moodToScore(row.mood_label);
    return 0;
}

function isStatsViewVisible() {
    return viewStats && viewStats.classList.contains('active-view');
}

function isoToLegacyDateKey(isoDate) {
    const [year, month, day] = String(isoDate).split('-').map(Number);
    return `${year}-${month - 1}-${day}`;
}

function renderStatsCharts(series) {
    if (!statsChartRootEl) return;
    if (window.StatsChart && typeof window.StatsChart.render === 'function') {
        window.StatsChart.render(statsChartRootEl, series);
    }
}

async function renderWeeklyStats() {
    if (statsStatusEl) statsStatusEl.textContent = 'Syncing weekly stats from Supabase...';

    try {
        const dates = getLast7Dates();
        const fromDate = dates[0];
        const dateSet = new Set(dates);
        const labels = dates.map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'short' }));

        const waterByDate = Object.fromEntries(dates.map(d => [d, 0]));
        const moodByDate = Object.fromEntries(dates.map(d => [d, { total: 0, count: 0 }]));

        // Pull Supabase logs when available, but do not block local live progress.
        let usedSupabase = false;
        if (window.db && window.db.checkUser && window.db.supabase) {
            const user = await window.db.checkUser();
            if (user) {
                const [waterRes, moodRes] = await Promise.all([
                    window.db.supabase.from('water_logs').select('*').gte('created_at', `${fromDate}T00:00:00Z`).order('created_at', { ascending: true }),
                    window.db.supabase.from('mood_logs').select('*').gte('created_at', `${fromDate}T00:00:00Z`).order('created_at', { ascending: true })
                ]);
                usedSupabase = true;

                const waterRows = waterRes.error ? [] : (waterRes.data || []);
                const moodRows = moodRes.error ? [] : (moodRes.data || []);
                if (waterRes.error || moodRes.error) {
                    console.warn('Stats fetch warning', waterRes.error || moodRes.error);
                }

                for (const row of waterRows) {
                    const rawDate = pickDateValue(row);
                    if (!rawDate) continue;
                    const day = String(rawDate).slice(0, 10);
                    if (!dateSet.has(day)) continue;
                    waterByDate[day] += pickWaterValue(row);
                }

                for (const row of moodRows) {
                    const rawDate = pickDateValue(row);
                    if (!rawDate) continue;
                    const day = String(rawDate).slice(0, 10);
                    if (!dateSet.has(day)) continue;
                    const score = pickMoodValue(row);
                    if (score <= 0) continue;
                    moodByDate[day].total += score;
                    moodByDate[day].count += 1;
                }
            }
        }

        // Live local overrides for "today": show exactly what user entered right now.
        const todayIso = dates[dates.length - 1];
        waterByDate[todayIso] = Math.max(0, numberOrZero(waterState?.current));

        const todayLegacyKey = isoToLegacyDateKey(todayIso);
        const localMood = moodDatabase ? moodDatabase[todayLegacyKey] : null;
        const localMoodScore = moodToScore(localMood);
        if (localMoodScore > 0) {
            moodByDate[todayIso] = { total: localMoodScore, count: 1 };
        }

        // Backfill from local mood history so single-entry usage still shows meaningful progress.
        if (moodDatabase) {
            for (const day of dates) {
                const legacyKey = isoToLegacyDateKey(day);
                if (moodByDate[day].count > 0) continue;
                const score = moodToScore(moodDatabase[legacyKey]);
                if (score > 0) moodByDate[day] = { total: score, count: 1 };
            }
        }

        const series = dates.map((day, idx) => ({
            day: labels[idx],
            water: Math.round(waterByDate[day]),
            mood: moodByDate[day].count ? Number((moodByDate[day].total / moodByDate[day].count).toFixed(2)) : 0
        }));

        const moodDays = series.filter(item => item.mood > 0);
        const moodAvg = moodDays.length
            ? (moodDays.reduce((acc, item) => acc + item.mood, 0) / moodDays.length).toFixed(1)
            : '0.0';
        const bestDayItem = [...series].sort((a, b) => (b.water + b.mood * 300) - (a.water + a.mood * 300))[0];
        const previousWeekAvg = Math.round(series.slice(0, 6).reduce((acc, item) => acc + item.water, 0) / 6) || 0;
        const currentWater = series[series.length - 1]?.water || 0;
        const changePct = previousWeekAvg > 0
            ? Math.round(((currentWater - previousWeekAvg) / previousWeekAvg) * 100)
            : (currentWater > 0 ? 100 : 0);

        if (statsMoodAvgEl) statsMoodAvgEl.textContent = `${moodAvg} / 5`;
        if (statsBestDayEl) statsBestDayEl.textContent = bestDayItem ? bestDayItem.day : '--';
        if (statsWaterCurrentEl) statsWaterCurrentEl.textContent = `${currentWater} ml`;
        if (statsWaterTargetEl) statsWaterTargetEl.textContent = `${waterState.goal} ml`;
        if (statsWaterChangeEl) {
            statsWaterChangeEl.textContent = `${changePct >= 0 ? '+' : ''}${changePct}%`;
            statsWaterChangeEl.style.color = changePct >= 0 ? '#2abf74' : '#d96b6b';
        }
        if (statsStatusEl) {
            statsStatusEl.textContent = usedSupabase
                ? 'Live today values + synced 7-day history are shown.'
                : 'Live today values are shown instantly. History will expand as you log more.';
        }

        renderStatsCharts(series);
    } catch (err) {
        console.error('Failed to render stats', err);
        if (statsStatusEl) {
            statsStatusEl.textContent = 'Could not load stats right now. Check table names/columns or your connection.';
        }
    }
}

// Date and Time Logic
function updateTimeAndDate() {
    const now = new Date();
    
    // Time formatted: 1:20 PM
    const timeStr = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    });
    localTimeEl.textContent = timeStr;

    // Day formatted: Tuesday
    const dayStr = now.toLocaleDateString('en-US', { weekday: 'long' });
    heroDayEl.textContent = dayStr;

    // Date formatted: 13.12 <br> DEC
    const monthStr = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const dayNum = now.getDate().toString().padStart(2, '0');
    const monthNum = (now.getMonth() + 1).toString().padStart(2, '0');

    heroDateEl.innerHTML = `${dayNum}.${monthNum}<br>${monthStr}`;
}

// Update time every minute
setInterval(updateTimeAndDate, 60000);
updateTimeAndDate();

// --- WEATHER LOGIC ---
const weatherIcon = document.getElementById('weather-icon');
const weatherTemp = document.getElementById('weather-temp');

async function fetchWeather() {
    if(!weatherIcon || !weatherTemp) return;
    try {
        // Istanbul coords: 41.0082, 28.9784
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=41.0082&longitude=28.9784&current=temperature_2m,weather_code');
        const data = await res.json();
        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;
        
        weatherTemp.textContent = `${temp}°C`;
        
        if (code === 0 || code === 1 || code === 2 || code === 3) {
            weatherIcon.className = 'ph ph-baseball-cap'; // Hat for sunny/cloudy
            weatherIcon.style.color = '#e6a822';
        } else if (code >= 51 && code <= 67 || code >= 80 && code <= 82 || code >= 95 && code <= 99) {
            weatherIcon.className = 'ph ph-umbrella'; // Umbrella for rain/storms
            weatherIcon.style.color = '#3498db';
        } else if (code >= 71 && code <= 77 || code >= 85 && code <= 86) {
            weatherIcon.className = 'ph ph-boot'; // Boots for snow
            weatherIcon.style.color = '#5c7a8b';
        } else {
            weatherIcon.className = 'ph ph-cloud';
            weatherIcon.style.color = '#9e9e9e';
        }
    } catch(e) {
        console.error("Weather fetch failed", e);
        weatherIcon.className = 'ph ph-cloud-slash';
        weatherTemp.textContent = 'Err';
    }
}
fetchWeather();
setInterval(fetchWeather, 3600000); // refresh every hour

// Water Tracking Logic
function updateWaterUI() {
    waterCurrentEl.textContent = waterState.current;
    if (window.WaterProgress && typeof window.WaterProgress.compute === 'function') {
        const progress = window.WaterProgress.compute(waterState.current, waterState.goal);
        waterBarEl.style.width = `${progress.percentage}%`;
        waterBarEl.style.backgroundColor = progress.toneColor;
    }
    
    // Save to localStorage
    localStorage.setItem('waterData', JSON.stringify({
        ...waterState,
        date: new Date().toLocaleDateString()
    }));
}

function loadWaterData() {
    const saved = localStorage.getItem('waterData');
    if (saved) {
        const data = JSON.parse(saved);
        // Reset if it's a new day
        if (data.date === new Date().toLocaleDateString()) {
            waterState.current = data.current;
        } else {
            waterState.current = 0;
        }
    }
    updateWaterUI();
}

waterAddBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const amount = parseInt(e.target.dataset.amount);
        waterState.current += amount;
        updateWaterUI();
        
        // Add subtle pop animation to the bar
        waterBarEl.style.transform = 'scaleY(1.5)';
        setTimeout(() => {
            waterBarEl.style.transform = 'scaleY(1)';
        }, 150);

        if (isStatsViewVisible()) {
            renderWeeklyStats();
        }
    });
});

// --- MOOD TRACKER LOGIC ---
const moodBtns = document.querySelectorAll('.mood-btn');
let moodDatabase = JSON.parse(localStorage.getItem('moodDatabase') || '{}');

function renderMood() {
    if (!moodBtns || moodBtns.length === 0) return;
    const todayKey = getTodayDateKey();
    const currentMood = moodDatabase[todayKey];
    
    moodBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mood === currentMood) {
            btn.classList.add('active');
        }
    });
}

moodBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const todayKey = getTodayDateKey();
        const selectedMood = e.currentTarget.dataset.mood;
        
        if (moodDatabase[todayKey] === selectedMood) {
            delete moodDatabase[todayKey]; // Toggle off
        } else {
            moodDatabase[todayKey] = selectedMood;
        }
        localStorage.setItem('moodDatabase', JSON.stringify(moodDatabase));
        renderMood();

        if (isStatsViewVisible()) {
            renderWeeklyStats();
        }
    });
});


// --- NEW TASK SYSTEM LOGIC ---
const taskInput = document.getElementById('new-task-input');
const addHabitBtn = document.getElementById('add-habit-btn');
const addTaskBtn = document.getElementById('add-task-btn');
const habitsList = document.getElementById('habits-list');
const todayTasksList = document.getElementById('today-tasks-list');

// Databases
let habitsDatabase = JSON.parse(localStorage.getItem('habitsDatabase') || '[]');
let tasksDatabase = JSON.parse(localStorage.getItem('tasksDatabase') || '{}');

function getTodayDateKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function saveHabits() {
    localStorage.setItem('habitsDatabase', JSON.stringify(habitsDatabase));
}
function saveTasks() {
    localStorage.setItem('tasksDatabase', JSON.stringify(tasksDatabase));
}

function renderTasks() {
    if (!habitsList || !todayTasksList) return;
    
    const todayKey = getTodayDateKey();
    
    // Render Habits
    habitsList.innerHTML = '';
    habitsDatabase.forEach((habit, index) => {
        const isCompletedToday = habit.completedDates && habit.completedDates[todayKey];
        
        const item = document.createElement('div');
        item.className = `todo-item ${isCompletedToday ? 'completed' : ''}`;
        
        const checkbox = document.createElement('div');
        checkbox.className = 'todo-checkbox';
        checkbox.innerHTML = '<i class="ph ph-check"></i>';
        checkbox.addEventListener('click', () => {
            if (!habit.completedDates) habit.completedDates = {};
            if (isCompletedToday) {
                delete habit.completedDates[todayKey];
            } else {
                habit.completedDates[todayKey] = true;
            }
            saveHabits();
            renderTasks();
        });
        
        const text = document.createElement('span');
        text.className = 'todo-item-text';
        text.textContent = habit.name;
        
        const deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = '<i class="ph ph-trash"></i>';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.opacity = '0.5';
        deleteBtn.addEventListener('click', () => {
            habitsDatabase.splice(index, 1);
            saveHabits();
            renderTasks();
        });
        
        item.appendChild(checkbox);
        item.appendChild(text);
        item.appendChild(deleteBtn);
        habitsList.appendChild(item);
    });
    
    if (habitsDatabase.length === 0) {
        habitsList.innerHTML = '<p style="font-size:0.9rem; color:var(--text-muted);">No habits added yet.</p>';
    }

    // Render Today's Tasks
    todayTasksList.innerHTML = '';
    const todayTasks = tasksDatabase[todayKey] || [];
    
    todayTasks.forEach((task, index) => {
        const item = document.createElement('div');
        item.className = `todo-item ${task.completed ? 'completed' : ''}`;
        
        const checkbox = document.createElement('div');
        checkbox.className = 'todo-checkbox';
        checkbox.innerHTML = '<i class="ph ph-check"></i>';
        checkbox.addEventListener('click', () => {
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
        });
        
        const text = document.createElement('span');
        text.className = 'todo-item-text';
        text.textContent = task.name;
        
        const deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = '<i class="ph ph-trash"></i>';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.opacity = '0.5';
        deleteBtn.addEventListener('click', () => {
            todayTasks.splice(index, 1);
            tasksDatabase[todayKey] = todayTasks;
            saveTasks();
            renderTasks();
        });
        
        item.appendChild(checkbox);
        item.appendChild(text);
        item.appendChild(deleteBtn);
        todayTasksList.appendChild(item);
    });
    
    if (todayTasks.length === 0) {
        todayTasksList.innerHTML = '<p style="font-size:0.9rem; color:var(--text-muted);">No specific tasks for today.</p>';
    }
}

if(addHabitBtn) {
    addHabitBtn.addEventListener('click', () => {
        const val = taskInput.value.trim();
        if(val) {
            habitsDatabase.push({ id: Date.now(), name: val, completedDates: {} });
            taskInput.value = '';
            saveHabits();
            renderTasks();
        }
    });
}
if(addTaskBtn) {
    addTaskBtn.addEventListener('click', () => {
        const val = taskInput.value.trim();
        if(val) {
            const todayKey = getTodayDateKey();
            if (!tasksDatabase[todayKey]) tasksDatabase[todayKey] = [];
            tasksDatabase[todayKey].push({ id: Date.now(), name: val, completed: false });
            taskInput.value = '';
            saveTasks();
            renderTasks();
        }
    });
}

// Ensure Legacy Migration
let legacyCustomTasks = JSON.parse(localStorage.getItem('customTasks') || '[]');
if (legacyCustomTasks.length > 0) {
    legacyCustomTasks.forEach(t => {
        habitsDatabase.push({ id: Date.now() + Math.random(), name: t.name, completedDates: {} });
    });
    localStorage.removeItem('customTasks');
    saveHabits();
}

// --- DYNAMIC TODAY EVENTS LOGIC ---
const todayDynamicEvents = document.getElementById('today-dynamic-events');

function formatTimeFromFloat(f) {
    let baseH = Math.floor(f);
    let isHalf = f % 1 !== 0;
    let ampm = baseH >= 12 ? 'PM' : 'AM';
    let displayH = baseH % 12 || 12;
    let minuteStr = isHalf ? ':30' : ':00';
    return `${displayH}${minuteStr} ${ampm}`;
}

function renderTodayEvents() {
    if (!todayDynamicEvents) return;
    todayDynamicEvents.innerHTML = '';
    
    const d = new Date();
    const todayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const dayEvents = calEventsDatabase[todayKey] || {};
    
    const eventsArr = [];
    for (const h in dayEvents) {
        eventsArr.push({
            startFloat: parseFloat(h),
            eventObj: dayEvents[h]
        });
    }
    eventsArr.sort((a, b) => a.startFloat - b.startFloat);
    
    if (eventsArr.length === 0) {
        todayDynamicEvents.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin-top:20px; font-weight:500;">No events scheduled for today. Take a break!</p>`;
        return;
    }
    
    const bgColors = ['orange-bg', 'teal-bg', 'purple-bg', 'pink-bg', 'cyan-bg', 'pink-alt-bg', 'green-alt-bg', 'blue-alt-bg'];
    
    eventsArr.forEach((ev, index) => {
        const startFloat = ev.startFloat;
        let eObj = ev.eventObj;
        
        let durMins = eObj.duration;
        if (typeof eObj === 'string') {
            eObj = { name: eObj, duration: 60 };
            durMins = 60;
        } else if (durMins <= 24) {
            durMins = durMins * 60;
        }
        
        const endFloat = startFloat + (durMins / 60);
        const startStr = formatTimeFromFloat(startFloat);
        const endStr = formatTimeFromFloat(endFloat);
        const colorClass = bgColors[index % bgColors.length];
        
        const card = document.createElement('div');
        card.className = `card task-card ${colorClass}`;
        card.style.cursor = 'pointer';
        
        let noteHtml = '';
        if (eObj.note) {
            noteHtml = `<p style="font-size:0.9rem; opacity:0.8; margin-top:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i class="ph ph-text-align-left"></i> ${eObj.note}</p>`;
        } else {
            noteHtml = `<p style="font-size:0.8rem; opacity:0.6; margin-top:10px;"><i class="ph ph-plus"></i> Tap to add notes</p>`;
        }
        
        card.innerHTML = `
            <div class="card-main">
                <h2>${eObj.name}</h2>
                ${noteHtml}
            </div>
            <div class="card-footer">
                <div class="time-chip">
                    <span class="t-val">${startStr}</span>
                    <span class="t-lbl">Start</span>
                </div>
                <div class="duration-chip">${durMins} Min</div>
                <div class="time-chip end-time">
                    <span class="t-val">${endStr}</span>
                    <span class="t-lbl">End</span>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            openNoteModal(eObj.name, eObj.note, 
            (newNote) => {
                eObj.note = newNote.trim();
                dayEvents[startFloat] = eObj;
                calEventsDatabase[todayKey] = dayEvents;
                saveCalEvents();
                renderTodayEvents();
            },
            () => {
                delete dayEvents[startFloat];
                calEventsDatabase[todayKey] = dayEvents;
                saveCalEvents();
                renderTodayEvents();
            });
        });
        
        todayDynamicEvents.appendChild(card);
    });
}


const calMonthGrid = document.getElementById('cal-month-grid');
const calDayView = document.getElementById('cal-day-view');
const calModeBtns = document.querySelectorAll('.mode-btn');

const selectedDayName = document.getElementById('selected-day-name');
const selectedDayNum = document.getElementById('selected-day-num');
const selectedDayTimeline = document.getElementById('selected-day-timeline');
const selectedDayCard = document.getElementById('selected-day-card');

const calPrevBtn = document.getElementById('cal-prev');
const calNextBtn = document.getElementById('cal-next');
const calMonthTitle = document.getElementById('cal-month-title');

let viewingDate = new Date();
let calEventsDatabase = JSON.parse(localStorage.getItem('calEventsDatabase') || '{}');

function saveCalEvents() {
    localStorage.setItem('calEventsDatabase', JSON.stringify(calEventsDatabase));
}

calPrevBtn.addEventListener('click', () => {
    const isWeekMode = document.querySelector('.mode-btn:nth-child(2)').classList.contains('active');
    const isDayMode = document.querySelector('.mode-btn:nth-child(3)').classList.contains('active');
    if (isWeekMode) {
        viewingDate.setDate(viewingDate.getDate() - 7);
        renderWeekView();
    } else if (isDayMode) {
        let d = new Date(selectedYearVal, selectedMonthVal, selectedDayVal);
        d.setDate(d.getDate() - 1);
        renderDayView(d.getFullYear(), d.getMonth(), d.getDate());
        viewingDate = new Date(d);
        renderCalendarMonth();
    } else {
        viewingDate.setMonth(viewingDate.getMonth() - 1);
        renderCalendarMonth();
    }
});
calNextBtn.addEventListener('click', () => {
    const isWeekMode = document.querySelector('.mode-btn:nth-child(2)').classList.contains('active');
    const isDayMode = document.querySelector('.mode-btn:nth-child(3)').classList.contains('active');
    if (isWeekMode) {
        viewingDate.setDate(viewingDate.getDate() + 7);
        renderWeekView();
    } else if (isDayMode) {
        let d = new Date(selectedYearVal, selectedMonthVal, selectedDayVal);
        d.setDate(d.getDate() + 1);
        renderDayView(d.getFullYear(), d.getMonth(), d.getDate());
        viewingDate = new Date(d);
        renderCalendarMonth();
    } else {
        viewingDate.setMonth(viewingDate.getMonth() + 1);
        renderCalendarMonth();
    }
});

const calWeekView = document.getElementById('cal-week-view');

function switchCalendarMode(mode) {
    calModeBtns.forEach(b => b.classList.remove('active'));
    
    if(calMonthGrid) calMonthGrid.style.display = 'none';
    if(calDayView) calDayView.style.display = 'none';
    if(calWeekView) calWeekView.style.display = 'none';
    
    if (mode === 'Month') {
        if(calMonthGrid) calMonthGrid.style.display = 'grid';
        calModeBtns[0].classList.add('active'); 
    } else if (mode === 'Week') {
        if(calWeekView) calWeekView.style.display = 'block';
        calModeBtns[1].classList.add('active');
        renderWeekView();
    } else if (mode === 'Day') {
        if(calDayView) calDayView.style.display = 'block';
        calModeBtns[2].classList.add('active');
    }
}

calModeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        switchCalendarMode(e.target.textContent);
    });
});

const calWeekTitle = document.getElementById('cal-week-title');
const calWeekContainer = document.getElementById('cal-week-container');

function renderWeekView() {
    if (!calWeekContainer) return;
    calWeekContainer.innerHTML = '';
    
    // viewingDate is our anchor
    const anchor = new Date(viewingDate);
    // Find Monday of this week
    const dayOfWeek = anchor.getDay(); // 0 is Sunday, 1 is Monday
    const diff = anchor.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(anchor.setDate(diff));
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    calWeekTitle.textContent = `Week of ${monthNames[monday.getMonth()]} ${monday.getDate()}, ${monday.getFullYear()}`;
    
    const bgClasses = ['orange-bg', 'teal-bg', 'purple-bg', 'cyan-bg', 'pink-bg', 'pink-alt-bg', 'green-alt-bg', 'blue-alt-bg'];
    let colorIndex = 0;
    
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(monday);
        currentDate.setDate(monday.getDate() + i);
        
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth();
        const d = currentDate.getDate();
        const dateKey = `${y}-${m}-${d}`;
        
        const dayEvents = calEventsDatabase[dateKey] || {};
        let eventCount = Object.keys(dayEvents).length;
        
        const daySection = document.createElement('div');
        daySection.style.backgroundColor = '#fff';
        daySection.style.borderRadius = 'var(--radius-card)';
        daySection.style.padding = '16px';
        daySection.style.boxShadow = '0 2px 10px rgba(0,0,0,0.03)';
        
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = eventCount > 0 ? '12px' : '0';
        
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        header.innerHTML = `
            <div style="display:flex; gap:10px; align-items: baseline;">
                <h3 style="font-size: 1.5rem; font-weight:500;">${d}</h3>
                <span style="color:var(--text-muted); font-size: 0.9rem;">${dayName}</span>
            </div>
        `;
        
        const openDayBtn = document.createElement('button');
        openDayBtn.innerHTML = '<i class="ph ph-arrow-right"></i>';
        openDayBtn.style.color = 'var(--text-muted)';
        openDayBtn.style.fontSize = '1.2rem';
        openDayBtn.addEventListener('click', () => {
            renderDayView(y, m, d);
            switchCalendarMode('Day');
        });
        header.appendChild(openDayBtn);
        
        daySection.appendChild(header);
        
        if (eventCount > 0) {
            const eventsArr = [];
            for (const h in dayEvents) {
                eventsArr.push({ startFloat: parseFloat(h), eventObj: dayEvents[h] });
            }
            eventsArr.sort((a, b) => a.startFloat - b.startFloat);
            
            eventsArr.forEach(ev => {
                const colorClass = bgClasses[colorIndex % bgClasses.length];
                colorIndex++;
                
                const startStr = formatTimeFromFloat(ev.startFloat);
                const evPill = document.createElement('div');
                evPill.className = `card task-card ${colorClass}`;
                evPill.style.padding = '12px 16px';
                evPill.style.marginTop = '8px';
                evPill.style.display = 'flex';
                evPill.style.justifyContent = 'space-between';
                evPill.style.alignItems = 'center';
                evPill.style.borderRadius = '12px';
                
                evPill.innerHTML = `
                    <span style="font-weight: 500; font-size: 0.95rem;">${ev.eventObj.name}</span>
                    <span style="font-size: 0.85rem; font-weight: 500;">${startStr}</span>
                `;
                daySection.appendChild(evPill);
            });
        }
        
        calWeekContainer.appendChild(daySection);
    }
}

function renderDayView(year, month, day) {
    const clickedDate = new Date(year, month, day);
    
    // Update date text
    selectedDayName.textContent = clickedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const monthStr = clickedDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    selectedDayNum.innerHTML = `${day.toString().padStart(2, '0')}<br>${monthStr}`;
    
    // Rotate background colors based on day number
    const bgClasses = ['purple-bg', 'pink-bg', 'teal-bg', 'orange-bg', 'cyan-bg', 'pink-alt-bg', 'green-alt-bg', 'blue-alt-bg'];
    selectedDayCard.className = `cal-day-card ${bgClasses[day % bgClasses.length]}`;

    // Store global date state for Quick Add
    selectedYearVal = year;
    selectedMonthVal = month;
    selectedDayVal = day;
    selectedDateKey = `${year}-${month}-${day}`;

    // Read Events from Local Database
    const dateKey = selectedDateKey;
    const dayEvents = calEventsDatabase[dateKey] || {};

    selectedDayTimeline.innerHTML = '';
    let scrollAnchor = null;
    let skipUntil = -1; // Track which hours to skip if covered by an event block

    // Render 48 Half-Hours (30-minute resolution)
    for (let h = 0; h < 24; h += 0.5) {
        const slot = document.createElement('div');
        
        let isHalf = h % 1 !== 0;
        let baseH = Math.floor(h);
        let ampm = baseH >= 12 ? 'pm' : 'am';
        let displayH = baseH % 12 || 12;
        let minuteStr = isHalf ? ':30' : ':00';

        // Add class 'half-hour' to style the 30min labels slightly smaller if needed
        const hourStr = `<span class="t-hour ${isHalf ? 't-half' : ''}">${displayH}${minuteStr} ${ampm}</span>`;
        let contentStr = '';
        
        // Handle Legacy Data (convert string "Event" to object {name:"Event", duration:60 mins})
        // NOTE: Legacy keys were integers (e.g., 9). They still map perfectly to baseH if it exists!
        let eventObj = dayEvents[h];
        if (typeof eventObj === 'string') {
            eventObj = { name: eventObj, duration: 60 };
        } else if (eventObj && eventObj.duration <= 24) {
            // Legacy conversion: hour units to minutes
            eventObj.duration = eventObj.duration * 60;
        }

        if (eventObj && h > skipUntil) {
            slot.className = `timeline-slot slot-active`;
            
            // Calculate height. dur is in minutes
            // 30 mins = 1 slot (56px total distance: 40px slot + 16px gap)
            const dur = eventObj.duration;
            const slotsCovered = dur / 30;
            const pxHeight = Math.max(24, (slotsCovered * 56) - 16);
            
            contentStr = `<div class="event-pill dark-pill" style="height: ${pxHeight}px;" draggable="true">${eventObj.name}</div>`;
            
            // Block subsequent slots covered by this event
            skipUntil = h + (dur / 60) - 0.0001;

        } else if (h <= skipUntil) {
            // Covered by previous multi-hour event block
            slot.className = `timeline-slot`;
            contentStr = ``; // No add button
        } else {
            // Empty slot available
            slot.className = `timeline-slot`;
            contentStr = `<div class="event-add"><i class="ph ph-plus-circle"></i></div>`;
        }
        
        slot.innerHTML = hourStr + contentStr;
        
        // DRAG AND DROP ZONE LOGIC
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            slot.classList.add('drag-over');
        });
        slot.addEventListener('dragleave', () => {
            slot.classList.remove('drag-over');
        });
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            if (draggedHour !== null && draggedHour !== h) {
                // Swap events
                const temp = dayEvents[h];
                dayEvents[h] = dayEvents[draggedHour];
                if (temp) {
                    dayEvents[draggedHour] = temp;
                } else {
                    delete dayEvents[draggedHour];
                }
                calEventsDatabase[dateKey] = dayEvents;
                saveCalEvents();
                renderDayView(year, month, day);
            }
            draggedHour = null;
        });

        // PILL & CLICK LOGIC
        const pillEl = slot.querySelector('.event-pill');
        if (pillEl) {
            pillEl.addEventListener('dragstart', (e) => {
                draggedHour = h;
                e.dataTransfer.effectAllowed = 'move';
            });
            pillEl.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent triggering slot click
                openEventModal(`Edit ${displayH}${minuteStr} ${ampm}`, eventObj.name, eventObj.duration, 
                (val, durVal) => {
                    const eventName = val.trim();
                    if (eventName === '') {
                        delete dayEvents[h]; 
                    } else {
                        dayEvents[h] = { name: eventName, duration: durVal };
                    }
                    calEventsDatabase[dateKey] = dayEvents;
                    saveCalEvents();
                    renderDayView(year, month, day);
                },
                () => {
                    delete dayEvents[h];
                    calEventsDatabase[dateKey] = dayEvents;
                    saveCalEvents();
                    renderDayView(year, month, day);
                });
            });
        } else if (h > skipUntil) {
            slot.addEventListener('click', () => {
                openEventModal(`Enter event for ${displayH}${minuteStr} ${ampm}:`, '', 30, (val, durVal) => {
                    const eventName = val.trim();
                    if (eventName !== '') {
                        dayEvents[h] = { name: eventName, duration: durVal };
                        calEventsDatabase[dateKey] = dayEvents;
                        saveCalEvents();
                        renderDayView(year, month, day);
                    }
                });
            });
        }
        if (h === 6) scrollAnchor = slot;

        selectedDayTimeline.appendChild(slot);
    }
    
    // Auto-scroll to 6 AM (sabah 6)
    if (scrollAnchor) {
        setTimeout(() => {
            selectedDayTimeline.scrollTop = scrollAnchor.offsetTop - selectedDayTimeline.offsetTop - 10;
        }, 10);
    }
}

function renderCalendarMonth() {
    const year = viewingDate.getFullYear();
    const month = viewingDate.getMonth(); // 0-indexed
    
    // Update header string
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    if (calMonthTitle) calMonthTitle.textContent = `${monthNames[month]} ${year}`;

    // Calculate start day and total days
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Clear old cells but keep header labels
    const labelsStr = `
        <div class="day-label">S</div><div class="day-label">M</div><div class="day-label">T</div>
        <div class="day-label">W</div><div class="day-label">T</div><div class="day-label">F</div><div class="day-label">S</div>
    `;
    if (calMonthGrid) calMonthGrid.innerHTML = labelsStr;
    
    // Insert empty padding for the first week
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cal-cell empty';
        calMonthGrid.appendChild(emptyCell);
    }
    
    // Insert days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        
        // Add click listener to open Day View!
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => {
            renderDayView(year, month, i);
            switchCalendarMode('Day');
        });

        // Highlight actual real-world today
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            cell.classList.add('active-day');
        }
        cell.textContent = i;
        
        // Show dot if events exist on this date
        const loopDateKey = `${year}-${month}-${i}`;
        const dayEvents = calEventsDatabase[loopDateKey];
        if (dayEvents && Object.keys(dayEvents).length > 0) {
            const dot = document.createElement('div');
            dot.className = 'indicator-dot';
            cell.appendChild(dot);
        }
        
        calMonthGrid.appendChild(cell);
    }
}

// Initialize
(async () => {
    const didReset = await hardResetUserDataIfRequested();
    if (didReset) return;

    updateGreeting(localStorage.getItem('preferredUsername'));
    loadWaterData();
    renderTasks();
    renderTodayEvents();
    renderCalendarMonth();
    renderMood();
    initAuthGate();
})();

// Quick Add Global Listeners
if (addBtn) {
    addBtn.addEventListener('click', () => {
        if (!selectedDateKey) {
            const d = new Date();
            selectedYearVal = d.getFullYear();
            selectedMonthVal = d.getMonth();
            selectedDayVal = d.getDate();
            selectedDateKey = `${selectedYearVal}-${selectedMonthVal}-${selectedDayVal}`;
        }
        globalEventName.value = '';
        globalEventStart.value = '09:00';
        globalEventEnd.value = '10:00';
        globalEventModalOverlay.classList.remove('hidden-view');
        globalEventName.focus();
    });
}

globalEventCancel.addEventListener('click', () => {
    globalEventModalOverlay.classList.add('hidden-view');
});

globalEventSave.addEventListener('click', () => {
    const name = globalEventName.value.trim();
    if (!name) {
        globalEventModalOverlay.classList.add('hidden-view');
        return;
    }
    
    function parseTime(t) {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return h + (m / 60);
    }
    
    let startFloat = parseTime(globalEventStart.value);
    let endFloat = parseTime(globalEventEnd.value);
    if (endFloat <= startFloat) endFloat = startFloat + 0.5;
    
    // Snap start time to 30-min grid
    startFloat = Math.round(startFloat * 2) / 2;
    const durationMins = Math.round((endFloat - startFloat) * 60);
    
    const dayEvents = calEventsDatabase[selectedDateKey] || {};
    dayEvents[startFloat] = { name: name, duration: durationMins };
    calEventsDatabase[selectedDateKey] = dayEvents;
    saveCalEvents();
    
    globalEventModalOverlay.classList.add('hidden-view');
    switchCalendarMode('Day');
    renderDayView(selectedYearVal, selectedMonthVal, selectedDayVal);
});

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered!'))
            .catch(err => console.log('SW setup failed', err));
    });
}

if (authLoginBtn) {
    authLoginBtn.addEventListener('click', loginWithUsernamePin);
}

if (authRegisterBtn) {
    authRegisterBtn.addEventListener('click', registerWithUsernamePin);
}

if (authPinInput) {
    authPinInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            loginWithUsernamePin();
        }
    });
}
