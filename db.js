const supabaseUrl = 'https://rjculoumurglbmwtpyjo.supabase.co';
const supabaseKey = 'sb_publishable_PUyp2IQSkFgRx704bDUq2w_LNAczZbR';

/** Uygulama: getTodayDateKey → YYYY-M-D (M 0–11). Postgres DATE → ISO YYYY-MM-DD. */
function appDateKeyToPostgresDate(appKey) {
    const p = String(appKey).split('-');
    if (p.length < 3) return appKey;
    const y = parseInt(p[0], 10);
    const m0 = parseInt(p[1], 10);
    const d = parseInt(p[2], 10);
    if (!Number.isFinite(y) || !Number.isFinite(m0) || !Number.isFinite(d)) return appKey;
    const m = String(m0 + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function postgresDateToAppKey(value) {
    if (value == null) return '';
    const s = String(value);
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (!m) return s;
    const y = parseInt(m[1], 10);
    const month1 = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    if (!Number.isFinite(y) || !Number.isFinite(month1) || !Number.isFinite(d)) return s;
    return `${y}-${month1 - 1}-${d}`;
}

// Global Supabase istemcisi (Safari / Mac: oturum ayarlari acik; storageKey varsayilan — mevcut oturumlar korunur)
const _supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
    }
});

