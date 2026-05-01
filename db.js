const supabaseUrl = 'https://rjculoumurglbmwtpyjo.supabase.co';
const supabaseKey = 'sb_publishable_PUyp2IQSkFgRx704bDUq2w_LNAczZbR';

// Global Supabase istemcisi
const _supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

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
            const waterUpserts = Object.keys(payload.water_data).map(date => ({
                user_id: userId,
                log_date: date,
                amount_ml: payload.water_data[date]
            }));
            if (waterUpserts.length > 0) {
                await _supabase.from('water_logs').upsert(waterUpserts, { onConflict: 'user_id,log_date' });
            }
        }

        if (payload.mood_data) {
            const moodUpserts = Object.keys(payload.mood_data).map(date => ({
                user_id: userId,
                log_date: date,
                mood_label: payload.mood_data[date]
            }));
            if (moodUpserts.length > 0) {
                await _supabase.from('mood_logs').upsert(moodUpserts, { onConflict: 'user_id,log_date' });
            }
        }

        if (payload.coffee_data) {
            const coffeeUpserts = Object.keys(payload.coffee_data).map(date => ({
                user_id: userId,
                log_date: date,
                cups: payload.coffee_data[date]
            }));
            if (coffeeUpserts.length > 0) {
                await _supabase.from('coffee_logs').upsert(coffeeUpserts, { onConflict: 'user_id,log_date' });
            }
        }

        if (payload.habits_data) {
            const habitUpserts = payload.habits_data.map(habit => ({
                user_id: userId,
                title: habit.name,
                completed_dates: habit.completedDates || {}
            }));
            if (habitUpserts.length > 0) {
                await _supabase.from('habits').upsert(habitUpserts, { onConflict: 'user_id,title' });
            }
        }

        if (payload.tasks_data) {
            await _supabase.from('tasks').delete().eq('user_id', userId);
            const taskInserts = [];
            for (const [date, tasks] of Object.entries(payload.tasks_data)) {
                for (const t of tasks) {
                    taskInserts.push({
                        user_id: userId,
                        task_date: date,
                        title: t.text || t.title || '',
                        is_completed: t.completed || t.is_completed || false
                    });
                }
            }
            if (taskInserts.length > 0) await _supabase.from('tasks').insert(taskInserts);
        }

        if (payload.calendar_data) {
            await _supabase.from('calendar_events').delete().eq('user_id', userId);
            const eventInserts = [];
            for (const [date, events] of Object.entries(payload.calendar_data)) {
                for (const ev of events) {
                    eventInserts.push({
                        user_id: userId,
                        event_date: date,
                        title: ev.title || '',
                        duration_mins: ev.duration || 60,
                        note: ev.note || ''
                    });
                }
            }
            if (eventInserts.length > 0) await _supabase.from('calendar_events').insert(eventInserts);
        }

        return true;
    },
    
    // Buluttan verileri çek (reconstruct JSON payload from relational tables)
    fetchData: async function(userId) {
        const [waterRes, moodRes, coffeeRes, habitRes, taskRes, calRes] = await Promise.all([
            _supabase.from('water_logs').select('*').eq('user_id', userId),
            _supabase.from('mood_logs').select('*').eq('user_id', userId),
            _supabase.from('coffee_logs').select('*').eq('user_id', userId),
            _supabase.from('habits').select('*').eq('user_id', userId),
            _supabase.from('tasks').select('*').eq('user_id', userId),
            _supabase.from('calendar_events').select('*').eq('user_id', userId)
        ]);

        const data = {
            water_data: {},
            mood_data: {},
            coffee_data: {},
            habits_data: [],
            tasks_data: {},
            calendar_data: {}
        };

        if (waterRes.data) {
            waterRes.data.forEach(row => { data.water_data[row.log_date] = row.amount_ml; });
        }
        if (moodRes.data) {
            moodRes.data.forEach(row => { data.mood_data[row.log_date] = row.mood_label; });
        }
        if (coffeeRes.data) {
            coffeeRes.data.forEach(row => { data.coffee_data[row.log_date] = row.cups; });
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
                    text: row.title,
                    completed: row.is_completed
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

        return data;
    }
};