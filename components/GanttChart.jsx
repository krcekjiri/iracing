const GanttChart = ({ scheduleItems, raceStartGMT, actualEndTimes, actualLaps, raceDurationMinutes }) => {
  if (!scheduleItems?.length || !raceStartGMT) return null;

  const svgRef = useRef(null);
  const wrapperRef = useRef(null);
  const [hover, setHover] = useState(null);

  // Calculate total duration from first start to last end (planned or actual)
  const lastItem = scheduleItems[scheduleItems.length - 1];
  const lastEndTime = actualEndTimes[lastItem?.id] || lastItem?.endTime;
  const totalDuration = lastEndTime?.getTime() - raceStartGMT.getTime();
  
  if (!totalDuration || totalDuration <= 0) return null;

  const width = 1200;
  const height = scheduleItems.length * 32 + 140; // Increased for race duration axis
  const barStart = 120;
  const barWidth = width - barStart - 120;
  const barHeight = 20;
  const gap = 8;
  const UNASSIGNED_COLOR = '#6b7280';
  const topAxisY = 30;
  const bottomAxisY = height - 30;

  const handleHover = (payload) => (event) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    setHover({
      ...payload,
      x: bounds ? event.clientX - bounds.left : 0,
      y: bounds ? event.clientY - bounds.top : 0,
    });
  };

  const clearHover = () => setHover(null);

  // Generate time axis labels (GMT/UTC)
  const timeLabels = [];
  const labelCount = 6;
  for (let i = 0; i <= labelCount; i++) {
    const timeOffset = (totalDuration * i) / labelCount;
    const time = addSeconds(raceStartGMT, timeOffset / 1000);
    timeLabels.push({
      time,
      x: barStart + (barWidth * i) / labelCount,
      label: formatDateTime(time, 'UTC').split(',')[1].trim(),
    });
  }
  
  // Generate race duration axis labels (elapsed time)
  const raceDurationLabels = [];
  if (raceDurationMinutes) {
    const raceDurationSeconds = raceDurationMinutes * 60;
    for (let i = 0; i <= labelCount; i++) {
      const elapsedSeconds = (raceDurationSeconds * i) / labelCount;
      const hours = Math.floor(elapsedSeconds / 3600);
      const minutes = Math.floor((elapsedSeconds % 3600) / 60);
      const seconds = Math.floor(elapsedSeconds % 60);
      let label;
      if (hours > 0) {
        label = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      } else {
        label = `${minutes}:${String(seconds).padStart(2, '0')}`;
      }
      raceDurationLabels.push({
        elapsedSeconds,
        x: barStart + (barWidth * i) / labelCount,
        label,
      });
    }
  }

  return (
    <div className="graph-wrapper" ref={wrapperRef} onMouseLeave={clearHover} style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: '1rem' }}>Plan vs. Reality</h4>
        <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#1ea7ff', marginRight: 4, borderRadius: 2 }} />
            Planned
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#10b981', marginRight: 4, borderRadius: 2 }} />
            Actual
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Gantt chart showing planned vs actual stints"
        className="strategy-graph"
        ref={svgRef}
        style={{ width: '100%', height: 'auto' }}
      >
        {/* Top time axis (GMT/UTC) */}
        <line x1={barStart} y1={topAxisY} x2={barStart + barWidth} y2={topAxisY} stroke="var(--border)" strokeWidth={1} />
        {timeLabels.map((label, idx) => (
          <g key={`top-${idx}`}>
            <line x1={label.x} y1={topAxisY} x2={label.x} y2={topAxisY + 5} stroke="var(--border)" strokeWidth={1} />
            <text x={label.x} y={topAxisY + 18} className="graph-label" style={{ fontSize: '0.7rem', textAnchor: 'middle' }}>
              {label.label}
            </text>
          </g>
        ))}
        {/* GMT/UTC label - positioned at top right */}
        <text x={barStart + barWidth - 10} y={topAxisY + 18} className="graph-label" style={{ fontSize: '0.65rem', textAnchor: 'end', fill: 'var(--text-muted)' }}>
          GMT/UTC
        </text>
        
        {/* Bottom race duration axis */}
        {raceDurationLabels.length > 0 && (
          <>
            <line x1={barStart} y1={bottomAxisY} x2={barStart + barWidth} y2={bottomAxisY} stroke="var(--border)" strokeWidth={1} />
            {raceDurationLabels.map((label, idx) => (
              <g key={`bottom-${idx}`}>
                <line x1={label.x} y1={bottomAxisY} x2={label.x} y2={bottomAxisY - 5} stroke="var(--border)" strokeWidth={1} />
                <text x={label.x} y={bottomAxisY - 8} className="graph-label" style={{ fontSize: '0.7rem', textAnchor: 'middle' }}>
                  {label.label}
                </text>
              </g>
            ))}
            {/* Race Duration label - positioned at bottom right */}
            <text x={barStart + barWidth - 10} y={bottomAxisY - 8} className="graph-label" style={{ fontSize: '0.65rem', textAnchor: 'end', fill: 'var(--text-muted)' }}>
              Elapsed
            </text>
          </>
        )}

        {scheduleItems.map((item, idx) => {
          const plannedStartOffset = item.startTime.getTime() - raceStartGMT.getTime();
          const plannedDuration = item.endTime.getTime() - item.startTime.getTime();
          const plannedStartX = barStart + (plannedStartOffset / totalDuration) * barWidth;
          const plannedWidth = Math.max((plannedDuration / totalDuration) * barWidth, 2);
          
          const actualEndTime = actualEndTimes[item.id];
          const actualLapsRun = actualLaps[item.id];
          const actualDuration = actualEndTime 
            ? actualEndTime.getTime() - item.startTime.getTime()
            : null;
          const actualWidth = actualDuration ? Math.max((actualDuration / totalDuration) * barWidth, 2) : null;
          
          const y = topAxisY + 30 + idx * (barHeight + gap);
          const driverColor = item.driver?.color || UNASSIGNED_COLOR;
          const isUnassigned = !item.driver;
          
          // Calculate deltas
          const timeDelta = actualDuration ? (actualDuration - plannedDuration) / 1000 : null;
          const lapsDelta = actualLapsRun !== undefined && actualLapsRun !== null 
            ? actualLapsRun - item.laps 
            : null;
          
          return (
            <g key={item.id}>
              <text x={0} y={y + barHeight - 4} className="graph-label" style={{ fontSize: '0.8rem', fill: isUnassigned ? UNASSIGNED_COLOR : driverColor }}>
                Stint {item.id}{item.driver?.name ? ` - ${item.driver.name}` : ''}
              </text>
              
              {/* Planned bar */}
              <rect
                x={plannedStartX}
                y={y}
                width={plannedWidth}
                height={barHeight}
                fill={isUnassigned ? UNASSIGNED_COLOR : '#1ea7ff'}
                opacity={1}
                rx={2}
                onMouseMove={handleHover({
                  type: 'planned',
                  stintId: item.id,
                  driverName: item.driver?.name,
                  startTime: formatDateTime(item.startTime, 'UTC'),
                  endTime: formatDateTime(item.endTime, 'UTC'),
                  duration: formatDuration(plannedDuration / 1000),
                  laps: item.laps,
                })}
                style={{ cursor: 'pointer' }}
              />
              
              {/* Actual bar (overlay) */}
              {actualWidth && (
                <rect
                  x={plannedStartX}
                  y={y}
                  width={actualWidth}
                  height={barHeight}
                  fill={isUnassigned ? UNASSIGNED_COLOR : '#10b981'}
                  opacity={1}
                  rx={2}
                  stroke={timeDelta && Math.abs(timeDelta) > 5 ? (timeDelta > 0 ? '#ef4444' : '#f59e0b') : 'transparent'}
                  strokeWidth={2}
                  onMouseMove={handleHover({
                    type: 'actual',
                    stintId: item.id,
                    driverName: item.driver?.name,
                    startTime: formatDateTime(item.startTime, 'UTC'),
                    endTime: formatDateTime(actualEndTime, 'UTC'),
                    duration: formatDuration(actualDuration / 1000),
                    laps: actualLapsRun || item.laps,
                    timeDelta: timeDelta ? roundTo(timeDelta, 1) : null,
                    lapsDelta: lapsDelta,
                  })}
                  style={{ cursor: 'pointer' }}
                />
              )}
              
              {/* Delta indicator */}
              {timeDelta !== null && Math.abs(timeDelta) > 1 && (
                <text
                  x={plannedStartX + Math.max(plannedWidth, actualWidth || 0) + 6}
                  y={y + barHeight - 4}
                  className="graph-value"
                  style={{ 
                    fontSize: '0.7rem',
                    fill: timeDelta > 0 ? '#ef4444' : '#10b981'
                  }}
                >
                  {timeDelta > 0 ? '+' : ''}{roundTo(timeDelta, 1)}s
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover ? (
        <div className="graph-tooltip" style={{ left: hover.x, top: hover.y }}>
          <strong style={{ marginBottom: 8, display: 'block' }}>
            {hover.type === 'planned' ? 'Planned' : 'Actual'} Stint {hover.stintId}
            {hover.driverName ? ` (${hover.driverName})` : ''}
          </strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
            <div><strong>Start Time:</strong> {hover.startTime}</div>
            <div><strong>End Time:</strong> {hover.endTime}</div>
            <div><strong>Duration:</strong> {hover.duration}</div>
            <div><strong>Laps:</strong> {hover.laps} lap{hover.laps > 1 ? 's' : ''}</div>
            {hover.type === 'actual' && hover.timeDelta !== null && (
              <div><strong>Time Delta:</strong> {hover.timeDelta > 0 ? '+' : ''}{hover.timeDelta}s</div>
            )}
            {hover.type === 'actual' && hover.lapsDelta !== null && (
              <div><strong>Laps Delta:</strong> {hover.lapsDelta > 0 ? '+' : ''}{hover.lapsDelta} lap{Math.abs(hover.lapsDelta) > 1 ? 's' : ''}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