window.db = {
    supabase: _supabase,
    
    // Mevcut oturumu kontrol eder
    checkUser: async function() {
        const { data: { session } } = await _supabase.auth.getSession();
        return session?.user || null;
    },
    
    // Giriş yapma fonksiyonu
    loginUser: async function(email, password) {
        const { data, error } = await _supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) throw error;
        return data.user;
    },
    
    // Kayıt olma fonksiyonu
    registerUser: async function(email, password) {
        const { data, error } = await _supabase.auth.signUp({
            email: email,
            password: password
        });
        if (error) throw error;
        return data.user;
    },
    
    // Verileri bulutla eşitle (upsert to relational tables)
    syncData: async function(userId, payload) {
        if (payload.water_data) {
            const waterUpserts = Object.keys(payload.water_data).map((date) => ({
                user_id: userId,
                log_date: appDateKeyToPostgresDate(date),
                amount_ml: Math.round(Number(payload.water_data[date]) || 0)
            }));
            if (waterUpserts.length > 0) {
                const { error: wErr } = await _supabase
                    .from('water_logs')
                    .upsert(waterUpserts, { onConflict: 'user_id,log_date' });
                if (wErr) console.warn('water_logs sync:', wErr.message);
            }
        }

        if (payload.mood_data) {
            const moodUpserts = Object.keys(payload.mood_data).map((date) => ({
                user_id: userId,
                log_date: appDateKeyToPostgresDate(date),
                mood_label: payload.mood_data[date]
            }));
            if (moodUpserts.length > 0) {
                const { error: moErr } = await _supabase
                    .from('mood_logs')
                    .upsert(moodUpserts, { onConflict: 'user_id,log_date' });
                if (moErr) console.warn('mood_logs sync:', moErr.message);
            }
        }

        if (payload.coffee_data) {
            const coffeeUpserts = Object.keys(payload.coffee_data).map((date) => ({
                user_id: userId,
                log_date: appDateKeyToPostgresDate(date),
                cups: Math.round(Number(payload.coffee_data[date]) || 0)
            }));
            if (coffeeUpserts.length > 0) {
                const { error: coErr } = await _supabase
                    .from('coffee_logs')
                    .upsert(coffeeUpserts, { onConflict: 'user_id,log_date' });
                if (coErr) console.warn('coffee_logs sync:', coErr.message);
            }
        }

        if (payload.habits_data != null && Array.isArray(payload.habits_data)) {
            const { error: hDelErr } = await _supabase.from('habits').delete().eq('user_id', userId);
            if (hDelErr) console.warn('habits delete:', hDelErr.message);
            if (payload.habits_data.length > 0) {
                const habitRows = payload.habits_data.map((habit) => ({
                    user_id: userId,
                    title: habit.name,
                    completed_dates: habit.completedDates || {}
                }));
                const { error: hInsErr } = await _supabase.from('habits').insert(habitRows);
                if (hInsErr) console.warn('habits insert:', hInsErr.message);
            }
        }

        if (payload.tasks_data && typeof payload.tasks_data === 'object') {
            const taskInserts = [];
            for (const [date, tasks] of Object.entries(payload.tasks_data)) {
                for (const t of tasks || []) {
                    taskInserts.push({
                        user_id: userId,
                        task_date: date,
                        title: t.name || t.text || t.title || '',
                        is_completed: t.completed || t.is_completed || false,
                        task_type: t.type || '24h'
                    });
                }
            }
            // Boş gönderimde silme yapma — buluttaki görevleri yanlışlıkla sıfırlama
            if (taskInserts.length > 0) {
                await _supabase.from('tasks').delete().eq('user_id', userId);
                await _supabase.from('tasks').insert(taskInserts);
            }
        }

        if (payload.calendar_data && typeof payload.calendar_data === 'object') {
            const eventInserts = [];
            for (const [date, events] of Object.entries(payload.calendar_data)) {
                for (const ev of events || []) {
                    eventInserts.push({
                        user_id: userId,
                        event_date: date,
                        title: ev.title || '',
                        duration_mins: ev.duration || 60,
                        note: ev.note || ''
                    });
                }
            }
            if (eventInserts.length > 0) {
                await _supabase.from('calendar_events').delete().eq('user_id', userId);
                await _supabase.from('calendar_events').insert(eventInserts);
            }
        }

        // Günlük / journal (JSON payload per day)
        if (payload.journal_data && typeof payload.journal_data === 'object') {
            const rows = Object.keys(payload.journal_data).map((entryDate) => ({
                user_id: userId,
                entry_date: entryDate,
                payload: payload.journal_data[entryDate]
            }));
            if (rows.length > 0) {
                const { error: je } = await _supabase.from('journal_entries').upsert(rows, {
                    onConflict: 'user_id,entry_date'
                });
                if (je) console.warn('journal_entries sync:', je.message);
            }
        }

        // Hava / küçük tercihler (tek satır)
        if (
            payload.prefs &&
            typeof payload.prefs === 'object' &&
            typeof payload.prefs.weather_lat === 'number' &&
            typeof payload.prefs.weather_lng === 'number'
        ) {
            const { error: pe } = await _supabase.from('user_preferences').upsert(
                {
                    user_id: userId,
                    weather_lat: payload.prefs.weather_lat,
                    weather_lng: payload.prefs.weather_lng,
                    weather_city: payload.prefs.weather_city ?? null,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'user_id' }
            );
            if (pe) console.warn('user_preferences sync:', pe.message);
        }

        return true;
    },
    
    // Buluttan verileri çek (reconstruct JSON payload from relational tables)
    fetchData: async function(userId) {
        const [waterRes, moodRes, coffeeRes, habitRes, taskRes, calRes, journalRes, prefRes] =
            await Promise.all([
                _supabase.from('water_logs').select('*').eq('user_id', userId),
                _supabase.from('mood_logs').select('*').eq('user_id', userId),
                _supabase.from('coffee_logs').select('*').eq('user_id', userId),
                _supabase.from('habits').select('*').eq('user_id', userId),
                _supabase.from('tasks').select('*').eq('user_id', userId),
                _supabase.from('calendar_events').select('*').eq('user_id', userId),
                _supabase.from('journal_entries').select('*').eq('user_id', userId),
                _supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle()
            ]);

        const data = {
            water_data: {},
            mood_data: {},
            coffee_data: {},
            habits_data: [],
            tasks_data: {},
            calendar_data: {},
            journal_data: {},
            prefs: null
        };

        if (waterRes.data) {
            waterRes.data.forEach((row) => {
                const k = postgresDateToAppKey(row.log_date);
                if (k) data.water_data[k] = row.amount_ml;
            });
        }
        if (moodRes.data) {
            moodRes.data.forEach((row) => {
                const k = postgresDateToAppKey(row.log_date);
                if (k) data.mood_data[k] = row.mood_label;
            });
        }
        if (coffeeRes.data) {
            coffeeRes.data.forEach((row) => {
                const k = postgresDateToAppKey(row.log_date);
                if (k) data.coffee_data[k] = row.cups;
            });
        }
        if (habitRes.data) {
            data.habits_data = habitRes.data.map(row => ({
                name: row.title,
                completedDates: row.completed_dates
            }));
        }
        if (taskRes.data) {
            taskRes.data.forEach(row => {
                if (!data.tasks_data[row.task_date]) data.tasks_data[row.task_date] = [];
                data.tasks_data[row.task_date].push({
                    id: row.id,
                    name: row.title,
                    completed: row.is_completed,
                    type: row.task_type || '24h'
                });
            });
        }
        if (calRes.data) {
            calRes.data.forEach(row => {
                if (!data.calendar_data[row.event_date]) data.calendar_data[row.event_date] = [];
                data.calendar_data[row.event_date].push({
                    title: row.title,
                    duration: row.duration_mins,
                    note: row.note
                });
            });
        }
        if (!journalRes.error && journalRes.data) {
            journalRes.data.forEach((row) => {
                data.journal_data[row.entry_date] = row.payload;
            });
        } else if (journalRes.error) {
            console.warn('journal_entries fetch:', journalRes.error.message);
        }
        if (!prefRes.error && prefRes.data) {
            data.prefs = {
                weather_lat: prefRes.data.weather_lat,
                weather_lng: prefRes.data.weather_lng,
                weather_city: prefRes.data.weather_city
            };
        } else if (prefRes.error) {
            console.warn('user_preferences fetch:', prefRes.error.message);
        }

        return data;
    }
};

/*
 * Supabase SQL (Dashboard → SQL):
 *
 * create table if not exists journal_entries (
 *   user_id uuid not null references auth.users on delete cascade,
 *   entry_date text not null,
 *   payload jsonb not null default '{}',
 *   updated_at timestamptz default now(),
 *   primary key (user_id, entry_date)
 * );
 * alter publication supabase_realtime add table journal_entries; -- opsiyonel
 *
 * create table if not exists user_preferences (
 *   user_id uuid primary key references auth.users on delete cascade,
 *   weather_lat double precision,
 *   weather_lng double precision,
 *   weather_city text,
 *   updated_at timestamptz default now()
 * );
 */