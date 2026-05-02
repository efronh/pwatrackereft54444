const TASK_COMPLETED_PRUNE_MS = 10 * 60 * 1000;

function pruneStaleCompletedTasks() {
    if (typeof tasksDatabase === 'undefined' || !tasksDatabase) return false;
    let changed = false;
    const now = Date.now();
    for (const dateKey of Object.keys(tasksDatabase)) {
        const arr = tasksDatabase[dateKey];
        if (!Array.isArray(arr)) continue;
        const next = [];
        for (const t of arr) {
            if (!t) continue;
            if (t.completed) {
                if (t.completedAt == null) {
                    t.completedAt = Date.now();
                    changed = true;
                }
                if (now - t.completedAt >= TASK_COMPLETED_PRUNE_MS) {
                    changed = true;
                    continue;
                }
            }
            next.push(t);
        }
        if (next.length !== arr.length) changed = true;
        if (next.length === 0) delete tasksDatabase[dateKey];
        else tasksDatabase[dateKey] = next;
    }
    return changed;
}

function renderTasks() {
    if (!habitsList || !todayTasksList) return;

    if (typeof tasksDatabase !== 'undefined' && typeof saveTasks === 'function') {
        if (pruneStaleCompletedTasks()) {
            saveTasks();
            if (typeof syncToCloudNow === 'function') syncToCloudNow();
        }
    }
    
    const todayKey = getTodayDateKey();
    
    // Render Habits
    habitsList.innerHTML = '';
    habitsDatabase.forEach((habit, index) => {
        const isCompletedToday = habit.completedDates && habit.completedDates[todayKey];
        
        const item = document.createElement('div');
        item.className = `todo-item ${isCompletedToday ? 'completed' : ''}`;
        
        const checkbox = document.createElement('div');
        checkbox.className = 'todo-checkbox';
        checkbox.innerHTML = '<i class="ph ph-check"></i>';
        checkbox.addEventListener('click', () => {
            if (!habit.completedDates) habit.completedDates = {};
            if (isCompletedToday) {
                delete habit.completedDates[todayKey];
            } else {
                habit.completedDates[todayKey] = true;
            }
            saveHabits();
            renderTasks();
        });
        
        const text = document.createElement('span');
        text.className = 'todo-item-text';
        text.textContent = habit.name;
        
        const deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = '<i class="ph ph-trash"></i>';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.opacity = '0.5';
        deleteBtn.addEventListener('click', () => {
            let idx = index;
            if (habit.id != null) {
                const found = habitsDatabase.findIndex((x) => x && String(x.id) === String(habit.id));
                if (found >= 0) idx = found;
            }
            habitsDatabase.splice(idx, 1);
            saveHabits();
            if (typeof syncToCloudNow === 'function') syncToCloudNow();
            renderTasks();
        });
        
        item.appendChild(checkbox);
        item.appendChild(text);
        item.appendChild(deleteBtn);
        habitsList.appendChild(item);
    });
    
    if (habitsDatabase.length === 0) {
        habitsList.innerHTML = '<p style="font-size:0.9rem; color:var(--text-muted);">No habits added yet.</p>';
    }

    // Render Tasks
    todayTasksList.innerHTML = '';
    
    // Collect all visible tasks
    const visibleTasks = [];
    for (const dateKey in tasksDatabase) {
        const tasksForDate = tasksDatabase[dateKey] || [];
        tasksForDate.forEach((task, index) => {
            if (task.type === 'forever' || dateKey === todayKey) {
                visibleTasks.push({ task, originalDateKey: dateKey, originalIndex: index });
            }
        });
    }
    
    visibleTasks.forEach(({ task, originalDateKey, originalIndex }) => {
        const item = document.createElement('div');
        item.className = `todo-item ${task.completed ? 'completed' : ''}`;
        
        const checkbox = document.createElement('div');
        checkbox.className = 'todo-checkbox';
        checkbox.innerHTML = '<i class="ph ph-check"></i>';
        checkbox.addEventListener('click', () => {
            task.completed = !task.completed;
            if (task.completed) {
                task.completedAt = Date.now();
            } else {
                delete task.completedAt;
            }
            saveTasks();
            renderTasks();
        });
        
        const text = document.createElement('span');
        text.className = 'todo-item-text';
        
        // Add a small indicator for forever tasks
        if (task.type === 'forever') {
            text.innerHTML = `${task.name} <i class="ph ph-infinity" style="font-size: 0.8rem; margin-left: 4px; opacity: 0.5;"></i>`;
        } else {
            text.textContent = task.name;
        }
        
        const deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = '<i class="ph ph-trash"></i>';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.opacity = '0.5';
        deleteBtn.addEventListener('click', () => {
            const arr = tasksDatabase[originalDateKey];
            if (!Array.isArray(arr)) return;
            let idx = originalIndex;
            if (task.id != null) {
                const found = arr.findIndex((x) => x && String(x.id) === String(task.id));
                if (found >= 0) idx = found;
            }
            arr.splice(idx, 1);
            if (arr.length === 0) {
                delete tasksDatabase[originalDateKey];
            }
            saveTasks();
            if (typeof syncToCloudNow === 'function') syncToCloudNow();
            renderTasks();
        });
        
        item.appendChild(checkbox);
        item.appendChild(text);
        item.appendChild(deleteBtn);
        todayTasksList.appendChild(item);
    });
    
    if (visibleTasks.length === 0) {
        todayTasksList.innerHTML = '<p style="font-size:0.9rem; color:var(--text-muted);">No specific tasks found.</p>';
    }
}

