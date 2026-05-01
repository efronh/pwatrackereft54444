
async function syncToCloud() {
    if (!window.db || !window.db.syncData) return;
    const session = getLocalSession();
    if (!session?.username) return; // Need active session

    try {
        const user = await window.db.checkUser();
        if (!user) return; // Must be authenticated to Supabase

        const payload = {
            water_data: waterHistory,
            coffee_data: coffeeHistory,
            mood_data: moodDatabase,
            habits_data: habitsDatabase,
            tasks_data: tasksDatabase,
            calendar_data: (typeof calEventsDatabase !== 'undefined' ? calEventsDatabase : {})
        };

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
        if (!cloudData) return; // No cloud data yet

        // Restore if we have data
        if (cloudData.water_data && Object.keys(cloudData.water_data).length > 0) {
            waterHistory = cloudData.water_data;
            localStorage.setItem('waterHistory', JSON.stringify(waterHistory));
            const todayKey = getTodayDateKey();
            if (waterHistory[todayKey]) {
                waterState.current = waterHistory[todayKey];
            } else {
                waterState.current = 0;
            }
            updateWaterUI();
        }
        if (cloudData.coffee_data && Object.keys(cloudData.coffee_data).length > 0) {
            coffeeHistory = cloudData.coffee_data;
            localStorage.setItem('coffeeHistory', JSON.stringify(coffeeHistory));
            const todayKey = getTodayDateKey();
            if (coffeeHistory[todayKey]) {
                coffeeCurrent = coffeeHistory[todayKey];
            } else {
                coffeeCurrent = 0;
            }
            updateCoffeeUI();
        }
        if (cloudData.mood_data && Object.keys(cloudData.mood_data).length > 0) {
            moodDatabase = cloudData.mood_data;
            localStorage.setItem('moodDatabase', JSON.stringify(moodDatabase));
            if (typeof renderMood === 'function') renderMood();
        }
        if (cloudData.habits_data && Array.isArray(cloudData.habits_data)) {
            habitsDatabase = cloudData.habits_data;
            localStorage.setItem('habitsDatabase', JSON.stringify(habitsDatabase));
        }
        if (cloudData.tasks_data && Object.keys(cloudData.tasks_data).length > 0) {
            tasksDatabase = cloudData.tasks_data;
            localStorage.setItem('tasksDatabase', JSON.stringify(tasksDatabase));
        }
        if (cloudData.calendar_data && Object.keys(cloudData.calendar_data).length > 0) {
            if (typeof calEventsDatabase !== 'undefined') {
                calEventsDatabase = cloudData.calendar_data;
                localStorage.setItem('calEventsDatabase', JSON.stringify(calEventsDatabase));
            }
        }
        
        if (typeof renderTasks === 'function') renderTasks();
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderTodayEvents === 'function') renderTodayEvents();
        if (typeof renderWeeklyStats === 'function' && isStatsViewVisible()) renderWeeklyStats();
        
        console.log('Successfully restored data from cloud.');
    } catch (err) {
        console.warn('Failed to restore from cloud:', err);
    }
}

