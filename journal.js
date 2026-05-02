/**
 * Daily journal — bulutta saklanır; çevrimdışında mirror (cloud-mirror.js).
 */

const JOURNAL_STORAGE_KEY = 'journalDatabase';

function journalDefaultEntry() {
    return {
        body: '',
        rating: null,
        tags: [],
        intention: '',
        eveningWell: '',
        eveningDrain: '',
        gratitude: ['', '', ''],
        differently: ''
    };
}

let journalDatabase = {};

function journalExportForSync() {
    try {
        return JSON.parse(JSON.stringify(journalDatabase));
    } catch {
        return {};
    }
}

function journalApplyCloudData(obj) {
    if (!obj || typeof obj !== 'object') return;
    journalDatabase = { ...obj };
}

window.journalExportForSync = journalExportForSync;
window.journalApplyCloudData = journalApplyCloudData;

function journalGetEntry(dateKey) {
    const raw = journalDatabase[dateKey] || {};
    const base = journalDefaultEntry();
    const g = Array.isArray(raw.gratitude) ? raw.gratitude : base.gratitude;
    return {
        ...base,
        ...raw,
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        gratitude: [g[0] || '', g[1] || '', g[2] || '']
    };
}

function journalSaveEntry(dateKey, partial) {
    const merged = { ...journalGetEntry(dateKey), ...partial };
    journalDatabase[dateKey] = merged;
    persistMirror(JOURNAL_STORAGE_KEY, journalDatabase);
    if (typeof syncToCloud === 'function') syncToCloud();
}

const MOOD_EMOJI = {
    happy: '😊',
    proud: '🌟',
    nervous: '😬',
    tired: '😮‍💨',
    sad: '😢',
    angry: '😤'
};

function journalMoodEmoji(moodLabel) {
    if (!moodLabel) return '';
    return MOOD_EMOJI[String(moodLabel).toLowerCase()] || '';
}

function journalParseTagsInput(str) {
    return String(str || '')
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean);
}

function journalFormatTagsDisplay(tags) {
    if (!tags || !tags.length) return '';
    return tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
}

function journalTaskSnapshotForDay(dateKey) {
    if (typeof tasksDatabase === 'undefined') return 'Tasks data unavailable.';
    const list = tasksDatabase[dateKey] || [];
    if (list.length === 0) {
        return 'No dated tasks for this day.';
    }
    const done = list.filter((t) => t.completed).length;
    return `${done} of ${list.length} to-dos completed for this day.`;
}

function journalWaterMlForDay(dateKey) {
    const tk = typeof getTodayDateKey === 'function' ? getTodayDateKey() : '';
    let ml = 0;
    if (typeof waterHistory !== 'undefined' && waterHistory[dateKey] !== undefined) {
        ml = Number(waterHistory[dateKey]) || 0;
    }
    if (dateKey === tk && typeof waterState !== 'undefined') {
        ml = Math.max(ml, Number(waterState.current) || 0);
    }
    return Math.round(ml);
}

function journalCoffeeCupsForDay(dateKey) {
    const tk = typeof getTodayDateKey === 'function' ? getTodayDateKey() : '';
    let cups = 0;
    if (typeof coffeeHistory !== 'undefined' && coffeeHistory[dateKey] !== undefined) {
        cups = Number(coffeeHistory[dateKey]) || 0;
    }
    if (dateKey === tk && typeof coffeeCurrent !== 'undefined') {
        cups = Math.max(cups, Number(coffeeCurrent) || 0);
    }
    return cups;
}

function journalBuildAutoSummary(dateKey) {
    const ml = journalWaterMlForDay(dateKey);
    const cups = journalCoffeeCupsForDay(dateKey);
    let moodPart = '';
    if (typeof moodDatabase !== 'undefined' && moodDatabase[dateKey]) {
        const em = journalMoodEmoji(moodDatabase[dateKey]);
        moodPart = em ? ` Mood was ${em}.` : '';
    } else {
        moodPart = ' No mood logged in the tracker yet.';
    }
    return `You drank ${ml} ml water, ${cups} coffee.${moodPart}`;
}

function journalCorrelationText(dateKey) {
    const entry = journalGetEntry(dateKey);
    const jr = entry.rating;
    let moodScore = 0;
    if (typeof moodDatabase !== 'undefined' && moodDatabase[dateKey] && typeof moodToScore === 'function') {
        moodScore = moodToScore(moodDatabase[dateKey]);
    }
    if (!jr || moodScore <= 0) {
        return 'Set a day rating and pick a mood on Today to see how they line up.';
    }
    const diff = Math.abs(jr - moodScore);
    if (diff <= 1) {
        return 'Journal rating and mood tracker look aligned today.';
    }
    return 'Journal rating and mood tracker differ — worth noticing.';
}

