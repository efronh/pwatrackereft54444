
function setAuthError(message) {
    if (authErrorEl) authErrorEl.textContent = message || '';
}

function setAuthBusy(isBusy) {
    isAuthBusy = isBusy;
    if (authLoginBtn) authLoginBtn.disabled = isBusy;
    if (authRegisterBtn) authRegisterBtn.disabled = isBusy;
    if (authUsernameInput) authUsernameInput.disabled = isBusy;
    if (authPinInput) authPinInput.disabled = isBusy;
}

function validateAuthInputs(usernameRaw, pinRaw) {
    const username = sanitizeUsername(usernameRaw);
    const displayUsername = String(usernameRaw || '').trim();
    const pin = String(pinRaw || '').trim();
    if (!username || username.length < 3) {
        throw new Error('Kullanici adi en az 3 karakter olmali.');
    }
    if (!/^\d{6}$/.test(pin)) {
        throw new Error('PIN tam 6 haneli olmali.');
    }
    return { username, displayUsername: displayUsername || username, pin };
}

function buildSupabaseEmailFromUsername(username) {
    return `${username}@trackerapp.dev`;
}

function getLocalUsers() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_AUTH_USERS_KEY) || '{}');
    } catch (_) {
        return {};
    }
}

function saveLocalUsers(users) {
    localStorage.setItem(LOCAL_AUTH_USERS_KEY, JSON.stringify(users));
}

function setLocalSession(username) {
    localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify({
        username,
        loggedInAt: Date.now()
    }));
}

function getLocalSession() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_AUTH_SESSION_KEY) || 'null');
    } catch (_) {
        return null;
    }
}

function tryLocalRegister(username, pin) {
    const users = getLocalUsers();
    if (users[username]) {
        throw new Error('Bu kullanici adi zaten kayitli. Giris Yap ile devam et.');
    }
    users[username] = { pin };
    saveLocalUsers(users);
    setLocalSession(username);
}

function tryLocalLogin(username, pin) {
    const users = getLocalUsers();
    if (!users[username]) {
        // Automatically create local user if Supabase is down and they don't exist locally
        tryLocalRegister(username, pin);
        return;
    }
    if (users[username].pin !== pin) {
        throw new Error('Kullanici adi veya PIN hatali.');
    }
    setLocalSession(username);
}

async function loginWithUsernamePin() {
    if (isAuthBusy) return;
    setAuthError('');
    setAuthBusy(true);
    try {
        const { username, displayUsername, pin } = validateAuthInputs(authUsernameInput?.value, authPinInput?.value);
        const syntheticEmail = buildSupabaseEmailFromUsername(username);
        if (window.db && window.db.loginUser) {
            await window.db.loginUser(syntheticEmail, pin);
            await restoreFromCloud();
        } else {
            throw new Error('Veritabani baglantisi bulunamadi.');
        }
        localStorage.setItem('preferredUsername', displayUsername);
        updateGreeting(displayUsername);
        hideAuthModal();
        renderWeeklyStats();
    } catch (err) {
        setAuthError(err?.message || 'Giris basarisiz.');
    } finally {
        setAuthBusy(false);
    }
}

async function registerWithUsernamePin() {
    if (isAuthBusy) return;
    setAuthError('');
    setAuthBusy(true);
    try {
        const { username, displayUsername, pin } = validateAuthInputs(authUsernameInput?.value, authPinInput?.value);
        const syntheticEmail = buildSupabaseEmailFromUsername(username);
        if (window.db && window.db.registerUser && window.db.loginUser) {
            await window.db.registerUser(syntheticEmail, pin);
            // Always attempt sign-in after sign-up for consistent UX.
            await window.db.loginUser(syntheticEmail, pin);
            await restoreFromCloud();
        } else {
            throw new Error('Veritabani baglantisi bulunamadi.');
        }

        localStorage.setItem('preferredUsername', displayUsername);
        updateGreeting(displayUsername);
        hideAuthModal();
        renderWeeklyStats();
    } catch (err) {
        const raw = err?.message || 'Kayit basarisiz.';
        if (/already registered|already been registered|user already registered/i.test(raw)) {
            setAuthError('Bu kullanici adi zaten kayitli. Giris Yap ile devam et.');
        } else if (/Password should be at least 6 characters/i.test(raw)) {
            setAuthError('PIN Supabase kurali nedeniyle 6 hane olmali.');
        } else {
            setAuthError(raw);
        }
    } finally {
        setAuthBusy(false);
    }
}

async function initAuthGate() {
    try {
        const localSession = getLocalSession();
        let isSupabaseAuthed = false;

        if (window.db && window.db.checkUser) {
            try {
                const sessionUser = await window.db.checkUser();
                if (sessionUser) {
                    isSupabaseAuthed = true;
                }
            } catch (supaErr) {
                console.warn('Supabase auth check failed', supaErr);
            }
        }

        if (isSupabaseAuthed && localSession?.username) {
            updateGreeting(localSession.username);
            hideAuthModal();
            restoreFromCloud();
            return;
        }

        // Supabase session is missing or expired, force re-login!
        updateGreeting(localStorage.getItem('preferredUsername'));
        showAuthModal();
        if (authUsernameInput) {
            const saved = localStorage.getItem('preferredUsername');
            if (saved) authUsernameInput.value = saved;
        }
    } catch (err) {
        console.error('Auth init failed', err);
        showAuthModal();
    }
}

async function hardResetUserDataIfRequested() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') !== '1') return false;

    try {
        if (window.db && window.db.checkUser && window.db.supabase) {
            const user = await window.db.checkUser();
            if (user) {
                const uid = user.id;
                await Promise.allSettled([
                    window.db.supabase.from('water_logs').delete().eq('user_id', uid),
                    window.db.supabase.from('mood_logs').delete().eq('user_id', uid),
                    window.db.supabase.from('app_data').delete().eq('user_id', uid)
                ]);
                await window.db.supabase.auth.signOut();
            }
        }
    } catch (err) {
        console.warn('Remote reset warning:', err);
    }

    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', window.location.pathname);
    window.location.reload();
    return true;
}

