function mergeHabitsLists(localArr, cloudArr) {
    const byName = new Map();
    for (const h of localArr || []) {
        if (!h || !h.name) continue;
        byName.set(h.name, {
            ...h,
            completedDates: { ...(h.completedDates || {}) }
        });
    }
    for (const h of cloudArr || []) {
        if (!h || !h.name) continue;
        const ex = byName.get(h.name);
        if (!ex) {
            byName.set(h.name, {
                id: h.id || Date.now() + Math.random(),
                name: h.name,
                completedDates: { ...(h.completedDates || {}) }
            });
        } else {
            ex.completedDates = { ...(ex.completedDates || {}), ...(h.completedDates || {}) };
        }
    }
    return Array.from(byName.values());
}

/** Günlük su (ml) ve kahve (bardak) = birikimli toplam; bulut gecikmişse yereldeki yüksek değer korunur. */
function mergeDayTotals(localMap, cloudMap) {
    const keys = new Set([
        ...Object.keys(localMap || {}),
        ...Object.keys(cloudMap || {})
    ]);
    const out = {};
    for (const k of keys) {
        const l = Number(localMap[k]);
        const c = Number(cloudMap[k]);
        const ln = Number.isFinite(l) ? l : 0;
        const cn = Number.isFinite(c) ? c : 0;
        out[k] = Math.max(ln, cn);
    }
    return out;
}

/** Aynı görev yerelde (Date.now id) ve bulutta (satır id) farklı id ile gelir; id ile tekilleştirme çoğaltır. */
function taskSemanticKey(t) {
    const name = String(t.name || t.title || '').trim().toLowerCase();
    const typ = String(t.type || '24h');
    const done = t.completed ? 1 : 0;
    return `${name}\u0000${typ}\u0000${done}`;
}

function mergeTasksByDate(localObj, cloudObj) {
    const dates = new Set([...Object.keys(localObj || {}), ...Object.keys(cloudObj || {})]);
    const out = {};
    for (const date of dates) {
        const L = localObj[date] || [];
        const C = cloudObj[date] || [];
        const map = new Map();
        // Önce yerel, sonra bulut — aynı anahtarda son yazılan id alır (bulut id korunur)
        for (const t of [...L, ...C]) {
            if (!t) continue;
            const k = taskSemanticKey(t);
            const prev = map.get(k);
            map.set(k, prev ? { ...prev, ...t } : { ...t });
        }
        out[date] = Array.from(map.values());
    }
    return out;
}

function buildSyncPayload() {
    const prefs =
        window.trackerWeatherPrefs &&
        typeof window.trackerWeatherPrefs.lat === 'number' &&
        typeof window.trackerWeatherPrefs.lng === 'number'
            ? {
                  weather_lat: window.trackerWeatherPrefs.lat,
                  weather_lng: window.trackerWeatherPrefs.lng,
                  weather_city: window.trackerWeatherPrefs.city || null
              }
            : null;

    return {
        water_data: typeof waterHistory !== 'undefined' ? waterHistory : {},
        coffee_data: typeof coffeeHistory !== 'undefined' ? coffeeHistory : {},
        mood_data: typeof moodDatabase !== 'undefined' ? moodDatabase : {},
        habits_data: typeof habitsDatabase !== 'undefined' ? habitsDatabase : [],
        tasks_data:
            typeof tasksDatabase !== 'undefined' ? mergeTasksByDate(tasksDatabase, {}) : {},
        calendar_data: typeof calEventsDatabase !== 'undefined' ? calEventsDatabase : {},
        journal_data:
            typeof journalExportForSync === 'function' ? journalExportForSync() : {},
        prefs
    };
}

async function syncToCloudNow() {
    if (!window.db || !window.db.syncData) return;
    const session = getLocalSession();
    if (!session?.username) return;

    try {
        const user = await window.db.checkUser();
        if (!user) return;

        if (syncTimeout) {
            clearTimeout(syncTimeout);
            syncTimeout = null;
        }

        const payload = buildSyncPayload();
        await window.db.syncData(user.id, payload);
        console.log('Synced to cloud (immediate).');
    } catch (err) {
        console.warn('Immediate sync failed:', err);
    }
}