function renderTodayEvents() {
    if (!todayDynamicEvents) return;
    todayDynamicEvents.innerHTML = '';
    
    const d = new Date();
    const todayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const dayEvents = calEventsDatabase[todayKey] || {};
    
    const eventsArr = [];
    for (const h in dayEvents) {
        eventsArr.push({
            startFloat: parseFloat(h),
            eventObj: dayEvents[h]
        });
    }
    eventsArr.sort((a, b) => a.startFloat - b.startFloat);
    
    if (eventsArr.length === 0) {
        todayDynamicEvents.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin-top:20px; font-weight:500;">No events scheduled for today. Take a break!</p>`;
        return;
    }
    
    const bgColors = ['orange-bg', 'teal-bg', 'purple-bg', 'pink-bg', 'cyan-bg', 'pink-alt-bg', 'green-alt-bg', 'blue-alt-bg'];
    
    eventsArr.forEach((ev, index) => {
        const startFloat = ev.startFloat;
        let eObj = ev.eventObj;
        
        let durMins = eObj.duration;
        if (typeof eObj === 'string') {
            eObj = { name: eObj, duration: 60 };
            durMins = 60;
        } else if (durMins <= 24) {
            durMins = durMins * 60;
        }
        
        const endFloat = startFloat + (durMins / 60);
        const startStr = formatTimeFromFloat(startFloat);
        const endStr = formatTimeFromFloat(endFloat);
        const colorClass = bgColors[index % bgColors.length];
        
        const card = document.createElement('div');
        card.className = `card task-card ${colorClass}`;
        card.style.cursor = 'pointer';
        
        let noteHtml = '';
        if (eObj.note) {
            noteHtml = `<p style="font-size:0.9rem; opacity:0.8; margin-top:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i class="ph ph-text-align-left"></i> ${eObj.note}</p>`;
        } else {
            noteHtml = `<p style="font-size:0.8rem; opacity:0.6; margin-top:10px;"><i class="ph ph-plus"></i> Tap to add notes</p>`;
        }
        
        card.innerHTML = `
            <div class="card-main">
                <h2>${eObj.name}</h2>
                ${noteHtml}
            </div>
            <div class="card-footer">
                <div class="time-chip">
                    <span class="t-val">${startStr}</span>
                    <span class="t-lbl">Start</span>
                </div>
                <div class="duration-chip">${durMins} Min</div>
                <div class="time-chip end-time">
                    <span class="t-val">${endStr}</span>
                    <span class="t-lbl">End</span>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            openNoteModal(eObj.name, eObj.note, 
            (newNote) => {
                eObj.note = newNote.trim();
                dayEvents[startFloat] = eObj;
                calEventsDatabase[todayKey] = dayEvents;
                saveCalEvents();
                renderTodayEvents();
            },
            () => {
                delete dayEvents[startFloat];
                calEventsDatabase[todayKey] = dayEvents;
                saveCalEvents();
                renderTodayEvents();
            });
        });
        
        todayDynamicEvents.appendChild(card);
    });
}

function renderDayView(year, month, day) {
    const clickedDate = new Date(year, month, day);
    
    // Update date text
    selectedDayName.textContent = clickedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const monthStr = clickedDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    selectedDayNum.innerHTML = `${day.toString().padStart(2, '0')}<br>${monthStr}`;
    
    // Rotate background colors based on day number
    const bgClasses = ['purple-bg', 'pink-bg', 'teal-bg', 'orange-bg', 'cyan-bg', 'pink-alt-bg', 'green-alt-bg', 'blue-alt-bg'];
    selectedDayCard.className = `cal-day-card ${bgClasses[day % bgClasses.length]}`;

    // Store global date state for Quick Add
    selectedYearVal = year;
    selectedMonthVal = month;
    selectedDayVal = day;
    selectedDateKey = `${year}-${month}-${day}`;

    // Read Events from Local Database
    const dateKey = selectedDateKey;
    const dayEvents = calEventsDatabase[dateKey] || {};

    selectedDayTimeline.innerHTML = '';
    let scrollAnchor = null;
    let skipUntil = -1; // Track which hours to skip if covered by an event block

    // Render 48 Half-Hours (30-minute resolution)
    for (let h = 0; h < 24; h += 0.5) {
        const slot = document.createElement('div');
        
        let isHalf = h % 1 !== 0;
        let baseH = Math.floor(h);
        let ampm = baseH >= 12 ? 'pm' : 'am';
        let displayH = baseH % 12 || 12;
        let minuteStr = isHalf ? ':30' : ':00';

        // Add class 'half-hour' to style the 30min labels slightly smaller if needed
        const hourStr = `<span class="t-hour ${isHalf ? 't-half' : ''}">${displayH}${minuteStr} ${ampm}</span>`;
        let contentStr = '';
        
        // Handle Legacy Data (convert string "Event" to object {name:"Event", duration:60 mins})
        // NOTE: Legacy keys were integers (e.g., 9). They still map perfectly to baseH if it exists!
        let eventObj = dayEvents[h];
        if (typeof eventObj === 'string') {
            eventObj = { name: eventObj, duration: 60 };
        } else if (eventObj && eventObj.duration <= 24) {
            // Legacy conversion: hour units to minutes
            eventObj.duration = eventObj.duration * 60;
        }

        if (eventObj && h > skipUntil) {
            slot.className = `timeline-slot slot-active`;
            
            // Calculate height. dur is in minutes
            // 30 mins = 1 slot (56px total distance: 40px slot + 16px gap)
            const dur = eventObj.duration;
            const slotsCovered = dur / 30;
            const pxHeight = Math.max(24, (slotsCovered * 56) - 16);
            
            contentStr = `<div class="event-pill dark-pill" style="height: ${pxHeight}px;" draggable="true">${eventObj.name}</div>`;
            
            // Block subsequent slots covered by this event
            skipUntil = h + (dur / 60) - 0.0001;

        } else if (h <= skipUntil) {
            // Covered by previous multi-hour event block
            slot.className = `timeline-slot`;
            contentStr = ``; // No add button
        } else {
            // Empty slot available
            slot.className = `timeline-slot`;
            contentStr = `<div class="event-add"><i class="ph ph-plus-circle"></i></div>`;
        }
        
        slot.innerHTML = hourStr + contentStr;
        
        // DRAG AND DROP ZONE LOGIC
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            slot.classList.add('drag-over');
        });
        slot.addEventListener('dragleave', () => {
            slot.classList.remove('drag-over');
        });
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            if (draggedHour !== null && draggedHour !== h) {
                // Swap events
                const temp = dayEvents[h];
                dayEvents[h] = dayEvents[draggedHour];
                if (temp) {
                    dayEvents[draggedHour] = temp;
                } else {
                    delete dayEvents[draggedHour];
                }
                calEventsDatabase[dateKey] = dayEvents;
                saveCalEvents();
                renderDayView(year, month, day);
            }
            draggedHour = null;
        });

        // PILL & CLICK LOGIC
        const pillEl = slot.querySelector('.event-pill');
        if (pillEl) {
            pillEl.addEventListener('dragstart', (e) => {
                draggedHour = h;
                e.dataTransfer.effectAllowed = 'move';
            });
            pillEl.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent triggering slot click
                openEventModal(`Edit ${displayH}${minuteStr} ${ampm}`, eventObj.name, eventObj.duration, 
                (val, durVal) => {
                    const eventName = val.trim();
                    if (eventName === '') {
                        delete dayEvents[h]; 
                    } else {
                        dayEvents[h] = { name: eventName, duration: durVal };
                    }
                    calEventsDatabase[dateKey] = dayEvents;
                    saveCalEvents();
                    renderDayView(year, month, day);
                },
                () => {
                    delete dayEvents[h];
                    calEventsDatabase[dateKey] = dayEvents;
                    saveCalEvents();
                    renderDayView(year, month, day);
                });
            });
        } else if (h > skipUntil) {
            slot.addEventListener('click', () => {
                openEventModal(`Enter event for ${displayH}${minuteStr} ${ampm}:`, '', 30, (val, durVal) => {
                    const eventName = val.trim();
                    if (eventName !== '') {
                        dayEvents[h] = { name: eventName, duration: durVal };
                        calEventsDatabase[dateKey] = dayEvents;
                        saveCalEvents();
                        renderDayView(year, month, day);
                    }
                });
            });
        }
        if (h === 6) scrollAnchor = slot;

        selectedDayTimeline.appendChild(slot);
    }
    
    // Auto-scroll to 6 AM (sabah 6)
    if (scrollAnchor) {
        setTimeout(() => {
            selectedDayTimeline.scrollTop = scrollAnchor.offsetTop - selectedDayTimeline.offsetTop - 10;
        }, 10);
    }
}

function renderCalendarMonth() {
    const year = viewingDate.getFullYear();
    const month = viewingDate.getMonth(); // 0-indexed
    
    // Update header string
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    if (calMonthTitle) calMonthTitle.textContent = `${monthNames[month]} ${year}`;

    // Calculate start day and total days
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Clear old cells but keep header labels
    const labelsStr = `
        <div class="day-label">S</div><div class="day-label">M</div><div class="day-label">T</div>
        <div class="day-label">W</div><div class="day-label">T</div><div class="day-label">F</div><div class="day-label">S</div>
    `;
    if (calMonthGrid) calMonthGrid.innerHTML = labelsStr;
    
    // Insert empty padding for the first week
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cal-cell empty';
        calMonthGrid.appendChild(emptyCell);
    }
    
    // Insert days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        
        // Add click listener to open Day View!
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => {
            renderDayView(year, month, i);
            switchCalendarMode('Day');
        });

        // Highlight actual real-world today
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            cell.classList.add('active-day');
        }
        cell.textContent = i;
        
        const loopDateKey = `${year}-${month}-${i}`;
        const dayEvents = calEventsDatabase[loopDateKey];
        const hasEvents = dayEvents && Object.keys(dayEvents).length > 0;
        const hasJournal =
            typeof journalDayHasEntry === 'function' && journalDayHasEntry(loopDateKey);
        if (hasEvents || hasJournal) {
            const dot = document.createElement('div');
            dot.className = 'indicator-dot';
            cell.appendChild(dot);
        }
        
        calMonthGrid.appendChild(cell);
    }
}

function switchCalendarMode(mode) {
    calModeBtns.forEach(b => b.classList.remove('active'));
    
    if(calMonthGrid) calMonthGrid.style.display = 'none';
    if(calDayView) calDayView.style.display = 'none';
    if(calWeekView) calWeekView.style.display = 'none';
    
    if (mode === 'Month') {
        if(calMonthGrid) calMonthGrid.style.display = 'grid';
        calModeBtns[0].classList.add('active'); 
    } else if (mode === 'Week') {
        if(calWeekView) calWeekView.style.display = 'block';
        calModeBtns[1].classList.add('active');
        renderWeekView();
    } else if (mode === 'Day') {
        if(calDayView) calDayView.style.display = 'block';
        calModeBtns[2].classList.add('active');
    }
}

function saveCalEvents() {
    if (typeof persistMirror === 'function') persistMirror('calEventsDatabase', calEventsDatabase);
    syncToCloud();
}

function openEventModal(title, defaultVal, defaultDur, onSave, onDelete) {
    eventModalTitle.textContent = title;
    eventModalInput.value = defaultVal;
    if(eventModalDuration) eventModalDuration.value = defaultDur || 1;
    eventModalOverlay.classList.remove('hidden-view');
    eventModalInput.focus();
    pendingEventSave = onSave;
    pendingEventDelete = onDelete;
}

function closeEventModal() {
    eventModalOverlay.classList.add('hidden-view');
    pendingEventSave = null;
    pendingEventDelete = null;
}

function openNoteModal(eventName, defaultNote, onSave, onDelete) {
    noteModalTitle.textContent = `${eventName} Notes`;
    noteModalInput.value = defaultNote || '';
    pendingNoteSaveCallback = onSave;
    pendingNoteDeleteCallback = onDelete;
    noteModalOverlay.classList.remove('hidden-view');
    noteModalInput.focus();
}

setInterval(() => {
    if (typeof tasksDatabase === 'undefined' || typeof saveTasks !== 'function') return;
    if (pruneStaleCompletedTasks()) {
        saveTasks();
        if (typeof syncToCloudNow === 'function') syncToCloudNow();
        if (typeof renderTasks === 'function') renderTasks();
    }
}, 60000);

