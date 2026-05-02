
function updateWaterUI(options) {
    const skipCloud = options && options.skipCloudSync;
    waterCurrentEl.textContent = waterState.current;
    if (window.WaterProgress && typeof window.WaterProgress.compute === 'function') {
        const progress = window.WaterProgress.compute(waterState.current, waterState.goal);
        waterBarEl.style.width = `${progress.percentage}%`;
        waterBarEl.style.backgroundColor = progress.toneColor;
    }

    persistMirror('waterData', {
        ...waterState,
        date: new Date().toLocaleDateString()
    });

    if (typeof getTodayDateKey === 'function') {
        const todayKey = getTodayDateKey();
        waterHistory[todayKey] = waterState.current;
        persistMirror('waterHistory', waterHistory);
    }
    if (!skipCloud) syncToCloud();
}

function loadWaterData() {
    const todayKey = getTodayDateKey();

    if (typeof isTrackerOnline === 'function' && isTrackerOnline()) {
        if (waterHistory[todayKey] !== undefined && waterHistory[todayKey] !== null) {
            waterState.current = Number(waterHistory[todayKey]) || 0;
        } else {
            const data =
                typeof readParsedMirror === 'function' ? readParsedMirror('waterData') : null;
            if (data && data.date === new Date().toLocaleDateString()) {
                waterState.current = Number(data.current) || 0;
                waterHistory[todayKey] = waterState.current;
            } else {
                waterState.current = 0;
            }
        }
    } else {
        const data = typeof readParsedMirror === 'function' ? readParsedMirror('waterData') : null;
        if (data && data.date === new Date().toLocaleDateString()) {
            waterState.current = data.current;
        } else {
            waterState.current = 0;
        }
    }

    if (coffeeHistory[todayKey] != null) {
        coffeeCurrent = Number(coffeeHistory[todayKey]) || 0;
    } else {
        coffeeCurrent = 0;
    }

    updateWaterUI({ skipCloudSync: true });
    updateCoffeeUI({ skipCloudSync: true });
}

function updateCoffeeUI(options) {
    const skipCloud = options && options.skipCloudSync;
    const coffeeEl = document.getElementById('coffee-current');
    if (!coffeeEl) return;
    coffeeEl.textContent = coffeeCurrent;

    if (typeof getTodayDateKey === 'function') {
        const todayKey = getTodayDateKey();
        coffeeHistory[todayKey] = coffeeCurrent;
        persistMirror('coffeeHistory', coffeeHistory);
    }
    if (!skipCloud) syncToCloud();
    if (typeof isStatsViewVisible === 'function' && isStatsViewVisible() && typeof renderWeeklyStats === 'function') {
        renderWeeklyStats();
    }
}

function renderMood() {
    if (!moodBtns || moodBtns.length === 0) return;
    const todayKey = getTodayDateKey();
    const currentMood = moodDatabase[todayKey];

    moodBtns.forEach((btn) => {
        btn.classList.remove('active');
        if (btn.dataset.mood === currentMood) {
            btn.classList.add('active');
        }
    });
}
