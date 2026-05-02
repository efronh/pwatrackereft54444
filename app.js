// DOM Elements
const viewTodayBtn = document.getElementById('view-today-btn');
const viewCalendarBtn = document.getElementById('view-calendar-btn');
const viewTasksBtn = document.getElementById('view-tasks-btn');
const viewStatsBtn = document.getElementById('view-stats-btn');
const viewJournalBtn = document.getElementById('view-journal-btn');
const viewToday = document.getElementById('view-today');
const viewCalendar = document.getElementById('view-calendar');
const viewTasks = document.getElementById('view-tasks');
const viewStats = document.getElementById('view-stats');
const viewJournal = document.getElementById('view-journal');

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






function hideAuthModal() {
    if (authModalOverlay) {
        authModalOverlay.classList.add('hidden-view');
        authModalOverlay.style.display = 'none';
    }
}

function showAuthModal() {
    if (authModalOverlay) {
        authModalOverlay.classList.remove('hidden-view');
        authModalOverlay.style.display = 'flex';
    }
}









let syncTimeout = null;





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


// Global Date State
const _initDate = new Date();
let selectedYearVal = _initDate.getFullYear();
let selectedMonthVal = _initDate.getMonth();
let selectedDayVal = _initDate.getDate();
let selectedDateKey = `${selectedYearVal}-${selectedMonthVal}-${selectedDayVal}`;

const eventModalDelete = document.getElementById('event-modal-delete');
let pendingEventDelete = null;

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
let waterHistory = {};

let coffeeCurrent = 0;
let coffeeHistory = {};

// View Toggling
function switchView(viewName) {
    // Hide all
    [viewToday, viewCalendar, viewTasks, viewStats, viewJournal].forEach(v => {
        if (!v) return;
        v.classList.remove('active-view');
        v.classList.add('hidden-view');
    });
    // Remove active styles from pills
    [viewTodayBtn, viewCalendarBtn, viewTasksBtn, viewStatsBtn, viewJournalBtn].forEach(b => {
        if (b) b.classList.remove('active');
    });

    if (viewName === 'today') {
        viewTodayBtn.classList.add('active');
        viewToday.classList.add('active-view');
        viewToday.classList.remove('hidden-view');
        renderTodayEvents();
        if (typeof journalOnSwitchToTodayView === 'function') journalOnSwitchToTodayView();
        if(addBtn) addBtn.style.display = 'flex';
    } else if (viewName === 'calendar') {
        viewCalendarBtn.classList.add('active');
        viewCalendar.classList.add('active-view');
        viewCalendar.classList.remove('hidden-view');
        if (typeof renderCalendarMonth === 'function') renderCalendarMonth();
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
    } else if (viewName === 'journal' && viewJournal) {
        if (viewJournalBtn) viewJournalBtn.classList.add('active');
        viewJournal.classList.add('active-view');
        viewJournal.classList.remove('hidden-view');
        if(addBtn) addBtn.style.display = 'none';
        if (typeof journalOnOpenTab === 'function') journalOnOpenTab();
    }
}

viewTodayBtn.addEventListener('click', () => switchView('today'));
viewCalendarBtn.addEventListener('click', () => switchView('calendar'));
viewTasksBtn.addEventListener('click', () => switchView('tasks'));
viewStatsBtn.addEventListener('click', () => switchView('stats'));
if (viewJournalBtn) viewJournalBtn.addEventListener('click', () => switchView('journal'));

function getISODateOnly(date) {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60000));
    return localDate.toISOString().split('T')[0];
}







function isStatsViewVisible() {
    return viewStats && viewStats.classList.contains('active-view');
}


function renderStatsCharts(series) {
    if (!statsChartRootEl) return;
    if (window.StatsChart && typeof window.StatsChart.render === 'function') {
        window.StatsChart.render(statsChartRootEl, series);
    }
}

