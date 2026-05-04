function habitTombstoneStorageKey() {
    const uid = typeof window !== 'undefined' ? window.__trackerMirrorUserId : null;
    return uid ? `habitTombstones__u_${uid}` : 'habitTombstones__pending';
}

function readHabitTombstones() {
    try {
        const raw = localStorage.getItem(habitTombstoneStorageKey());
        const arr = raw ? JSON.parse(raw) : [];
        return new Set((Array.isArray(arr) ? arr : []).map((s) => String(s || '').trim().toLowerCase()));
    } catch {
        return new Set();
    }
}

/** Silinen aliskanlik adi; bulut henuz guncellenmemisse restore ile geri gelmesin. */
function addHabitTombstone(name) {
    const k = String(name || '').trim().toLowerCase();
    if (!k) return;
    const set = readHabitTombstones();
    set.add(k);
    try {
        localStorage.setItem(habitTombstoneStorageKey(), JSON.stringify([...set].slice(-150)));
    } catch (_) {
        /* ignore */
    }
}

function removeHabitTombstone(name) {
    const k = String(name || '').trim().toLowerCase();
    if (!k) return;
    const set = readHabitTombstones();
    if (!set.delete(k)) return;
    try {
        localStorage.setItem(habitTombstoneStorageKey(), JSON.stringify([...set]));
    } catch (_) {
        /* ignore */
    }
}

window.addHabitTombstone = addHabitTombstone;
window.removeHabitTombstone = removeHabitTombstone;

