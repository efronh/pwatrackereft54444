/**
 * Çevrimdışı dışında tracker verisini tarayıcıda tutmaz.
 * navigator.onLine === false iken aynalar; çevrimiçi + buluttan restore sonrası temizlenir.
 * (Supabase Auth oturumu SDK tarafında ayrı tutulur — bu normaldir.)
 */

const TRACKER_MIRROR_KEYS = [
    'waterHistory',
    'coffeeHistory',
    'moodDatabase',
    'habitsDatabase',
    'tasksDatabase',
    'calEventsDatabase',
    'journalDatabase',
    'waterData',
    'weatherPrefs'
];

function isTrackerOnline() {
    return navigator.onLine;
}

function persistMirror(key, value) {
    if (isTrackerOnline()) return;
    try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {
        console.warn('Offline mirror write failed', key, e);
    }
}

function readParsedMirror(key) {
    try {
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : null;
    } catch {
        return null;
    }
}

function clearAppDataMirrors() {
    TRACKER_MIRROR_KEYS.forEach((k) => {
        try {
            localStorage.removeItem(k);
        } catch (e) {
            /* ignore */
        }
    });
}
