window.StatsChart = (() => {
  let chartRoot = null;

  function renderFallback(containerEl, series) {
    const width = 320;
    const height = 210;
    const padL = 28;
    const padR = 10;
    const padT = 14;
    const padB = 26;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const maxY = Math.max(2000, ...series.map((s) => s.water || 0));
    const stepX = series.length > 1 ? innerW / (series.length - 1) : innerW;
    const targetY = padT + innerH - (2000 / maxY) * innerH;

    const points = series.map((item, idx) => {
      const x = padL + (idx * stepX);
      const y = padT + innerH - ((item.water || 0) / maxY) * innerH;
      return { x, y, day: item.day, water: item.water || 0 };
    });

    const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const yTicks = [0, Math.round(maxY / 2), maxY];

    containerEl.innerHTML = `
      <div class="stats-chart-fallback">
        <svg viewBox="0 0 ${width} ${height}" class="stats-fallback-svg" role="img" aria-label="Weekly water chart">
          ${yTicks.map((t) => {
            const y = padT + innerH - (t / maxY) * innerH;
            return `
              <line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="#eef2f5" stroke-width="1" />
              <text x="${padL - 4}" y="${y + 3}" text-anchor="end" fill="#bcc5cc" font-size="9">${t}</text>
            `;
          }).join('')}
          <line x1="${padL}" y1="${targetY}" x2="${width - padR}" y2="${targetY}" stroke="#c9d2d9" stroke-width="1" stroke-dasharray="4 3" />
          <text x="${width - padR}" y="${targetY - 4}" text-anchor="end" fill="#b3bcc4" font-size="9">2000 ml</text>
          <polyline points="${polyline}" fill="none" stroke="#7fd8e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          ${points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.8" fill="#7fd8e5"><title>${p.day}: ${p.water} ml</title></circle>`).join('')}
          ${points.map((p) => `<text x="${p.x}" y="${height - 8}" text-anchor="middle" fill="#9aa3aa" font-size="10">${p.day}</text>`).join('')}
        </svg>
      </div>
    `;
  }

  function render(containerEl, series) {
    if (!containerEl) return;

    if (!window.React || !window.ReactDOM || !window.Recharts) {
      renderFallback(containerEl, series);
      return;
    }

    try {
      const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } = window.Recharts;
      if (!chartRoot) {
        chartRoot = window.ReactDOM.createRoot(containerEl);
      }

      const chartEl = window.React.createElement(
        ResponsiveContainer,
        { width: '100%', height: 210 },
        window.React.createElement(
          LineChart,
          { data: series, margin: { top: 10, right: 8, left: 0, bottom: 8 } },
          window.React.createElement(CartesianGrid, { strokeDasharray: '2 4', stroke: '#eef2f5', vertical: false }),
          window.React.createElement(XAxis, {
            dataKey: 'day',
            axisLine: false,
            tickLine: false,
            tick: { fill: '#9aa3aa', fontSize: 11 }
          }),
          window.React.createElement(YAxis, {
            yAxisId: 'left',
            axisLine: false,
            tickLine: false,
            tick: { fill: '#b2bcc4', fontSize: 10 },
            width: 42
          }),
          window.React.createElement(YAxis, {
            yAxisId: 'right',
            orientation: 'right',
            axisLine: false,
            tickLine: false,
            tick: { fill: '#b2bcc4', fontSize: 10 },
            width: 20
          }),
          window.React.createElement(ReferenceLine, {
            yAxisId: 'left',
            y: 2000,
            stroke: '#c9d2d9',
            strokeDasharray: '4 3',
            ifOverflow: 'extendDomain',
            label: { value: '2000 ml', position: 'insideTopLeft', fill: '#b3bcc4', fontSize: 10 }
          }),
          window.React.createElement(Tooltip, {
            formatter: (value, name) => {
              if (name === 'water') return [`${value} ml`, 'Water'];
              if (name === 'coffee') return [`${value} cups`, 'Coffee'];
              return [value, name];
            },
            contentStyle: { borderRadius: '12px', border: 'none', boxShadow: '0 8px 22px rgba(0,0,0,0.12)' }
          }),
          window.React.createElement(Line, {
            yAxisId: 'left',
            type: 'monotone',
            dataKey: 'water',
            stroke: '#7fd8e5',
            strokeWidth: 2.5,
            dot: { r: 2.4, fill: '#7fd8e5', strokeWidth: 0 },
            activeDot: { r: 5 }
          }),
          window.React.createElement(Line, {
            yAxisId: 'right',
            type: 'monotone',
            dataKey: 'coffee',
            stroke: '#A0522D',
            strokeWidth: 2.5,
            dot: { r: 2.4, fill: '#A0522D', strokeWidth: 0 },
            activeDot: { r: 5 }
          })
        )
      );

      chartRoot.render(chartEl);
    } catch (error) {
      console.error('Chart render failed, using fallback:', error);
      renderFallback(containerEl, series);
    }
  }

  return { render };
})();
