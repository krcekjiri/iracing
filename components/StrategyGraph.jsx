const StrategyGraph = ({ plan, perStopLoss }) => {
  if (!plan?.length) return null;

  // Calculate cumulative laps for each stint
  let cumulativeLaps = 0;
  const rows = plan.map((stint, idx) => {
    cumulativeLaps += stint.laps;
    return {
      id: stint.id,
      trackSeconds: stint.stintDuration,
      pitSeconds: idx < plan.length - 1 ? (stint.perStopLoss || perStopLoss) : 0,
      laps: stint.laps,
      cumulativeLaps: cumulativeLaps,
      startLap: cumulativeLaps - stint.laps + 1,
    };
  });
  const svgRef = useRef(null);
  const wrapperRef = useRef(null);
  const [hover, setHover] = useState(null);

  const maxTotal = Math.max(...rows.map((row) => row.trackSeconds + row.pitSeconds));
  const width = 1000; // Increased to accommodate labels outside bars
  const height = rows.length * 40 + 70;
  const barHeight = 18;
  const gap = 18;
  const barStart = 100;
  const barWidth = width - barStart - 80;

  const handleHover = (payload) => (event) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    setHover({
      ...payload,
      x: bounds ? event.clientX - bounds.left : 0,
      y: bounds ? event.clientY - bounds.top : 0,
    });
  };

  const clearHover = () => setHover(null);

  return (
    <div className="graph-wrapper" ref={wrapperRef} onMouseLeave={clearHover}>
      <div className="graph-legend">
        <span>
          <span className="legend-dot track" />
          On-track time
        </span>
        <span>
          <span className="legend-dot pit" />
          Pit lane + service
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Stint and pit time comparison"
        className="strategy-graph"
        ref={svgRef}
      >
        {rows.map((row, idx) => {
          const trackWidth = (row.trackSeconds / maxTotal) * barWidth;
          const pitWidth = (row.pitSeconds / maxTotal) * barWidth;
          const trackRectWidth = Math.max(trackWidth, 4);
          const pitRectWidth = Math.max(pitWidth, row.pitSeconds > 0 ? 4 : 0);
          const y = idx * (barHeight + gap) + 30;
          const lapCount = Math.max(row.laps, 1);
          const avgLapFormatted = lapCount ? formatLapTime(row.trackSeconds / lapCount) : '--';
          const totalSeconds = row.trackSeconds + row.pitSeconds;
          // Position label outside bars on the right
          const labelX = barStart + barWidth + 12;
          return (
            <g key={row.id}>
              <text x={0} y={y + barHeight - 2} className="graph-label">
                Stint {row.id}
              </text>
              <rect
                x={barStart}
                y={y}
                width={trackRectWidth}
                height={barHeight}
                className="graph-track"
                onMouseMove={handleHover({
                  type: 'track',
                  stintId: row.id,
                  duration: formatDuration(row.trackSeconds),
                  laps: lapCount,
                  startLap: row.startLap,
                  endLap: row.startLap + row.laps - 1,
                  cumulativeLaps: row.cumulativeLaps,
                  avgLap: avgLapFormatted,
                })}
              />
              {row.pitSeconds > 0 ? (
                <rect
                  x={barStart + trackRectWidth}
                  y={y}
                  width={pitRectWidth}
                  height={barHeight}
                  className="graph-pit"
                  onMouseMove={handleHover({
                    type: 'pit',
                    stintId: row.id,
                    pitTime: `${roundTo(row.pitSeconds, 1)}s`,
                  })}
                />
              ) : null}
              <text
                x={labelX}
                y={y + barHeight - 3}
                className="graph-value"
              >
                {formatDuration(totalSeconds)}
              </text>
            </g>
          );
        })}
      </svg>
      {hover ? (
        <div className="graph-tooltip" style={{ left: hover.x, top: hover.y }}>
          <strong style={{ marginBottom: 8, display: 'block' }}>
            {hover.type === 'track' ? 'On Track' : 'Pit Lane'} - Stint {hover.stintId}
          </strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
            {hover.type === 'track' ? (
              <>
                <div><strong>Duration:</strong> {hover.duration}</div>
                <div><strong>Laps:</strong> {hover.startLap}–{hover.endLap} ({hover.laps} lap{hover.laps > 1 ? 's' : ''})</div>
                <div><strong>Cumulative:</strong> {hover.cumulativeLaps} laps</div>
                <div><strong>Avg Lap:</strong> {hover.avgLap}</div>
              </>
            ) : (
              <div><strong>Pit Time:</strong> {hover.pitTime}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
