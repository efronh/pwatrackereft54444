/**
 * Yerel yedek: sync gecikse veya yenileme olunca veri kaybolmasın diye her güncellemede yazılır.
 * Bulut hâlâ ana kaynak; giriş sonrası restore ile birleşir.
 *
 * Anahtarlar kullanıcı UUID ile kapsüllenir (aynı tarayıcıda hesaplar birbirine karışmaz).
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

function mirrorStorageKey(base) {
    const uid = typeof window !== 'undefined' ? window.__trackerMirrorUserId : null;
    if (!uid) return `${base}__pending`;
    return `${base}__u_${uid}`;
}

function isTrackerOnline() {
    return navigator.onLine;
}

function persistMirror(key, value) {
    try {
        const sk = mirrorStorageKey(key);
        localStorage.setItem(sk, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {
        console.warn('Local backup write failed', key, e);
    }
}

function readParsedMirror(key) {
    try {
        const sk = mirrorStorageKey(key);
        const s = localStorage.getItem(sk);
        return s ? JSON.parse(s) : null;
    } catch {
        return null;
    }
}

function mergeMirrorValueForKey(base, existing, incoming) {
    if (existing == null) return incoming;
    if (incoming == null) return existing;
    if (base === 'habitsDatabase') {
        const a = Array.isArray(existing) ? existing : [];
        const b = Array.isArray(incoming) ? incoming : [];
        const map = new Map();
        [...a, ...b].forEach((h) => {
            if (h && h.name) map.set(h.name, { ...h });
        });
        return Array.from(map.values());
    }
    if (
        base === 'tasksDatabase' ||
        base === 'calEventsDatabase' ||
        base === 'journalDatabase'
    ) {
        const out = { ...existing };
        const inc = incoming && typeof incoming === 'object' ? incoming : {};
        for (const k of Object.keys(inc)) {
            if (Array.isArray(out[k]) && Array.isArray(inc[k])) {
                out[k] = [...out[k], ...inc[k]];
            } else if (out[k] != null && typeof out[k] === 'object' && typeof inc[k] === 'object') {
                out[k] = { ...out[k], ...inc[k] };
            } else {
                out[k] = inc[k];
            }
        }
        return out;
    }
    if (
        base === 'waterHistory' ||
        base === 'coffeeHistory' ||
        base === 'moodDatabase' ||
        base === 'waterData' ||
        base === 'weatherPrefs'
    ) {
        return { ...(existing && typeof existing === 'object' ? existing : {}), ...(incoming && typeof incoming === 'object' ? incoming : {}) };
    }
    return incoming;
}

/** Oturum sonradan geldiğinde …__pending altına yazılmış veriyi kullanıcı anahtarına alır */
function mergePendingMirrorsIntoUser(uid) {
    if (!uid) return;
    TRACKER_MIRROR_KEYS.forEach((base) => {
        try {
            const pk = `${base}__pending`;
            const sk = `${base}__u_${uid}`;
            const pRaw = localStorage.getItem(pk);
            if (!pRaw) return;
            let incoming;
            try {
                incoming = JSON.parse(pRaw);
            } catch {
                return;
            }
            const sRaw = localStorage.getItem(sk);
            let merged;
            if (!sRaw) {
                merged = incoming;
            } else {
                let existing;
                try {
                    existing = JSON.parse(sRaw);
                } catch {
                    existing = null;
                }
                merged = mergeMirrorValueForKey(base, existing, incoming);
            }
            localStorage.setItem(sk, JSON.stringify(merged));
            localStorage.removeItem(pk);
        } catch (e) {
            /* ignore */
        }
    });
}

/** Eski düz anahtarlardan (tek kullanıcı dönemi) bu kullanıcıya ilk girişte kopyala */
function migrateLegacyMirrorsToUser(uid) {
    if (!uid) return;
    TRACKER_MIRROR_KEYS.forEach((base) => {
        try {
            const legacy = localStorage.getItem(base);
            if (!legacy) return;
            const scoped = `${base}__u_${uid}`;
            if (localStorage.getItem(scoped)) return;
            localStorage.setItem(scoped, legacy);
        } catch (e) {
            /* ignore */
        }
    });
    try {
        const leg = localStorage.getItem('preferredUsername');
        const sk = `preferredUsername__u_${uid}`;
        if (leg && !localStorage.getItem(sk)) {
            localStorage.setItem(sk, leg);
        }
    } catch (e) {
        /* ignore */
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

window.migrateLegacyMirrorsToUser = migrateLegacyMirrorsToUser;
window.mergePendingMirrorsIntoUser = mergePendingMirrorsIntoUser;