async function syncToCloud() {
    if (!window.db || !window.db.syncData) return;
    const session = getLocalSession();
    if (!session?.username) return;

    try {
        const user = await window.db.checkUser();
        if (!user) return;

        const payload = buildSyncPayload();

        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(async () => {
            try {
                await window.db.syncData(user.id, payload);
                console.log('Successfully synced data to cloud.');
            } catch (err) {
                console.warn('Failed to sync to cloud:', err);
            }
        }, 1500);
    } catch (err) {
        console.warn('Could not check user for sync:', err);
    }
}

async function restoreFromCloud() {
    if (!window.db || !window.db.fetchData) return;
    try {
        const user = await window.db.checkUser();
        if (!user) return;
        const cloudData = await window.db.fetchData(user.id);
        if (!cloudData) return;

        const todayKey = getTodayDateKey();

        // Su/kahve: gün bazında daha yüksek olanı al (bulut gecikmiş olabilir; spread ile bulut eskiyi ezmesin).
        if (cloudData.water_data && Object.keys(cloudData.water_data).length > 0) {
            waterHistory = mergeDayTotals(waterHistory, cloudData.water_data);
            if (waterHistory[todayKey] !== undefined && waterHistory[todayKey] !== null) {
                waterState.current = Number(waterHistory[todayKey]) || 0;
            } else {
                waterState.current = 0;
            }
            if (typeof updateWaterUI === 'function') updateWaterUI();
        }
        if (cloudData.coffee_data && Object.keys(cloudData.coffee_data).length > 0) {
            coffeeHistory = mergeDayTotals(coffeeHistory, cloudData.coffee_data);
            if (coffeeHistory[todayKey] !== undefined && coffeeHistory[todayKey] !== null) {
                coffeeCurrent = Number(coffeeHistory[todayKey]) || 0;
            } else {
                coffeeCurrent = 0;
            }
            if (typeof updateCoffeeUI === 'function') updateCoffeeUI();
        }
        if (cloudData.mood_data && Object.keys(cloudData.mood_data).length > 0) {
            moodDatabase = { ...moodDatabase, ...cloudData.mood_data };
            if (typeof renderMood === 'function') renderMood();
        }
        if (cloudData.habits_data && Array.isArray(cloudData.habits_data) && cloudData.habits_data.length > 0) {
            habitsDatabase = mergeHabitsLists(habitsDatabase, cloudData.habits_data);
        }
        if (cloudData.tasks_data && Object.keys(cloudData.tasks_data).length > 0) {
            tasksDatabase = mergeTasksByDate(tasksDatabase, cloudData.tasks_data);
        }
        if (cloudData.calendar_data && Object.keys(cloudData.calendar_data).length > 0) {
            if (typeof calEventsDatabase !== 'undefined') {
                calEventsDatabase = { ...calEventsDatabase, ...cloudData.calendar_data };
            }
        }

        if (cloudData.journal_data && Object.keys(cloudData.journal_data).length > 0) {
            if (typeof journalApplyCloudData === 'function' && typeof journalExportForSync === 'function') {
                const localJournal = journalExportForSync();
                journalApplyCloudData({ ...cloudData.journal_data, ...localJournal });
            }
        }

        if (cloudData.prefs && typeof cloudData.prefs === 'object') {
            window.trackerWeatherPrefs = {
                lat: cloudData.prefs.weather_lat,
                lng: cloudData.prefs.weather_lng,
                city: cloudData.prefs.weather_city || ''
            };
            if (typeof fetchWeather === 'function') fetchWeather();
        }

        if (typeof renderTasks === 'function') renderTasks();
        if (typeof renderCalendarMonth === 'function') renderCalendarMonth();
        if (typeof renderTodayEvents === 'function') renderTodayEvents();
        if (typeof journalRenderMiniCalendar === 'function') journalRenderMiniCalendar();
        if (typeof journalOnSwitchToTodayView === 'function') journalOnSwitchToTodayView();
        if (typeof renderWeeklyStats === 'function' && isStatsViewVisible()) renderWeeklyStats();

        console.log('Successfully restored data from cloud.');
    } catch (err) {
        console.warn('Failed to restore from cloud:', err);
    }
}