async function renderWeeklyStats() {
    if (statsStatusEl) statsStatusEl.textContent = 'Generating weekly stats...';

    try {
        const dates = getLast7Dates();
        const fromDate = dates[0];
        const dateSet = new Set(dates);
        const labels = dates.map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'short' }));

        const waterByDate = Object.fromEntries(dates.map(d => [d, 0]));
        const coffeeByDate = Object.fromEntries(dates.map(d => [d, 0]));
        const moodByDate = Object.fromEntries(dates.map(d => [d, { total: 0, count: 0 }]));

        // Read directly from synchronized local stores (waterHistory and moodDatabase)
        for (const day of dates) {
            const legacyKey = isoToLegacyDateKey(day);
            
            // Water History processing
            if (waterHistory && waterHistory[legacyKey] !== undefined) {
                waterByDate[day] = Number(waterHistory[legacyKey]) || 0;
            } else if (waterHistory && waterHistory[day] !== undefined) {
                 waterByDate[day] = Number(waterHistory[day]) || 0;
            }

            // Coffee History processing
            if (coffeeHistory && coffeeHistory[legacyKey] !== undefined) {
                coffeeByDate[day] = Number(coffeeHistory[legacyKey]) || 0;
            } else if (coffeeHistory && coffeeHistory[day] !== undefined) {
                 coffeeByDate[day] = Number(coffeeHistory[day]) || 0;
            }

            // Mood Database processing
            if (moodDatabase) {
                const score = moodToScore(moodDatabase[legacyKey] || moodDatabase[day]);
                if (score > 0) moodByDate[day] = { total: score, count: 1 };
            }
        }

        // Live local overrides for "today"
        const todayIso = dates[dates.length - 1];
        waterByDate[todayIso] = Math.max(waterByDate[todayIso], numberOrZero(waterState?.current));
        coffeeByDate[todayIso] = Math.max(coffeeByDate[todayIso], numberOrZero(coffeeCurrent));

        const series = dates.map((day, idx) => ({
            day: labels[idx],
            water: Math.round(waterByDate[day]),
            coffee: Math.round(coffeeByDate[day]),
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
            statsStatusEl.textContent = 'Weekly history loaded correctly.';
        }

        renderStatsCharts(series);
    } catch (err) {
        console.error('Failed to render stats', err);
        if (statsStatusEl) {
            statsStatusEl.textContent = 'Could not load stats right now.';
        }
    }
}

// Date and Time Logic

// Update time every minute
setInterval(updateTimeAndDate, 60000);
updateTimeAndDate();

// Weather: weather.js (fetch + city modal + hourly refresh)

// Water Tracking Logic


waterAddBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const amount = parseInt(e.currentTarget.dataset.amount, 10);
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


const coffeeBtns = document.querySelectorAll('.coffee-add-btn');
coffeeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const amount = parseInt(e.currentTarget.dataset.amount);
        coffeeCurrent += amount;
        updateCoffeeUI();
        if (isStatsViewVisible()) {
            renderWeeklyStats();
        }
    });
});

// --- MOOD TRACKER LOGIC ---
const moodBtns = document.querySelectorAll('.mood-btn');
let moodDatabase = {};


moodBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const todayKey = getTodayDateKey();
        const selectedMood = e.currentTarget.dataset.mood;
        
        if (moodDatabase[todayKey] === selectedMood) {
            delete moodDatabase[todayKey]; // Toggle off
        } else {
            moodDatabase[todayKey] = selectedMood;
        }
        persistMirror('moodDatabase', moodDatabase);
        renderMood();
        syncToCloud();

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
let habitsDatabase = [];
let tasksDatabase = {};