let journalSelectedDateKey = typeof getTodayDateKey === 'function' ? getTodayDateKey() : '';
let journalViewingMonth = new Date();

let journalDebounceTimer = null;

function journalOnOpenTab() {
    const key = journalSelectedDateKey || getTodayDateKey();
    journalHydrateForm(key);
    journalRenderMiniCalendar();
}

function initJournalUI() {
    journalSelectedDateKey = getTodayDateKey();
    journalViewingMonth = new Date();

    const openFullBtn = document.getElementById('journal-open-full-btn');
    const jumpTodayBtn = document.getElementById('journal-jump-today');
    const saveBtn = document.getElementById('journal-save-btn');
    const prevBtn = document.getElementById('journal-cal-prev');
    const nextBtn = document.getElementById('journal-cal-next');
    const quickTa = document.getElementById('journal-today-quick');
    const teaserDate = document.getElementById('journal-teaser-date');

    if (teaserDate) {
        teaserDate.textContent = formatJournalHumanDate(journalSelectedDateKey);
    }

    if (quickTa) {
        quickTa.value = journalGetEntry(getTodayDateKey()).body || '';
        quickTa.addEventListener('input', () => {
            clearTimeout(journalDebounceTimer);
            journalDebounceTimer = setTimeout(() => {
                journalSaveEntry(getTodayDateKey(), { body: quickTa.value.trim() });
            }, 400);
        });
    }

    if (openFullBtn) {
        openFullBtn.addEventListener('click', () => {
            journalSelectedDateKey = getTodayDateKey();
            if (typeof switchView === 'function') switchView('journal');
        });
    }

    if (jumpTodayBtn) {
        jumpTodayBtn.addEventListener('click', () => {
            journalSelectedDateKey = getTodayDateKey();
            journalViewingMonth = new Date();
            journalHydrateForm(journalSelectedDateKey);
            journalRenderMiniCalendar();
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            journalPersistFromForm();
            const ta = document.getElementById('journal-today-quick');
            if (ta && journalSelectedDateKey === getTodayDateKey()) {
                ta.value = journalGetEntry(getTodayDateKey()).body || '';
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            journalViewingMonth.setMonth(journalViewingMonth.getMonth() - 1);
            journalRenderMiniCalendar();
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            journalViewingMonth.setMonth(journalViewingMonth.getMonth() + 1);
            journalRenderMiniCalendar();
        });
    }

    document.querySelectorAll('.journal-rating-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const v = parseInt(btn.getAttribute('data-value'), 10);
            document.querySelectorAll('.journal-rating-btn').forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
            btn.closest('.journal-rating-row')?.setAttribute('data-selected', String(v));
        });
    });

    journalHydrateForm(journalSelectedDateKey);
    journalRenderMiniCalendar();
}

