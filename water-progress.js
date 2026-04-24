window.WaterProgress = (() => {
  function compute(current, goal) {
    const safeGoal = Math.max(1, Number(goal) || 2000);
    const safeCurrent = Math.max(0, Number(current) || 0);
    const completedCycles = Math.floor(safeCurrent / safeGoal);
    const remainder = safeCurrent % safeGoal;
    const visualProgress = (safeCurrent > 0 && remainder === 0) ? safeGoal : remainder;
    const percentage = Math.max(0, Math.min(100, (visualProgress / safeGoal) * 100));
    const toneColor = completedCycles >= 1 ? '#2F7594' : '#97CADB';

    return {
      percentage,
      toneColor
    };
  }

  return { compute };
})();
