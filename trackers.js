
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

    if (typeof getTodayDateKey === 'function') {
        const todayKey = getTodayDateKey();
        waterHistory[todayKey] = waterState.current;
        localStorage.setItem('waterHistory', JSON.stringify(waterHistory));
    }
    syncToCloud();
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
    
    const todayKey = getTodayDateKey();
    if (coffeeHistory[todayKey]) {
        coffeeCurrent = coffeeHistory[todayKey];
    } else {
        coffeeCurrent = 0;
    }

    updateWaterUI();
    updateCoffeeUI();
}

function updateCoffeeUI() {
    const coffeeEl = document.getElementById('coffee-current');
    if (!coffeeEl) return;
    coffeeEl.textContent = coffeeCurrent;
    
    if (typeof getTodayDateKey === 'function') {
        const todayKey = getTodayDateKey();
        coffeeHistory[todayKey] = coffeeCurrent;
        localStorage.setItem('coffeeHistory', JSON.stringify(coffeeHistory));
    }
    syncToCloud();
}

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

