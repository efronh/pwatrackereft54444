/**
 * Yerel yedek: sync gecikse veya yenileme olunca veri kaybolmasın diye her güncellemede yazılır.
 * Bulut hâlâ ana kaynak; giriş sonrası restore ile birleşir.
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
    try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {
        console.warn('Local backup write failed', key, e);
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
