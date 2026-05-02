
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
        tasks_data: typeof tasksDatabase !== 'undefined' ? tasksDatabase : {},
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

        if (cloudData.water_data && Object.keys(cloudData.water_data).length > 0) {
            waterHistory = cloudData.water_data;
            if (waterHistory[todayKey] !== undefined && waterHistory[todayKey] !== null) {
                waterState.current = Number(waterHistory[todayKey]) || 0;
            } else {
                waterState.current = 0;
            }
            if (typeof updateWaterUI === 'function') updateWaterUI();
        }
        if (cloudData.coffee_data && Object.keys(cloudData.coffee_data).length > 0) {
            coffeeHistory = cloudData.coffee_data;
            if (coffeeHistory[todayKey] !== undefined && coffeeHistory[todayKey] !== null) {
                coffeeCurrent = Number(coffeeHistory[todayKey]) || 0;
            } else {
                coffeeCurrent = 0;
            }
            if (typeof updateCoffeeUI === 'function') updateCoffeeUI();
        }
        if (cloudData.mood_data && Object.keys(cloudData.mood_data).length > 0) {
            moodDatabase = cloudData.mood_data;
            if (typeof renderMood === 'function') renderMood();
        }
        if (
            cloudData.habits_data &&
            Array.isArray(cloudData.habits_data) &&
            cloudData.habits_data.length > 0
        ) {
            habitsDatabase = cloudData.habits_data;
        }
        if (cloudData.tasks_data && Object.keys(cloudData.tasks_data).length > 0) {
            tasksDatabase = cloudData.tasks_data;
        }
        if (cloudData.calendar_data && Object.keys(cloudData.calendar_data).length > 0) {
            if (typeof calEventsDatabase !== 'undefined') {
                calEventsDatabase = cloudData.calendar_data;
            }
        }

        if (cloudData.journal_data && Object.keys(cloudData.journal_data).length > 0) {
            if (typeof journalApplyCloudData === 'function') {
                journalApplyCloudData(cloudData.journal_data);
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