function formatJournalHumanDate(dateKey) {
    const parts = String(dateKey).split('-').map(Number);
    if (parts.length < 3) return dateKey;
    const dt = new Date(parts[0], parts[1], parts[2]);
    return dt.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

function journalHydrateForm(dateKey) {
    journalSelectedDateKey = dateKey;
    const e = journalGetEntry(dateKey);

    const label = document.getElementById('journal-selected-date-label');
    if (label) label.textContent = formatJournalHumanDate(dateKey);

    const body = document.getElementById('journal-body');
    if (body) body.value = e.body || '';

    const tags = document.getElementById('journal-tags-input');
    if (tags) tags.value = journalFormatTagsDisplay(e.tags);

    document.querySelectorAll('.journal-rating-btn').forEach((btn) => {
        const v = parseInt(btn.getAttribute('data-value'), 10);
        btn.classList.toggle('selected', e.rating === v);
    });

    const intention = document.getElementById('journal-intention');
    const eveningWell = document.getElementById('journal-evening-well');
    const eveningDrain = document.getElementById('journal-evening-drain');
    const diff = document.getElementById('journal-differently');
    if (intention) intention.value = e.intention || '';
    if (eveningWell) eveningWell.value = e.eveningWell || '';
    if (eveningDrain) eveningDrain.value = e.eveningDrain || '';
    if (diff) diff.value = e.differently || '';

    const g0 = document.getElementById('journal-gratitude-0');
    const g1 = document.getElementById('journal-gratitude-1');
    const g2 = document.getElementById('journal-gratitude-2');
    if (g0) g0.value = e.gratitude[0] || '';
    if (g1) g1.value = e.gratitude[1] || '';
    if (g2) g2.value = e.gratitude[2] || '';

    journalRefreshInsights(dateKey);
}

function journalPersistFromForm() {
    const dateKey = journalSelectedDateKey;
    const selectedBtn = document.querySelector('.journal-rating-btn.selected');
    const rating = selectedBtn ? parseInt(selectedBtn.getAttribute('data-value'), 10) : null;

    const bodyEl = document.getElementById('journal-body');
    const tagsEl = document.getElementById('journal-tags-input');
    const intention = document.getElementById('journal-intention');
    const eveningWell = document.getElementById('journal-evening-well');
    const eveningDrain = document.getElementById('journal-evening-drain');
    const diff = document.getElementById('journal-differently');
    const g0 = document.getElementById('journal-gratitude-0');
    const g1 = document.getElementById('journal-gratitude-1');
    const g2 = document.getElementById('journal-gratitude-2');

    journalSaveEntry(dateKey, {
        body: bodyEl ? bodyEl.value.trim() : '',
        rating: Number.isFinite(rating) ? rating : null,
        tags: tagsEl ? journalParseTagsInput(tagsEl.value) : [],
        intention: intention ? intention.value.trim() : '',
        eveningWell: eveningWell ? eveningWell.value.trim() : '',
        eveningDrain: eveningDrain ? eveningDrain.value.trim() : '',
        differently: diff ? diff.value.trim() : '',
        gratitude: [g0?.value.trim() || '', g1?.value.trim() || '', g2?.value.trim() || '']
    });

    journalRenderMiniCalendar();
    journalRefreshInsights(dateKey);
}

function journalRefreshInsights(dateKey) {
    const sumEl = document.getElementById('journal-auto-summary');
    const taskEl = document.getElementById('journal-task-snapshot');
    const corrEl = document.getElementById('journal-correlation');
    if (sumEl) sumEl.textContent = journalBuildAutoSummary(dateKey);
    if (taskEl) taskEl.textContent = journalTaskSnapshotForDay(dateKey);
    if (corrEl) corrEl.textContent = journalCorrelationText(dateKey);
}

function journalRenderMiniCalendar() {
    const grid = document.getElementById('journal-mini-cal');
    const titleEl = document.getElementById('journal-month-title');
    if (!grid) return;

    const year = journalViewingMonth.getFullYear();
    const month = journalViewingMonth.getMonth();
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    if (titleEl) titleEl.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    let html = '<div class="journal-cal-weekdays">';
    labels.forEach((L) => {
        html += `<span class="journal-cal-wd">${L}</span>`;
    });
    html += '</div><div class="journal-cal-cells">';

    for (let i = 0; i < firstDay; i++) {
        html += '<div class="journal-cal-cell empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = `${year}-${month}-${d}`;
        const je = journalDatabase[dateKey];
        const hasEntry = !!(
            je &&
            (je.body ||
                je.rating ||
                (je.tags && je.tags.length) ||
                je.intention ||
                je.eveningWell ||
                je.eveningDrain ||
                je.differently ||
                (je.gratitude && je.gratitude.some((x) => String(x || '').trim())))
        );
        const isToday =
            d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const isSelected = dateKey === journalSelectedDateKey;

        let cls = 'journal-cal-cell';
        if (isToday) cls += ' today';
        if (isSelected) cls += ' selected';
        html += `<button type="button" class="${cls}" data-date-key="${dateKey}" aria-label="Journal ${d}">${d}`;
        if (hasEntry) html += '<span class="journal-cal-dot"></span>';
        html += '</button>';
    }

    html += '</div>';
    grid.innerHTML = html;

    grid.querySelectorAll('.journal-cal-cell[data-date-key]').forEach((cell) => {
        cell.addEventListener('click', () => {
            const key = cell.getAttribute('data-date-key');
            if (key) {
                journalHydrateForm(key);
                journalRenderMiniCalendar();
            }
        });
    });
}

function journalOnSwitchToTodayView() {
    const quickTa = document.getElementById('journal-today-quick');
    const teaserDate = document.getElementById('journal-teaser-date');
    const tk = getTodayDateKey();
    if (teaserDate) teaserDate.textContent = formatJournalHumanDate(tk);
    if (quickTa) quickTa.value = journalGetEntry(tk).body || '';
}