function mergeHabitsLists(localArr, cloudArr) {
    const tomb = readHabitTombstones();
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
        const nk = String(h.name).trim().toLowerCase();
        if (!ex) {
            if (tomb.has(nk)) continue;
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

function normalizeCalendarDayForMerge(dayValue) {
    if (dayValue == null) return {};
    if (Array.isArray(dayValue)) {
        const o = {};
        dayValue.forEach((ev, i) => {
            if (!ev) return;
            const slot =
                ev.start_hour != null && Number.isFinite(Number(ev.start_hour))
                    ? Number(ev.start_hour)
                    : 9 + i * 0.5;
            o[String(slot)] = {
                name: String(ev.name || ev.title || '').trim(),
                duration: ev.duration,
                note: ev.note || ''
            };
        });
        return o;
    }
    if (typeof dayValue === 'object') return { ...dayValue };
    return {};
}

function mergeCalendarData(localObj, cloudObj) {
    const out = { ...(localObj && typeof localObj === 'object' ? localObj : {}) };
    for (const [dateKey, cloudDay] of Object.entries(cloudObj || {})) {
        const locDay = out[dateKey];
        const merged = {
            ...normalizeCalendarDayForMerge(locDay),
            ...normalizeCalendarDayForMerge(cloudDay)
        };
        out[dateKey] = merged;
    }
    return out;
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

/** Buluttaki hava tercihi boş veya sadece İstanbul varsayılanıysa yerel seçimi ezme. */
function mergeWeatherPrefsFromCloud(cloudPrefs) {
    const local =
        window.trackerWeatherPrefs &&
        typeof window.trackerWeatherPrefs.lat === 'number' &&
        typeof window.trackerWeatherPrefs.lng === 'number'
            ? { ...window.trackerWeatherPrefs }
            : typeof readParsedMirror === 'function'
              ? readParsedMirror('weatherPrefs')
              : null;

    if (
        local &&
        typeof local.lat === 'number' &&
        typeof local.lng === 'number' &&
        (!window.trackerWeatherPrefs ||
            typeof window.trackerWeatherPrefs.lat !== 'number')
    ) {
        window.trackerWeatherPrefs = {
            lat: local.lat,
            lng: local.lng,
            city: String(local.city || '').trim()
        };
    }

    const IST = { lat: 41.0082, lng: 28.9784 };
    const near = (a, b, d = 0.03) => Math.abs(a - b) < d;
    const isDefaultIstanbulCoords = (lat, lng) => near(lat, IST.lat) && near(lng, IST.lng);

    const persistAndRefresh = () => {
        if (window.trackerWeatherPrefs && typeof persistMirror === 'function') {
            persistMirror('weatherPrefs', window.trackerWeatherPrefs);
        }
        if (typeof fetchWeather === 'function') fetchWeather();
    };

    if (!cloudPrefs || typeof cloudPrefs !== 'object') {
        persistAndRefresh();
        return;
    }

    const clat = cloudPrefs.weather_lat;
    const clng = cloudPrefs.weather_lng;
    const ccity = (cloudPrefs.weather_city && String(cloudPrefs.weather_city).trim()) || '';

    const cloudOk =
        typeof clat === 'number' &&
        typeof clng === 'number' &&
        Number.isFinite(clat) &&
        Number.isFinite(clng);

    const localHasCity = local && local.city && String(local.city).trim();
    const localCustomCoords =
        local &&
        typeof local.lat === 'number' &&
        typeof local.lng === 'number' &&
        !isDefaultIstanbulCoords(local.lat, local.lng);

    if (!cloudOk) {
        if (local) {
            window.trackerWeatherPrefs = {
                lat: local.lat,
                lng: local.lng,
                city: String(local.city || '').trim()
            };
        }
        persistAndRefresh();
        return;
    }

    const cloudIsOnlyDefaultIstanbul =
        isDefaultIstanbulCoords(clat, clng) &&
        (!ccity || /^istanbul$/i.test(ccity));

    if ((localHasCity || localCustomCoords) && cloudIsOnlyDefaultIstanbul) {
        window.trackerWeatherPrefs = {
            lat: local.lat,
            lng: local.lng,
            city: String(local.city || '').trim()
        };
    } else {
        window.trackerWeatherPrefs = {
            lat: clat,
            lng: clng,
            city: (ccity || (local && local.city) || '').trim()
        };
    }

    persistAndRefresh();
}

/** Aynı isim+tür aynı günde tek satır (tamamlanma durumu ayrı anahtar olmasın — ikilenir). */
function taskSemanticKey(t) {
    const name = String(t.name || t.title || '').trim().toLowerCase();
    const typ = String(t.type || '24h');
    return `${name}\u0000${typ}`;
}

function dedupeForeverTasksGlobally(db) {
    const seen = new Set();
    const keys = Object.keys(db).sort();
    for (const dk of keys) {
        const arr = db[dk];
        if (!Array.isArray(arr)) continue;
        const kept = [];
        for (const t of arr) {
            if (!t) continue;
            if (t.type === 'forever') {
                const nk = String(t.name || '').trim().toLowerCase();
                if (seen.has(nk)) continue;
                seen.add(nk);
            }
            kept.push(t);
        }
        if (kept.length === 0) delete db[dk];
        else db[dk] = kept;
    }
}

function normalizeTasksDatabase(raw) {
    try {
        const copy = JSON.parse(JSON.stringify(raw || {}));
        const merged = mergeTasksByDate(copy, {});
        dedupeForeverTasksGlobally(merged);
        return merged;
    } catch {
        return raw || {};
    }
}

window.normalizeTasksDatabase = normalizeTasksDatabase;

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
            typeof tasksDatabase !== 'undefined' && typeof normalizeTasksDatabase === 'function'
                ? normalizeTasksDatabase(tasksDatabase)
                : typeof tasksDatabase !== 'undefined'
                  ? mergeTasksByDate(tasksDatabase, {})
                  : {},
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
        if (typeof tasksDatabase !== 'undefined' && typeof normalizeTasksDatabase === 'function') {
            tasksDatabase = normalizeTasksDatabase(tasksDatabase);
        }
        if (cloudData.calendar_data && Object.keys(cloudData.calendar_data).length > 0) {
            if (typeof calEventsDatabase !== 'undefined') {
                calEventsDatabase = mergeCalendarData(calEventsDatabase, cloudData.calendar_data);
            }
        }

        if (cloudData.journal_data && Object.keys(cloudData.journal_data).length > 0) {
            if (typeof journalApplyCloudData === 'function' && typeof journalExportForSync === 'function') {
                const localJournal = journalExportForSync();
                journalApplyCloudData({ ...cloudData.journal_data, ...localJournal });
            }
        }

        mergeWeatherPrefsFromCloud(cloudData.prefs);

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