function saveHabits() {
    persistMirror('habitsDatabase', habitsDatabase);
    syncToCloud();
}
function saveTasks() {
    persistMirror('tasksDatabase', tasksDatabase);
    syncToCloud();
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
const durationToggleToday = document.getElementById('duration-toggle-today');
const durationToggleForever = document.getElementById('duration-toggle-forever');
let selectedDuration = '24h';

if (durationToggleToday && durationToggleForever) {
    function setDurationStyle(type) {
        selectedDuration = type;
        if (type === '24h') {
            durationToggleToday.classList.add('active');
            durationToggleForever.classList.remove('active');
        } else {
            durationToggleForever.classList.add('active');
            durationToggleToday.classList.remove('active');
        }
    }

    durationToggleToday.addEventListener('click', () => setDurationStyle('24h'));
    durationToggleForever.addEventListener('click', () => setDurationStyle('forever'));
    setDurationStyle('24h');
}

if(addTaskBtn) {
    addTaskBtn.addEventListener('click', () => {
        const val = taskInput.value.trim();
        if(val) {
            const todayKey = getTodayDateKey();
            if (!tasksDatabase[todayKey]) tasksDatabase[todayKey] = [];
            tasksDatabase[todayKey].push({ id: Date.now(), name: val, completed: false, type: selectedDuration });
            taskInput.value = '';
            saveTasks();
            renderTasks();
        }
    });
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
let calEventsDatabase = {};

function readLocalMirror(key) {
    return typeof readParsedMirror === 'function' ? readParsedMirror(key) : null;
}

function hydrateFromLocalMirrors() {
    const wh = readLocalMirror('waterHistory');
    if (wh) waterHistory = wh;
    const ch = readLocalMirror('coffeeHistory');
    if (ch) coffeeHistory = ch;
    const md = readLocalMirror('moodDatabase');
    if (md) moodDatabase = md;
    const hb = readLocalMirror('habitsDatabase');
    if (hb) habitsDatabase = hb;
    const td = readLocalMirror('tasksDatabase');
    if (td) {
        tasksDatabase =
            typeof mergeTasksByDate === 'function' ? mergeTasksByDate(td, {}) : td;
    }
    const ce = readLocalMirror('calEventsDatabase');
    if (ce) calEventsDatabase = ce;
    const jd = readLocalMirror('journalDatabase');
    if (jd && typeof journalApplyCloudData === 'function') journalApplyCloudData(jd);
    const wp = readLocalMirror('weatherPrefs');
    if (wp && typeof wp.lat === 'number' && typeof wp.lng === 'number') {
        window.trackerWeatherPrefs = wp;
    }
}

function snapshotTrackerMirrors() {
    persistMirror('waterHistory', waterHistory);
    persistMirror('coffeeHistory', coffeeHistory);
    persistMirror('moodDatabase', moodDatabase);
    persistMirror('habitsDatabase', habitsDatabase);
    persistMirror('tasksDatabase', tasksDatabase);
    persistMirror('calEventsDatabase', calEventsDatabase);
    persistMirror('waterData', {
        ...waterState,
        date: new Date().toLocaleDateString()
    });
    if (typeof journalExportForSync === 'function') {
        persistMirror('journalDatabase', journalExportForSync());
    }
    if (window.trackerWeatherPrefs && typeof persistMirror === 'function') {
        persistMirror('weatherPrefs', window.trackerWeatherPrefs);
    }
}

window.snapshotTrackerMirrors = snapshotTrackerMirrors;
window.hydrateFromLocalMirrors = hydrateFromLocalMirrors;

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



// Initialize
(async () => {
    const didReset = await hardResetUserDataIfRequested();
    if (didReset) return;

    let mirrorUid = null;
    if (window.db && window.db.checkUser) {
        try {
            const u = await window.db.checkUser();
            mirrorUid = u?.id || null;
        } catch (e) {
            console.warn('Mirror user resolve failed', e);
        }
    }
    window.__trackerMirrorUserId = mirrorUid;
    if (mirrorUid) {
        if (typeof mergePendingMirrorsIntoUser === 'function') {
            mergePendingMirrorsIntoUser(mirrorUid);
        }
        if (typeof migrateLegacyMirrorsToUser === 'function') {
            migrateLegacyMirrorsToUser(mirrorUid);
        }
    }

    hydrateFromLocalMirrors();

    try {
        const legacyRaw = localStorage.getItem('customTasks');
        if (legacyRaw) {
            const legacyList = JSON.parse(legacyRaw);
            if (Array.isArray(legacyList) && legacyList.length > 0) {
                legacyList.forEach((t) => {
                    habitsDatabase.push({
                        id: Date.now() + Math.random(),
                        name: t.name,
                        completedDates: {}
                    });
                });
                localStorage.removeItem('customTasks');
                saveHabits();
            }
        }
    } catch (_) {
        /* ignore */
    }

    updateGreeting(
        typeof window.getPreferredDisplayName === 'function'
            ? window.getPreferredDisplayName()
            : localStorage.getItem('preferredUsername')
    );
    await initAuthGate();
    loadWaterData();
    renderTasks();
    renderTodayEvents();
    renderCalendarMonth();
    renderMood();
    if (typeof initJournalUI === 'function') initJournalUI();

    snapshotTrackerMirrors();

    try {
        if (typeof syncToCloudNow === 'function') await syncToCloudNow();
    } catch (_) {
        /* ignore */
    }

    window.addEventListener('offline', () => snapshotTrackerMirrors());
    window.addEventListener('online', async () => {
        try {
            await syncToCloudNow();
            await restoreFromCloud();
        } catch (e) {
            console.warn('Reconnect sync failed', e);
        }
    });
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
