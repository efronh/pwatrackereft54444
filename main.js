// Initialize
(async () => {
    const didReset = await hardResetUserDataIfRequested();
    if (didReset) return;

    updateGreeting(localStorage.getItem('preferredUsername'));
    loadWaterData();
    renderTasks();
    renderTodayEvents();
    renderCalendarMonth();
    renderMood();
    initAuthGate();
})();