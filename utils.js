
function updateGreeting(displayNameRaw) {
    if (!heroGreetingEl) return;
    let name = displayNameRaw;
    if (name == null || name === '') {
        if (typeof window.getPreferredDisplayName === 'function') {
            name = window.getPreferredDisplayName();
        }
    }
    if (name == null || name === '') {
        name = localStorage.getItem('preferredUsername');
    }
    const display = formatDisplayName(name);
    heroGreetingEl.textContent = display ? `Hello ${display}` : 'Hello';
}

function getTodayDateKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isoToLegacyDateKey(isoDate) {
    const [year, month, day] = String(isoDate).split('-').map(Number);
    return `${year}-${month - 1}-${day}`;
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

