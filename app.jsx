const { useState, useMemo, useRef, useEffect } = React;

const defaultForm = {
  raceDurationMinutes: 180,
  averageLapTime: '02:03.900',
  fuelPerLap: 3.43,
  fuelSavingLapTime: '02:04.200',
  fuelSavingFuelPerLap: 3.32,
  tankCapacity: 100,
  fuelReserveLiters: 0.3,
  pitLaneDeltaSeconds: 23,
  stationaryServiceSeconds: 41,
  formationLapFuel: 1,
  minLapsPerStint: '',
  maxLapsPerStint: '',
  outLapPenaltyOutLap: 4.5,
  outLapPenaltyLap1: 2.5,
  outLapPenaltyLap2: 1,
  outLapPenaltyLap3: 0.5,
};

const roundTo = (value, decimals = 1) =>
  Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);

const parseNumber = (value) => (value === '' ? '' : Number(value));

const parseLapTime = (value) => {
  if (!value) return null;
  const clean = value.trim();
  if (!clean) return null;
  const parts = clean.split(':');
  let multiplier = 1;
  let seconds = 0;

  while (parts.length) {
    const part = parts.pop();
    const num = Number(part);
    if (Number.isNaN(num)) return null;
    seconds += num * multiplier;
    multiplier *= 60;
  }

  return seconds;
};

const formatDuration = (seconds, showMs = false) => {
  if (!Number.isFinite(seconds)) return '--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const secString = showMs
    ? secs.toFixed(3).padStart(6, '0')
    : secs.toFixed(0).padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${secString}`;
  }

  return `${mins}:${secString}`;
};

const formatLapTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs.toFixed(3)).padStart(6, '0')}`;
};

const formatLapTimeRounded = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs.toFixed(0)).padStart(2, '0')}.000`;
};

const safeNumber = (value) =>
  value === '' || Number.isNaN(Number(value)) ? null : Number(value);

// Timezone and time conversion utilities
const getTimezoneOffset = (timezone) => {
  try {
    const now = new Date();
    const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const local = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return (local.getTime() - utc.getTime()) / (1000 * 60 * 60); // hours
  } catch {
    return 0;
  }
};

const formatDateTime = (date, timezone = 'UTC') => {
  if (!date) return '--';
  try {
    return new Date(date).toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '--';
  }
};

const parseTimeOnly = (timeStr) => {
  if (!timeStr) return null;
  try {
    const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
    // Use today's date in UTC
    const today = new Date();
    const date = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
      hours,
      minutes,
      seconds
    ));
    return date;
  } catch {
    return null;
  }
};

const addSeconds = (date, seconds) => {
  if (!date) return null;
  return new Date(date.getTime() + seconds * 1000);
};

const getCommonTimezones = () => [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'EST/EDT (Eastern Time)' },
  { value: 'America/Chicago', label: 'CST/CDT (Central Time)' },
  { value: 'America/Denver', label: 'MST/MDT (Mountain Time)' },
  { value: 'America/Los_Angeles', label: 'PST/PDT (Pacific Time)' },
  { value: 'Europe/London', label: 'GMT/BST (UK)' },
  { value: 'Europe/Paris', label: 'CET/CEST (Central Europe)' },
  { value: 'Europe/Berlin', label: 'CET/CEST (Germany)' },
  { value: 'Asia/Tokyo', label: 'JST (Japan)' },
  { value: 'Australia/Sydney', label: 'AEDT/AEST (Sydney)' },
];

const computePlan = (form, strategyMode = 'standard') => {
  // Select lap time and fuel based on strategy mode
  let lapTime, fuelPerLap;
  if (strategyMode === 'fuel-saving') {
    lapTime = form.fuelSavingLapTime || form.averageLapTime;
    fuelPerLap = safeNumber(form.fuelSavingFuelPerLap) || safeNumber(form.fuelPerLap);
  } else {
    lapTime = form.averageLapTime;
    fuelPerLap = safeNumber(form.fuelPerLap);
  }
  
  const lapSeconds = parseLapTime(lapTime);
  const tankCapacity = safeNumber(form.tankCapacity);
  const reserveLiters = safeNumber(form.fuelReserveLiters ?? 0) ?? 0;
  const pitLaneDelta = safeNumber(form.pitLaneDeltaSeconds) || 0;
  const stationaryService = safeNumber(form.stationaryServiceSeconds) || 0;
  const formationLapFuel = safeNumber(form.formationLapFuel) || 0;
  const outLapPenalties = [
    safeNumber(form.outLapPenaltyOutLap),
    safeNumber(form.outLapPenaltyLap1),
    safeNumber(form.outLapPenaltyLap2),
    safeNumber(form.outLapPenaltyLap3),
  ].map((val) => (Number.isFinite(val) && val > 0 ? val : 0));
  const minLapsPerStint = safeNumber(form.minLapsPerStint);
  const maxLapsPerStint = safeNumber(form.maxLapsPerStint);

  const errors = [];

  if (!lapSeconds || lapSeconds <= 0) {
    errors.push('Provide a valid average lap time.');
  }

  if (!fuelPerLap || fuelPerLap <= 0) {
    errors.push('Fuel usage per lap must be greater than zero.');
  }

  if (!tankCapacity || tankCapacity <= 0) {
    errors.push('Tank capacity must be greater than zero.');
  }

  if (!form.raceDurationMinutes || form.raceDurationMinutes <= 0) {
    errors.push('Race duration must be greater than zero.');
  }

  if (errors.length) {
    return { errors };
  }

  // Max race time = duration + one lap time (leader can start final lap before timer hits zero)
  const raceDurationSeconds = Number(form.raceDurationMinutes || 0) * 60;
  const maxRaceTimeSeconds = raceDurationSeconds + lapSeconds;

  let lapsPerStint = Math.floor(tankCapacity / fuelPerLap);

  if (maxLapsPerStint && maxLapsPerStint > 0) {
    lapsPerStint = Math.min(lapsPerStint, Math.floor(maxLapsPerStint));
  }

  lapsPerStint = Math.max(1, lapsPerStint);

  // FIRST: Simulate lap-by-lap to find when timer hits zero (before building stint plan)
  // This gives us the actual totalLaps we can complete
  let simulatedTime = 0;
  let simulatedLaps = 0;
  let fractionalLapsAtZero = 0;
  let fullLapsForPlanning = 0;
  let estimatedPitTime = 0;
  
  // Estimate pit time per stop (will be refined when we build actual stints)
  const estimatedFuelingTime = 41; // Full tank
  const estimatedPerStopLoss = pitLaneDelta + estimatedFuelingTime;
  
  // Simulate lap by lap until timer hits zero
  while (simulatedTime < raceDurationSeconds) {
    // Determine which lap we're on (for outlap penalties)
    const lapNumber = simulatedLaps + 1;
    let lapTime = lapSeconds;
    
    // Apply outlap penalties for first few laps of race
    if (lapNumber <= outLapPenalties.length && outLapPenalties[lapNumber - 1]) {
      lapTime += outLapPenalties[lapNumber - 1];
    }
    
    // Check if adding this lap would exceed race duration
    if (simulatedTime + lapTime > raceDurationSeconds) {
      // Calculate fractional laps at the moment timer hits zero
      const timeIntoCurrentLap = simulatedTime + lapTime - raceDurationSeconds;
      const fractionOfLap = timeIntoCurrentLap / lapTime;
      fractionalLapsAtZero = simulatedLaps + (1 - fractionOfLap);
      
      // Full laps for planning = all completed laps + 1 final lap (white flag rule)
      fullLapsForPlanning = simulatedLaps + 1;
      break;
    }
    
    simulatedTime += lapTime;
    simulatedLaps += 1;
    
    // Check if we need a pit stop (every lapsPerStint laps, except last stint)
    if (simulatedLaps > 0 && simulatedLaps % lapsPerStint === 0) {
      // Add pit stop time
      simulatedTime += estimatedPerStopLoss;
      estimatedPitTime += estimatedPerStopLoss;
      
      // Check if timer hits zero during pit stop
      if (simulatedTime >= raceDurationSeconds) {
        fractionalLapsAtZero = simulatedLaps;
        fullLapsForPlanning = simulatedLaps + 1; // Still finish one more lap
        break;
      }
    }
  }
  
  // If we didn't hit the limit, calculate from remaining time
  if (fractionalLapsAtZero === 0 && fullLapsForPlanning === 0) {
    const timeRemaining = raceDurationSeconds - simulatedTime;
    if (timeRemaining > 0) {
      const additionalLaps = timeRemaining / lapSeconds;
      fractionalLapsAtZero = simulatedLaps + additionalLaps;
      fullLapsForPlanning = simulatedLaps + Math.ceil(additionalLaps);
      if (additionalLaps > 0 && additionalLaps < 1) {
        fullLapsForPlanning = simulatedLaps + 1;
      }
    } else {
      fractionalLapsAtZero = simulatedLaps;
      fullLapsForPlanning = simulatedLaps + 1;
    }
  }
  
  // Use the simulated totalLaps for planning
  const totalLaps = fullLapsForPlanning > 0 ? fullLapsForPlanning : Math.ceil(fractionalLapsAtZero);
  const totalFuelNeeded = totalLaps * fuelPerLap;

  // NOW calculate stint count based on the correct totalLaps
  let stintCount = Math.ceil(totalLaps / lapsPerStint);
  const remainder = totalLaps % lapsPerStint;
  
  // Optimize: if we can complete race with fewer stints by making last stint shorter
  if (stintCount > 1) {
    const fullStintsPossible = Math.floor(totalLaps / lapsPerStint);
    const remainingLaps = totalLaps - (fullStintsPossible * lapsPerStint);
    
    if (remainingLaps > 0 && remainingLaps <= lapsPerStint) {
      const proposedStintCount = fullStintsPossible + 1;
      const lastStintLaps = remainingLaps;
      const lastStintFuelNeeded = lastStintLaps * fuelPerLap + reserveLiters;
      if (lastStintFuelNeeded <= tankCapacity && proposedStintCount < stintCount) {
        stintCount = proposedStintCount;
      }
    } else if (remainingLaps === 0) {
      // Perfect division - use exact number of stints
      stintCount = fullStintsPossible;
    }
  }
  
  const totalFuelWithReserve = totalFuelNeeded + reserveLiters * stintCount;
  const pitStops = Math.max(0, stintCount - 1);
  const stintPlan = [];
  let totalOutLapPenaltySeconds = 0;
  let completedLaps = 0;
  let completedSeconds = 0;
  let totalPitTime = 0;

  // NOW build the actual stint plan with the correct stintCount
  for (let idx = 0; idx < stintCount; idx += 1) {
    const lapsThisStint = Math.min(lapsPerStint, totalLaps - completedLaps);
    const penaltiesForStint = outLapPenalties
      .slice(0, Math.min(outLapPenalties.length, lapsThisStint))
      .filter(Boolean);
    const penaltySeconds = penaltiesForStint.reduce((acc, val) => acc + val, 0);
    const stintSeconds = lapsThisStint * lapSeconds + penaltySeconds;
    
    // Stint 1: subtract formation lap fuel, other stints: normal calculation
    const baseStintFuel = lapsThisStint * fuelPerLap + reserveLiters;
    const stintFuel = idx === 0 && formationLapFuel > 0
      ? Math.max(0, baseStintFuel - formationLapFuel)
      : baseStintFuel;
    const actualStintFuel = Math.min(stintFuel, tankCapacity);
    
    // Calculate fuel left at end of stint
    const fuelLeft = tankCapacity - (actualStintFuel - reserveLiters);
    
    // Calculate dynamic fueling time based on fuel needed
    // If not last stint, calculate fuel needed for next stint
    let fuelingTime = 0;
    if (idx < stintCount - 1) {
      let fuelNeeded = tankCapacity - fuelLeft;
      
      // For fuel-saving strategy: optimize last pit stop (before last stint)
      // Add only enough fuel to complete last stint with reserve left
      if (strategyMode === 'fuel-saving' && idx === stintCount - 2) {
        // This is the last pit stop before the final stint
        const nextStint = stintPlan.length === idx ? null : null; // We'll calculate it
        // Calculate fuel needed for last stint
        const lastStintLaps = totalLaps - completedLaps - lapsThisStint;
        const lastStintFuelNeeded = lastStintLaps * fuelPerLap + reserveLiters;
        // Fuel needed = what's needed for last stint minus what we'll have left after this stint
        fuelNeeded = Math.max(0, lastStintFuelNeeded - fuelLeft);
        // Cap at tank capacity
        fuelNeeded = Math.min(fuelNeeded, tankCapacity);
      }
      
      // Fueling takes 41 seconds for full tank, so time is proportional
      fuelingTime = (fuelNeeded / tankCapacity) * 41;
    }
    
    const perStopLoss = idx < stintCount - 1 ? pitLaneDelta + fuelingTime : 0;
    
    // Only add pit time if not the last stint
    if (idx < stintCount - 1) {
      totalPitTime += perStopLoss;
    }

    stintPlan.push({
      id: idx + 1,
      laps: lapsThisStint,
      fuel: actualStintFuel,
      fuelLeft: fuelLeft,
      fuelingTime: fuelingTime,
      startLap: completedLaps + 1,
      endLap: completedLaps + lapsThisStint,
      stintDuration: stintSeconds,
      penaltySeconds,
      startTime: completedSeconds,
      endTime: completedSeconds + stintSeconds,
      perStopLoss: perStopLoss,
    });

    completedLaps += lapsThisStint;
    completedSeconds += stintSeconds;
    totalOutLapPenaltySeconds += penaltySeconds;
  }

  const minLapsWarning =
    minLapsPerStint && lapsPerStint < minLapsPerStint ? true : false;
  const avgPerStopLoss = pitStops > 0 ? totalPitTime / pitStops : 0;
  
  // Race time with stops = time on track + time in pits, capped at max race time (white flag condition)
  const totalRaceTimeWithStops = Math.min(completedSeconds + totalPitTime, maxRaceTimeSeconds);
  const finalStintDuration = stintPlan.at(-1)?.stintDuration ?? 0;
  
  // Use fractional laps for pace comparison, full laps for fuel/tire planning
  const decimalLaps = fractionalLapsAtZero > 0 ? fractionalLapsAtZero : completedLaps;
  // Ensure we always have at least the completed laps + 1 for the final lap (white flag rule)
  const actualTotalLaps = totalLaps; // Already calculated from simulation

  return {
    errors,
    lapSeconds,
    totalLaps: actualTotalLaps,
    decimalLaps,
    raceDurationSeconds,
    totalFuelNeeded: actualTotalLaps * fuelPerLap,
    totalFuelWithReserve: (actualTotalLaps * fuelPerLap) + reserveLiters * stintCount,
    lapsPerStint,
    stintCount,
    pitStops,
    stintPlan,
    totalPitTime,
    totalRaceTimeWithStops,
    perStopLoss: avgPerStopLoss,
    pitLaneDelta,
    stationaryService,
    totalOutLapPenaltySeconds,
    finalStintDuration,
    minLapsWarning,
    fuelPerLap,
    maxRaceTimeSeconds,
  };
};

const InputField = ({
  label,
  suffix,
  type = 'text',
  value,
  onChange,
  placeholder,
  step = 'any',
  helpText,
}) => (
  <div className="input-group">
    <label className="field-label">
      <span>{label}</span>
      {helpText ? (
        <span className="help-badge" tabIndex={0}>
          <span className="help-icon">?</span>
          <span className="help-tooltip">{helpText}</span>
        </span>
      ) : null}
    </label>
    <div style={{ position: 'relative' }}>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step={step}
      />
      {suffix ? (
        <span
          style={{
            position: 'absolute',
            right: type === 'number' ? 32 : 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            pointerEvents: 'none',
          }}
        >
          {suffix}
        </span>
      ) : null}
    </div>
  </div>
);

const Stat = ({ label, value, detail, helpText }) => (
  <div className="stat-highlight">
    <div className="field-label" style={{ marginBottom: 2 }}>
      <span className="stat-label" style={{ fontSize: '0.85rem' }}>
        {label}
      </span>
      {helpText ? (
        <span className="help-badge" tabIndex={0}>
          <span className="help-icon">?</span>
          <span className="help-tooltip">{helpText}</span>
        </span>
      ) : null}
    </div>
    <span className="stat-value">{value}</span>
    {detail ? <span className="stat-label">{detail}</span> : null}
  </div>
);

const SectionHeading = ({ title }) => (
  <div className="section-heading">
    <h3>{title}</h3>
  </div>
);

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
          const avgLapFormatted = lapCount ? formatDuration(row.trackSeconds / lapCount) : '--';
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

const StintPlanCard = ({
  plan,
  reservePerStint = 0,
  formationLapFuel = 0,
}) => {
  if (!plan?.length) {
    return <div className="empty-state">Enter race details to generate a stint plan.</div>;
  }

  return (
    <div className="stint-list">
      {plan.map((stint, idx) => {
        const isFirstStint = stint.id === 1;
        const isLastStint = idx === plan.length - 1;
        const usableFuel = Math.max(stint.fuel - reservePerStint - (isFirstStint ? formationLapFuel : 0), 0);
        const fuelPerLapTarget = stint.laps ? usableFuel / stint.laps : 0;
        const perLapDisplay = fuelPerLapTarget.toFixed(2);

        return (
        <div
          className="stint-item"
          key={stint.id}
        >
          <div>
            <strong>Stint {stint.id}</strong>
            <div className="stint-meta">
              <span>
                Laps {stint.startLap}–{stint.endLap} ({stint.laps} lap
                {stint.laps > 1 ? 's' : ''})
              </span>
              <span>{formatDuration(stint.stintDuration)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="stat-label">Fuel Target / Lap</span>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>
              {perLapDisplay} L
            </div>
            {stint.fuelLeft !== undefined && (
              <div className="stat-label" style={{ marginTop: 4, color: 'var(--accent)' }}>
                Fuel Left: {roundTo(stint.fuelLeft, 1)} L
                {isFirstStint && formationLapFuel > 0 && (
                  <span className="help-badge" style={{ marginLeft: 4 }} tabIndex={0}>
                    <span className="help-icon" style={{ fontSize: '0.7rem' }}>ℹ</span>
                    <span className="help-tooltip">Formation lap: -{roundTo(formationLapFuel, 1)} L</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      );
      })}
    </div>
  );
};

const DRIVER_COLORS = [
  { value: '#0ea5e9', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#fbbf24', label: 'Yellow' },
  { value: '#ef4444', label: 'Red' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#38bdf8', label: 'Cyan' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Teal' },
  { value: '#84cc16', label: 'Lime' },
];

const DriverManager = ({ drivers, onDriversChange }) => {
  const timezones = getCommonTimezones();

  const addDriver = () => {
    // Find first available color
    const usedColors = drivers.map(d => d.color).filter(Boolean);
    const availableColor = DRIVER_COLORS.find(c => !usedColors.includes(c.value));
    const newColor = availableColor ? availableColor.value : DRIVER_COLORS[drivers.length % DRIVER_COLORS.length].value;
    
    onDriversChange([
      ...drivers,
      { id: Date.now(), name: '', timezone: 'UTC', color: newColor },
    ]);
  };

  const updateDriver = (id, field, value) => {
    onDriversChange(
      drivers.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  const removeDriver = (id) => {
    onDriversChange(drivers.filter((d) => d.id !== id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0 }}>Drivers</h4>
        <button
          onClick={addDriver}
          style={{
            padding: '8px 16px',
            background: 'var(--accent)',
            color: '#071321',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.9rem',
          }}
        >
          + Add Driver
        </button>
      </div>
      {drivers.length === 0 ? (
        <div className="empty-state" style={{ padding: '20px' }}>
          No drivers added. Click "Add Driver" to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {drivers.map((driver) => (
            <div
              key={driver.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: 12,
                background: 'var(--surface-muted)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: 2, display: 'block' }}>
                  Name
                </label>
                <input
                  type="text"
                  value={driver.name}
                  onChange={(e) => updateDriver(driver.id, 'name', e.target.value)}
                  placeholder="Driver name"
                  style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: 2, display: 'block' }}>
                  Timezone
                </label>
                <select
                  value={driver.timezone}
                  onChange={(e) => updateDriver(driver.id, 'timezone', e.target.value)}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem' }}
                >
                  {timezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: '4px', 
                  background: driver.color || DRIVER_COLORS[0].value,
                  border: '2px solid var(--border)',
                  flexShrink: 0,
                }} />
                <div style={{ minWidth: 120 }}>
                  <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: 2, display: 'block' }}>
                    Color
                  </label>
                  <select
                    value={driver.color || DRIVER_COLORS[0].value}
                    onChange={(e) => updateDriver(driver.id, 'color', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      fontSize: '0.75rem',
                      background: 'var(--surface)',
                      color: '#f4f6fb',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                    }}
                  >
                    {DRIVER_COLORS.map((color) => (
                      <option key={color.value} value={color.value}>
                        {color.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => removeDriver(driver.id)}
                style={{
                  padding: '4px 8px',
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  alignSelf: 'flex-end',
                  fontSize: '0.75rem',
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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

const ScheduleSummary = ({
  stintPlan,
  drivers,
  raceStartGMT,
  raceStartGame,
  delaySeconds,
  actualEndTimes,
  actualLaps,
  onActualEndTimeUpdate,
  onActualLapsUpdate,
  lapSeconds,
  onStintDriverChange,
  onStintLapModeChange,
  perStopLoss,
  totalLapsRequired,
  stintEndInputModes,
  onStintEndInputModeChange,
  stintReplayTimestamps,
  onStintReplayTimestampChange,
  raceDurationMinutes,
  standardResult,
  fuelSavingResult,
}) => {
  if (!stintPlan?.length || !drivers?.length || !raceStartGMT) {
    return (
      <div className="empty-state">
        {!raceStartGMT 
          ? 'Set session start time in GMT to see the schedule.'
          : !drivers.length
          ? 'Add drivers to see the schedule.'
          : 'Generate a stint plan to see the schedule.'}
      </div>
    );
  }

  const timezones = getCommonTimezones();
  
  // Calculate laps per stint for each strategy
  const standardLapsPerStint = standardResult?.lapsPerStint || 0;
  const fuelSavingLapsPerStint = fuelSavingResult?.lapsPerStint || 0;
  
  // Calculate adjustments based on actual strategy differences
  // Use the standard strategy as baseline
  const baseLapsPerStint = standardLapsPerStint || (stintPlan[0]?.laps || 0);
  
  const lapModeOptions = [
    { 
      value: 'fuel-save', 
      label: 'Fuel Save', 
      lapAdjustment: fuelSavingLapsPerStint > 0 ? fuelSavingLapsPerStint - baseLapsPerStint : 1 
    },
    { 
      value: 'standard', 
      label: 'Standard', 
      lapAdjustment: 0 
    },
  ];

  // Calculate completed laps so far
  let completedLaps = 0;
  const completedStints = [];
  
  // Build enhanced plan with actuals and auto-add stints if needed
  const calculateStintTimes = (stint, previousNextStartTime, perStopLoss, lapSeconds) => {
    const startTime = previousNextStartTime 
      ? previousNextStartTime
      : addSeconds(raceStartGMT, delaySeconds);
    
    const actualEndTime = actualEndTimes[stint.id];
    const actualLapsRun = actualLaps[stint.id];
    let endTime;
    let stintDuration;
    let lapsThisStint = stint.laps;
    
    if (actualEndTime) {
      endTime = actualEndTime;
      stintDuration = (actualEndTime.getTime() - startTime.getTime()) / 1000;
      if (actualLapsRun !== undefined && actualLapsRun !== null) {
        lapsThisStint = actualLapsRun;
        completedLaps += actualLapsRun;
        completedStints.push(stint.id);
      }
    } else {
      // Adjust laps for lap mode
      if (stint.lapMode) {
        const mode = lapModeOptions.find((m) => m.value === stint.lapMode);
        if (mode) {
          lapsThisStint = Math.max(1, lapsThisStint + mode.lapAdjustment);
        }
      }
      
      const baseLapSeconds = stint.stintDuration / stint.laps;
      stintDuration = lapsThisStint * baseLapSeconds;
      endTime = addSeconds(startTime, stintDuration);
    }
    
    const pitTime = stint.id < stintPlan.length ? (perStopLoss || 60) : 0;
    const nextStartTime = addSeconds(endTime, pitTime);

    return { startTime, endTime, nextStartTime, stintDuration, lapsThisStint };
  };

  // Calculate game time offset
  const gameTimeOffset = raceStartGame && raceStartGMT
    ? (raceStartGame.getTime() - raceStartGMT.getTime()) / 1000
    : 0;

  let previousNextStartTime = null;
  const scheduleItems = [];
  const allStints = [...stintPlan];
  
  // Only show the required stints from the plan, don't auto-add extra ones
  for (let currentStintIndex = 0; currentStintIndex < allStints.length; currentStintIndex++) {
    const stint = allStints[currentStintIndex];
    
    const times = calculateStintTimes(stint, previousNextStartTime, perStopLoss, lapSeconds);
    previousNextStartTime = times.nextStartTime;
    
    const driver = drivers.find((d) => d.id === stint.driverId) || null;
    const simStartTime = gameTimeOffset ? addSeconds(times.startTime, gameTimeOffset) : times.startTime;
    const simEndTime = gameTimeOffset ? addSeconds(times.endTime, gameTimeOffset) : times.endTime;
    
    scheduleItems.push({
      ...stint,
      ...times,
      simStartTime,
      simEndTime,
      driver,
      laps: times.lapsThisStint,
      baseLaps: stint.laps, // Store original base laps for comparison
    });
  }

  // Helper to format time for input
  const formatTimeForInput = (date) => {
    if (!date) return '';
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Helper to parse time input to Date
  const parseTimeInput = (timeStr, baseDate, startTime) => {
    if (!timeStr || !baseDate) return null;
    try {
      const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
      const date = new Date(baseDate);
      date.setUTCHours(hours, minutes, seconds || 0, 0);
      
      if (startTime && date < startTime) {
        date.setUTCDate(date.getUTCDate() + 1);
      }
      
      return date;
    } catch {
      return null;
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h4 style={{ marginBottom: 12, fontSize: '1rem' }}>Schedule</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {scheduleItems.map((item) => {
          const actualEndTime = actualEndTimes[item.id];
          const actualLapsRun = actualLaps[item.id];
          const baseDate = raceStartGMT;
          const isAutoAdded = false; // No longer auto-adding stints
          
          return (
            <div
              key={item.id}
              style={{
                padding: 8,
                background: 'var(--surface-muted)',
                borderRadius: 8,
                border: `1px solid ${item.driver?.color || '#6b7280'}`,
                borderLeftWidth: item.driver?.color ? 3 : 1,
                opacity: isAutoAdded ? 0.7 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong style={{ fontSize: '0.9rem' }}>Stint {item.id}</strong>
                    {item.driver?.color && (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: item.driver.color,
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                        }}
                        title={item.driver.name || 'Driver'}
                      />
                    )}
                  </div>
                  <div style={{ marginTop: 2, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {(() => {
                      // Use the actual calculated laps from the schedule
                      const actualLaps = item.laps; // This is already the adjusted value from calculateStintTimes
                      const baseLaps = item.baseLaps || item.laps; // Original base laps from plan
                      const mode = lapModeOptions.find((m) => m.value === (item.lapMode || 'standard'));
                      const isAdjusted = mode && mode.lapAdjustment !== 0 && actualLaps !== baseLaps;
                      if (isAdjusted) {
                        const endLap = item.startLap + actualLaps - 1;
                        return `Laps ${item.startLap}–${endLap} (${actualLaps} lap${actualLaps > 1 ? 's' : ''}, ${mode.lapAdjustment > 0 ? '+' : ''}${mode.lapAdjustment} from ${baseLaps})`;
                      }
                      return `Laps ${item.startLap}–${item.endLap} (${actualLaps} lap${actualLaps > 1 ? 's' : ''})`;
                    })()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div>
                    <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: 2, display: 'block' }}>
                      Driver
                    </label>
                    <select
                      value={item.driverId || ''}
                      onChange={(e) => onStintDriverChange(item.id, e.target.value ? Number(e.target.value) : null)}
                      style={{ minWidth: 120, padding: '6px 8px', fontSize: '0.75rem' }}
                    >
                      <option value="">Select</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name || `Driver ${d.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: 2, display: 'block' }}>
                      Mode
                    </label>
                    <select
                      value={item.lapMode || 'standard'}
                      onChange={(e) => onStintLapModeChange(item.id, e.target.value)}
                      style={{ 
                        minWidth: 100, 
                        padding: '6px 8px', 
                        fontSize: '0.75rem',
                        borderColor: (item.lapMode || 'standard') === 'fuel-save' ? '#10b981' : '#0ea5e9',
                        borderWidth: '2px'
                      }}
                    >
                      {lapModeOptions.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6, marginTop: 6 }}>
                <div>
                  <div className="stat-label" style={{ marginBottom: 2, fontSize: '0.7rem' }}>Start (GMT)</div>
                  <div style={{ fontSize: '0.75rem', color: '#f4f6fb' }}>
                    {formatDateTime(item.startTime, 'UTC')}
                  </div>
                </div>
                <div>
                  <div className="stat-label" style={{ marginBottom: 2, fontSize: '0.7rem' }}>
                    Start ({item.driver?.timezone || 'UTC'})
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#f4f6fb' }}>
                    {formatDateTime(item.startTime, item.driver?.timezone || 'UTC')}
                  </div>
                </div>
                <div>
                  <div className="stat-label" style={{ marginBottom: 2, fontSize: '0.7rem' }}>Start (Sim)</div>
                  <div style={{ fontSize: '0.75rem', color: '#f4f6fb' }}>
                    {raceStartGame ? formatDateTime(item.simStartTime, 'UTC') : '--'}
                  </div>
                </div>
                <div>
                  <div className="stat-label" style={{ marginBottom: 2, fontSize: '0.7rem' }}>End (GMT)</div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: actualEndTime ? '#10b981' : '#f4f6fb',
                    fontWeight: actualEndTime ? 600 : 400
                  }}>
                    {formatDateTime(item.endTime, 'UTC')}
                  </div>
                </div>
                <div>
                  <div className="stat-label" style={{ marginBottom: 2, fontSize: '0.7rem' }}>
                    End ({item.driver?.timezone || 'UTC'})
                  </div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: actualEndTime ? '#10b981' : '#f4f6fb',
                    fontWeight: actualEndTime ? 600 : 400
                  }}>
                    {formatDateTime(item.endTime, item.driver?.timezone || 'UTC')}
                  </div>
                </div>
                <div>
                  <div className="stat-label" style={{ marginBottom: 2, fontSize: '0.7rem' }}>End (Sim)</div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: actualEndTime ? '#10b981' : '#f4f6fb',
                    fontWeight: actualEndTime ? 600 : 400
                  }}>
                    {raceStartGame ? formatDateTime(item.simEndTime, 'UTC') : '--'}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 6, padding: 6, background: 'rgba(56, 189, 248, 0.05)', borderRadius: 6, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Actual Laps - First on the left */}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: 2, display: 'block' }}>
                      Actual Laps
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={actualLapsRun !== undefined && actualLapsRun !== null ? actualLapsRun : ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? null : Number(e.target.value);
                        onActualLapsUpdate(item.id, value);
                      }}
                      placeholder="Laps run"
                      style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem' }}
                    />
                    {actualLapsRun !== undefined && actualLapsRun !== null && actualLapsRun !== item.laps && (
                      actualLapsRun < item.laps ? (
                        <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ⚠️ {item.laps - actualLapsRun} lap{item.laps - actualLapsRun !== 1 ? 's' : ''} short
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ✓ {actualLapsRun - item.laps} lap{actualLapsRun - item.laps !== 1 ? 's' : ''} more
                        </div>
                      )
                    )}
                  </div>
                  
                  {/* Stint End - Second, with toggle and Log Timestamp on the right */}
                  <div style={{ flex: 1, minWidth: 180, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: 2, display: 'block' }}>
                        Stint End
                      </label>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                        <div className="toggle-group">
                          <button
                            className={(stintEndInputModes[item.id] || 'log') === 'log' ? 'active' : ''}
                            onClick={() => onStintEndInputModeChange(item.id, 'log')}
                            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                          >
                            Log
                          </button>
                          <button
                            className={(stintEndInputModes[item.id] || 'log') === 'manual' ? 'active' : ''}
                            onClick={() => onStintEndInputModeChange(item.id, 'manual')}
                            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                          >
                            Manual
                          </button>
                        </div>
                      </div>
                      
                      {/* If "Log" selected: show text, button on right */}
                      {(stintEndInputModes[item.id] || 'log') === 'log' ? (
                        <div className="stat-label" style={{ fontSize: '0.7rem', marginTop: 4 }}>
                          Click button to log timestamp
                        </div>
                      ) : (
                        /* If "Manual" selected: show input for elapsed race duration */
                        <>
                          <input
                            type="text"
                            placeholder="MM:SS or HH:MM:SS"
                            value={(() => {
                              // Calculate elapsed duration from race start
                              if (actualEndTime && raceStartGame) {
                                const elapsedSeconds = Math.floor((actualEndTime.getTime() - raceStartGame.getTime()) / 1000);
                                const hours = Math.floor(elapsedSeconds / 3600);
                                const minutes = Math.floor((elapsedSeconds % 3600) / 60);
                                const seconds = elapsedSeconds % 60;
                                if (hours > 0) {
                                  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                                }
                                return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                              }
                              return stintReplayTimestamps[item.id] || '';
                            })()}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              onStintReplayTimestampChange(item.id, val);
                              if (val === '') {
                                onActualEndTimeUpdate(item.id, null);
                                return;
                              }
                              // Parse MM:SS or HH:MM:SS format
                              const parts = val.split(':');
                              if (parts.length === 2 || parts.length === 3) {
                                let totalSeconds = 0;
                                if (parts.length === 3) {
                                  // HH:MM:SS format
                                  const hours = parseInt(parts[0], 10);
                                  const minutes = parseInt(parts[1], 10);
                                  const seconds = parseInt(parts[2], 10);
                                  if (!Number.isNaN(hours) && !Number.isNaN(minutes) && !Number.isNaN(seconds) && 
                                      hours >= 0 && minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60) {
                                    totalSeconds = hours * 3600 + minutes * 60 + seconds;
                                  }
                                } else if (parts.length === 2) {
                                  // MM:SS format (treat as minutes:seconds)
                                  const minutes = parseInt(parts[0], 10);
                                  const seconds = parseInt(parts[1], 10);
                                  if (!Number.isNaN(minutes) && !Number.isNaN(seconds) && 
                                      minutes >= 0 && seconds >= 0 && seconds < 60) {
                                    totalSeconds = minutes * 60 + seconds;
                                  }
                                }
                                if (totalSeconds > 0 && !Number.isNaN(totalSeconds) && raceStartGame) {
                                  const endTime = new Date(raceStartGame.getTime() + totalSeconds * 1000);
                                  onActualEndTimeUpdate(item.id, endTime);
                                }
                              }
                            }}
                            style={{ 
                              width: '100%', 
                              padding: '4px 6px', 
                              fontSize: '0.75rem'
                            }}
                          />
                          <div className="stat-label" style={{ marginTop: 4, fontSize: '0.7rem' }}>
                            Enter elapsed race duration (MM:SS or HH:MM:SS)
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Log Timestamp button on the right */}
                    {(stintEndInputModes[item.id] || 'log') === 'log' && (
                      <button
                        onClick={() => {
                          const now = new Date();
                          onActualEndTimeUpdate(item.id, now);
                        }}
                        style={{
                          padding: '3px 6px',
                          background: 'var(--accent)',
                          color: '#071321',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.65rem',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          alignSelf: 'flex-start',
                          marginTop: '20px',
                        }}
                        title="Log current timestamp"
                      >
                        Log Timestamp
                      </button>
                    )}
                  </div>
                  
                  {/* Clear button - aligned to top right */}
                  {actualEndTime && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '20px' }}>
                      <button
                        onClick={() => {
                          onActualEndTimeUpdate(item.id, null);
                          onStintReplayTimestampChange(item.id, '');
                        }}
                        style={{
                          padding: '4px 8px',
                          background: 'var(--danger)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
                {(actualEndTime || actualLapsRun !== undefined) && (
                  <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--accent)' }}>
                    ✓ Using actual data for future calculations
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <GanttChart 
        scheduleItems={scheduleItems} 
        raceStartGMT={raceStartGMT}
        actualEndTimes={actualEndTimes}
        actualLaps={actualLaps}
        raceDurationMinutes={raceDurationMinutes}
      />
    </div>
  );
};

const PlannerApp = () => {
  const [form, setForm] = useState(defaultForm);
  const [drivers, setDrivers] = useState(() => [
    { id: Date.now(), name: 'John', timezone: 'UTC', color: '#0ea5e9' },
    { id: Date.now() + 1, name: 'Jack', timezone: 'UTC', color: '#8b5cf6' },
  ]);
  const [raceStartGMTTime, setRaceStartGMTTime] = useState('12:00:00');
  const [raceStartGameTime, setRaceStartGameTime] = useState('08:00:00');
  const [delayTime, setDelayTime] = useState('44:00');
  const [delayInputMode, setDelayInputMode] = useState('manual'); // 'manual' or 'log'
  const [stintActualEndTimes, setStintActualEndTimes] = useState({});
  const [stintActualLaps, setStintActualLaps] = useState({});
  const [stintDrivers, setStintDrivers] = useState({});
  const [stintLapModes, setStintLapModes] = useState({});
  const [stintEndInputModes, setStintEndInputModes] = useState({}); // 'manual' or 'log' per stint
  const [stintReplayTimestamps, setStintReplayTimestamps] = useState({}); // Store replay timestamp input per stint
  const [activeTab, setActiveTab] = useState('setup');
  const [selectedStrategy, setSelectedStrategy] = useState('standard');
  const [pitSandbox, setPitSandbox] = useState({
    pitWallSide: 'right',
    tires: { LF: true, RF: true, LR: true, RR: true },
    fuelBefore: '1',
    fuelToAdd: '99',
    driverSwap: true,
  });

  const standardResult = useMemo(() => computePlan(form, 'standard'), [form]);
  const fuelSavingResult = useMemo(() => computePlan(form, 'fuel-saving'), [form]);
  const withAlpha = (hex, alpha = '33') => {
    if (!hex || typeof hex !== 'string') return hex;
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) return hex;
    return `#${normalized}${alpha}`;
  };

  const strategyConfigs = [
    { name: 'Standard', key: 'standard', result: standardResult, color: '#1ea7ff' },
    { name: 'Fuel-Saving', key: 'fuel-saving', result: fuelSavingResult, color: '#10b981' },
  ];
  const rankedStrategies = strategyConfigs
    .filter((entry) => !entry.result.errors?.length)
    .map((entry) => ({
      ...entry,
      scoreDistance: entry.result.decimalLaps || entry.result.totalLaps || 0,
      scoreTime: entry.result.totalRaceTimeWithStops || Infinity,
    }))
    .sort((a, b) => {
      if (b.scoreDistance !== a.scoreDistance) {
        return b.scoreDistance - a.scoreDistance;
      }
      return a.scoreTime - b.scoreTime;
    });
  const topStrategyKey = rankedStrategies[0]?.key;
  const strategyRecommendation = (key) => {
    if (!topStrategyKey) return '';
    return key === topStrategyKey ? 'Optimal' : '';
  };
  const result = standardResult; // Keep for backward compatibility
  const reservePerStint = Number(form.fuelReserveLiters) || 0;
  const activeStrategyDef = strategyConfigs.find((entry) => entry.key === selectedStrategy) || strategyConfigs[0];
  const activeStrategyColor = activeStrategyDef?.color || '#38bdf8';
  const plannerCardStyle = {
    marginTop: 24,
    border: `1px solid ${withAlpha(activeStrategyColor, '55')}`,
    background: `linear-gradient(140deg, ${withAlpha(activeStrategyColor, '1a')}, rgba(7, 19, 33, 0.96))`,
    boxShadow: `0 18px 40px ${withAlpha(activeStrategyColor, '33')}`,
  };
  const updatePitSandbox = (field, value) => {
    setPitSandbox((prev) => ({ ...prev, [field]: value }));
  };
  const toggleSandboxTire = (corner) => {
    setPitSandbox((prev) => ({
      ...prev,
      tires: {
        ...prev.tires,
        [corner]: !prev.tires[corner],
      },
    }));
  };
  const sandboxTankCapacity = Number(form.tankCapacity) || 100;
  const sandboxFuelBefore = Math.max(0, parseFloat(pitSandbox.fuelBefore) || 0);
  const sandboxFuelRequested = Math.max(0, parseFloat(pitSandbox.fuelToAdd) || 0);
  const availableFuelRoom = Math.max(0, sandboxTankCapacity - sandboxFuelBefore);
  const sandboxFuelToAdd = Math.min(sandboxFuelRequested, availableFuelRoom);
  const sandboxFuelingTime = sandboxFuelToAdd > 0 ? (sandboxFuelToAdd / sandboxTankCapacity) * 41 : 0;
  const pitWallIsRight = pitSandbox.pitWallSide === 'right';
  const wallCorners = pitWallIsRight ? ['RF', 'RR'] : ['LF', 'LR'];
  const laneCorners = pitWallIsRight ? ['LF', 'LR'] : ['RF', 'RR'];
  const frontCorners = ['LF', 'RF'];
  const rearCorners = ['LR', 'RR'];
  const selectedCorners = pitSandbox.tires;
  const selectedCornerKeys = Object.entries(selectedCorners)
    .filter(([, selected]) => selected)
    .map(([corner]) => corner);
  const selectedCount = selectedCornerKeys.length;
  let sandboxTireTime = 0;
  if (selectedCount > 0) {
    const frontsSelectedOnly = frontCorners.every((corner) => selectedCorners[corner]) && !rearCorners.some((corner) => selectedCorners[corner]);
    const rearsSelectedOnly = rearCorners.every((corner) => selectedCorners[corner]) && !frontCorners.some((corner) => selectedCorners[corner]);
    if (frontsSelectedOnly) {
      sandboxTireTime = 10.5;
    } else if (rearsSelectedOnly) {
      sandboxTireTime = 12;
    } else {
      sandboxTireTime = selectedCornerKeys.reduce((total, corner) => {
        const wallCorner = wallCorners.includes(corner);
        return total + (wallCorner ? 5.5 : 7);
      }, 0);
    }
  }
  const sandboxDriverSwapTime = pitSandbox.driverSwap ? 22 : 0;
  const sandboxServiceTime = Math.max(sandboxFuelingTime, sandboxTireTime, sandboxDriverSwapTime);
  const sandboxPitLaneDelta = Number(form.pitLaneDeltaSeconds) || 0;
  const sandboxTotalPitTime = sandboxPitLaneDelta + sandboxServiceTime;
  const tiresDuringFueling = sandboxTireTime > 0 && sandboxTireTime <= sandboxFuelingTime;
  const driverSwapDuringFueling = sandboxDriverSwapTime > 0 && sandboxDriverSwapTime <= sandboxFuelingTime;
  const sandboxExtraTireTime = sandboxTireTime > sandboxFuelingTime ? sandboxTireTime - sandboxFuelingTime : 0;
  const sandboxExtraDriverSwapTime = sandboxDriverSwapTime > sandboxFuelingTime ? sandboxDriverSwapTime - sandboxFuelingTime : 0;

  // Recalculate plan when per-stint laps are modified
  const recalculatePlanWithCustomLaps = (baseResult, customLaps) => {
    if (!baseResult.stintPlan?.length || Object.keys(customLaps).length === 0) {
      return baseResult;
    }

    const lapSeconds = baseResult.lapSeconds;
    const fuelPerLap = baseResult.fuelPerLap;
    const tankCapacity = Number(form.tankCapacity) || 100;
    const reserveLiters = Number(form.fuelReserveLiters) || 0;
    const pitLaneDelta = Number(form.pitLaneDeltaSeconds) || 0;
    const formationLapFuel = Number(form.formationLapFuel) || 0;
    const outLapPenalties = [
      safeNumber(form.outLapPenaltyOutLap),
      safeNumber(form.outLapPenaltyLap1),
      safeNumber(form.outLapPenaltyLap2),
      safeNumber(form.outLapPenaltyLap3),
    ].map((val) => (Number.isFinite(val) && val > 0 ? val : 0));

    const totalLaps = baseResult.totalLaps;
    const newStintPlan = [];
    let completedLaps = 0;
    let completedSeconds = 0;
    let totalPitTime = 0;

    for (let idx = 0; idx < baseResult.stintPlan.length; idx++) {
      const originalStint = baseResult.stintPlan[idx];
      const customLapsForStint = customLaps[originalStint.id];
      let lapsThisStint = customLapsForStint !== undefined 
        ? customLapsForStint 
        : originalStint.laps;
      
      // Constraint: must be positive integer, reasonable range (1 to 100)
      if (lapsThisStint !== undefined && lapsThisStint !== null) {
        lapsThisStint = Math.max(1, Math.min(100, Math.floor(Math.abs(lapsThisStint))));
      } else {
        lapsThisStint = originalStint.laps;
      }
      
      // Ensure we don't exceed total laps
      const remainingLaps = totalLaps - completedLaps;
      const actualLaps = Math.min(lapsThisStint, remainingLaps);
      
      if (actualLaps <= 0 || !Number.isFinite(actualLaps)) break;

      const penaltiesForStint = outLapPenalties
        .slice(0, Math.min(outLapPenalties.length, actualLaps))
        .filter(Boolean);
      const penaltySeconds = penaltiesForStint.reduce((acc, val) => acc + val, 0);
      const stintSeconds = actualLaps * lapSeconds + penaltySeconds;
      
      const baseStintFuel = actualLaps * fuelPerLap + reserveLiters;
      const stintFuel = idx === 0 && formationLapFuel > 0
        ? Math.max(0, baseStintFuel - formationLapFuel)
        : baseStintFuel;
      const actualStintFuel = Math.min(stintFuel, tankCapacity);
      
      const fuelLeft = tankCapacity - (actualStintFuel - reserveLiters);
      
      let fuelingTime = 0;
      if (idx < baseResult.stintPlan.length - 1) {
        const fuelNeeded = tankCapacity - fuelLeft;
        fuelingTime = (fuelNeeded / tankCapacity) * 41;
      }
      
      const perStopLoss = idx < baseResult.stintPlan.length - 1 ? pitLaneDelta + fuelingTime : 0;
      
      if (idx < baseResult.stintPlan.length - 1) {
        totalPitTime += perStopLoss;
      }

      newStintPlan.push({
        id: originalStint.id,
        laps: actualLaps,
        fuel: actualStintFuel,
        fuelLeft: fuelLeft,
        fuelingTime: fuelingTime,
        startLap: completedLaps + 1,
        endLap: completedLaps + actualLaps,
        stintDuration: stintSeconds,
        penaltySeconds,
        startTime: completedSeconds,
        endTime: completedSeconds + stintSeconds,
        perStopLoss: perStopLoss,
      });

      completedLaps += actualLaps;
      completedSeconds += stintSeconds;
    }

    const remainingTime = baseResult.maxRaceTimeSeconds - (completedSeconds + totalPitTime);
    const decimalLaps = baseResult.totalLaps + (remainingTime > 0 ? remainingTime / lapSeconds : 0);
    const totalRaceTimeWithStops = Math.min(completedSeconds + totalPitTime, baseResult.maxRaceTimeSeconds);

    return {
      ...baseResult,
      stintPlan: newStintPlan,
      totalPitTime,
      totalRaceTimeWithStops,
      decimalLaps,
    };
  };
  const fuelTargetPerStint =
    !result.errors?.length && result.lapsPerStint
      ? result.lapsPerStint * (result.fuelPerLap || 0) + reservePerStint
      : 0;

  const handleInput = (field) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({
      ...prev,
      [field]: value === '' ? '' : value,
    }));
  };

  const raceStartGMT = useMemo(() => {
    return parseTimeOnly(raceStartGMTTime);
  }, [raceStartGMTTime]);

  const raceStartGame = useMemo(() => {
    return parseTimeOnly(raceStartGameTime);
  }, [raceStartGameTime]);

  const delaySeconds = useMemo(() => {
    if (!delayTime) return 0;
    return parseLapTime(delayTime) || 0;
  }, [delayTime]);

  const enhancedStintPlan = useMemo(() => {
    if (!result.stintPlan) return [];
    return result.stintPlan.map((stint) => ({
      ...stint,
      driverId: stintDrivers[stint.id] || null,
      lapMode: stintLapModes[stint.id] || 'standard',
    }));
  }, [result.stintPlan, stintDrivers, stintLapModes]);

  const handleStintDriverChange = (stintId, driverId) => {
    setStintDrivers((prev) => ({
      ...prev,
      [stintId]: driverId,
    }));
  };

  const handleStintLapModeChange = (stintId, lapMode) => {
    setStintLapModes((prev) => ({
      ...prev,
      [stintId]: lapMode,
    }));
  };

  const handleActualEndTimeUpdate = (stintId, endTime) => {
    if (endTime === null || endTime === undefined) {
      setStintActualEndTimes((prev) => {
        const newActuals = { ...prev };
        delete newActuals[stintId];
        return newActuals;
      });
    } else {
      setStintActualEndTimes((prev) => ({
        ...prev,
        [stintId]: endTime,
      }));
    }
  };

  const handleActualLapsUpdate = (stintId, laps) => {
    if (laps === null || laps === undefined) {
      setStintActualLaps((prev) => {
        const newActuals = { ...prev };
        delete newActuals[stintId];
        return newActuals;
      });
    } else {
      setStintActualLaps((prev) => ({
        ...prev,
        [stintId]: laps,
      }));
    }
  };

  const handleStintEndInputModeChange = (stintId, mode) => {
    setStintEndInputModes((prev) => ({
      ...prev,
      [stintId]: mode,
    }));
  };

  const handleStintReplayTimestampChange = (stintId, value) => {
    setStintReplayTimestamps((prev) => ({
      ...prev,
      [stintId]: value,
    }));
  };

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <h1>iRacing Endurance Planner</h1>
          <p>Dial in GT endurance strategy with live fuel, stint, and pit insights.</p>
        </div>
      </header>

      <div className="tabs">
        <button
          className={activeTab === 'setup' ? 'active' : ''}
          onClick={() => setActiveTab('setup')}
        >
          Setup
        </button>
        <button
          className={activeTab === 'strategy' ? 'active' : ''}
          onClick={() => setActiveTab('strategy')}
        >
          Strategy
        </button>
        <button
          className={activeTab === 'schedule' ? 'active' : ''}
          onClick={() => setActiveTab('schedule')}
        >
          Schedule
        </button>
        <button
          className={activeTab === 'lap-times' ? 'active' : ''}
          onClick={() => setActiveTab('lap-times')}
        >
          Stint Modelling
        </button>
        <button
          className={activeTab === 'sandbox' ? 'active' : ''}
          onClick={() => setActiveTab('sandbox')}
        >
          Pit Stop Modelling
        </button>
      </div>

      {activeTab === 'setup' && (
        <div className="tab-content">
          <div className="inputs-grid">
        <div className="card">
          <SectionHeading title="Race & Fuel" />
          <InputField
            label="Race Duration"
            suffix="min"
            type="number"
            value={form.raceDurationMinutes}
            onChange={handleInput('raceDurationMinutes')}
            helpText="Scheduled race length from the event info. Determines total laps when combined with lap time."
          />
          <InputField
            label="Tank Capacity"
            suffix="L"
            type="number"
            value={form.tankCapacity}
            onChange={handleInput('tankCapacity')}
            helpText="Usable fuel from full to empty. Limits maximum stint length."
          />
          <InputField
            label="Fuel Reserve"
            suffix="L"
            type="number"
            value={form.fuelReserveLiters}
            onChange={handleInput('fuelReserveLiters')}
            step="0.1"
            helpText="Extra buffer you want to keep in the tank at each stop (e.g., 0.3 L). Added on top of calculated need."
          />
          <InputField
            label="Formation Lap Fuel"
            suffix="L"
            type="number"
            value={form.formationLapFuel}
            onChange={handleInput('formationLapFuel')}
            step="0.1"
            helpText="Fuel consumed during formation lap. This reduces available fuel for Stint 1, which may decrease the number of laps possible in the first stint."
          />
        </div>

        <div className="card">
          <SectionHeading title="Pit Stop" />
          <InputField
            label="Pit Lane Delta"
            suffix="sec"
            type="number"
            value={form.pitLaneDeltaSeconds}
            onChange={handleInput('pitLaneDeltaSeconds')}
            helpText="Time from pit entry to exit when just driving through. Already accounts for the shorter lane distance."
          />
          <InputField
            label="Stationary Service"
            suffix="sec"
            type="number"
            value={form.stationaryServiceSeconds}
            onChange={handleInput('stationaryServiceSeconds')}
            helpText="Fueling + tire change duration (or any extra service). Added to the lane delta for total pit loss."
          />
        </div>

        <div className="card">
          <SectionHeading title="Strategy Modes" />
          <div className="input-row">
            <InputField
              label="Standard Lap Time"
              placeholder="MM:SS.sss"
              value={form.averageLapTime}
              onChange={handleInput('averageLapTime')}
              helpText="Baseline lap time for standard strategy."
            />
            <InputField
              label="Standard Fuel / Lap"
              suffix="L"
              type="number"
              value={form.fuelPerLap}
              onChange={handleInput('fuelPerLap')}
              step="0.01"
              helpText="Fuel consumption for standard strategy."
            />
          </div>
          <div className="input-row">
            <InputField
              label="Fuel-Saving Lap Time"
              placeholder="MM:SS.sss"
              value={form.fuelSavingLapTime}
              onChange={handleInput('fuelSavingLapTime')}
              helpText="Slower lap time when fuel saving (typically 2-3s slower)."
            />
            <InputField
              label="Fuel-Saving Fuel / Lap"
              suffix="L"
              type="number"
              value={form.fuelSavingFuelPerLap}
              onChange={handleInput('fuelSavingFuelPerLap')}
              step="0.01"
              helpText="Lower fuel consumption when fuel saving (typically 0.1-0.2L less)."
            />
          </div>
        </div>

        <div className="card">
          <SectionHeading title="Out-Lap Adjustments" />
          <InputField
            label="Outlap Penalty"
            suffix="sec"
            type="number"
            value={form.outLapPenaltyOutLap}
            onChange={handleInput('outLapPenaltyOutLap')}
            helpText="Delta for the outlap immediately after the pit stop before crossing start/finish."
          />
          <InputField
            label="Lap 1 Penalty"
            suffix="sec"
            type="number"
            value={form.outLapPenaltyLap1}
            onChange={handleInput('outLapPenaltyLap1')}
            helpText="Extra seconds your first flying lap of each stint typically loses."
          />
          <InputField
            label="Lap 2 Penalty"
            suffix="sec"
            type="number"
            value={form.outLapPenaltyLap2}
            onChange={handleInput('outLapPenaltyLap2')}
            helpText="Second flying lap delta if tires are still coming up to temperature."
          />
          <InputField
            label="Lap 3 Penalty"
            suffix="sec"
            type="number"
            value={form.outLapPenaltyLap3}
            onChange={handleInput('outLapPenaltyLap3')}
            helpText="Optional third-lap adjustment for longer warm-up cycles."
          />
        </div>
          </div>
        </div>
      )}


      {activeTab === 'strategy' && (
        <div className="tab-content">
          {(() => {
            try {
              return (
                <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 24 }}>
                  {strategyConfigs && strategyConfigs.length > 0 ? (
                    strategyConfigs
                      .filter(strategy => strategy && strategy.result)
                      .map((strategy) => {
                        const badgeLabel = strategyRecommendation(strategy.key);
                        const preciseLapsValue = Number(strategy.result.decimalLaps || strategy.result.totalLaps || 0);
                        // Calculate average lap times
                        // Average lap without pits = time on track only (excluding pit stops) / laps
                        const timeOnTrack = strategy.result.totalRaceTimeWithStops - strategy.result.totalPitTime;
                        const avgLapWithoutPits = strategy.result.totalLaps > 0 && timeOnTrack > 0
                          ? timeOnTrack / strategy.result.totalLaps
                          : 0;
                        // Average lap with pits = (total race time + pit stop time) / laps
                        // Pit stop time is added to overall distance
                        const totalTimeWithPits = strategy.result.totalRaceTimeWithStops + strategy.result.totalPitTime;
                        const avgLapWithPits = strategy.result.totalLaps > 0 && totalTimeWithPits > 0
                          ? totalTimeWithPits / strategy.result.totalLaps
                          : 0;
                        return (
                          <div 
                            key={strategy.name} 
                            className="card" 
                            style={{ 
                              borderTop: `4px solid ${strategy.color}`,
                              border: selectedStrategy === strategy.key ? `2px solid ${strategy.color}` : `1px solid var(--border)`,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              transform: selectedStrategy === strategy.key ? 'scale(1.02)' : 'scale(1)',
                              boxShadow: selectedStrategy === strategy.key ? `0 8px 24px rgba(${strategy.color === '#1ea7ff' ? '30, 167, 255' : strategy.color === '#10b981' ? '16, 185, 129' : '245, 158, 11'}, 0.3)` : 'none',
                            }}
                            onClick={() => setSelectedStrategy(strategy.key)}
                          >
                            <h3 style={{ marginBottom: 16, color: strategy.color, display: 'flex', alignItems: 'center', gap: 8 }}>
                              {strategy.name} Strategy
                              {!strategy.result.errors?.length && badgeLabel && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    background: strategy.color,
                                    color: '#071321',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                  title="Optimal Strategy"
                                >
                                  ★
                                </span>
                              )}
                            </h3>
                            {strategy.result.errors?.length ? (
                              <div className="callout">
                                {strategy.result.errors.map((err) => (
                                  <div key={err}>{err}</div>
                                ))}
                              </div>
                            ) : (
                              <>
                                <Stat
                                  label="Total Laps"
                                  value={`${Math.ceil(preciseLapsValue)} laps`}
                                  detail={`${preciseLapsValue.toFixed(2)} laps exact`}
                                />
                                <Stat
                                  label="Stints & Stops"
                                  value={`${strategy.result.stintCount} stints`}
                                  detail={`${strategy.result.pitStops} stops • ~${strategy.result.lapsPerStint} laps/stint`}
                                />
                                <Stat
                                  label="Total Pit Time"
                                  value={`${roundTo(strategy.result.totalPitTime, 1)} s`}
                                  detail={(() => {
                                    // Get all stop times from stint plan (excluding last stint which has no stop)
                                    const stopTimes = strategy.result.stintPlan
                                      .filter((stint, idx) => idx < strategy.result.stintPlan.length - 1)
                                      .map(stint => stint.perStopLoss);
                                    
                                    // Check if all stops have the same time (within 0.1s tolerance)
                                    const allSame = stopTimes.length > 0 && stopTimes.every(time => Math.abs(time - stopTimes[0]) < 0.1);
                                    
                                    if (allSame && stopTimes.length > 0) {
                                      // All stops are the same - show as before
                                      return `${roundTo(stopTimes[0], 1)}s × ${strategy.result.pitStops || 0} stops`;
                                    } else if (stopTimes.length > 0) {
                                      // Stops differ - show individual times
                                      return stopTimes.map((time, idx) => `${roundTo(time, 1)}s`).join(' + ');
                                    } else {
                                      return 'No stops';
                                    }
                                  })()}
                                />
                                <Stat
                                  label="Total Fuel Consumed"
                                  value={`${roundTo(strategy.result.totalFuelWithReserve, 1)} L`}
                                  detail={`${roundTo(strategy.result.totalFuelNeeded, 1)} L base + ${( (strategy.result.stintCount || 0) * reservePerStint).toFixed(1)} L reserve`}
                                />
                                <Stat
                                  label="Avg Lap (no pits)"
                                  value={avgLapWithoutPits > 0 ? formatLapTime(avgLapWithoutPits) : '--'}
                                  detail="Average lap time excluding pit stops"
                                />
                                <Stat
                                  label="Avg Lap (with pits)"
                                  value={avgLapWithPits > 0 ? formatLapTime(avgLapWithPits) : '--'}
                                  detail="Average lap time including pit stop time"
                                />
                              </>
                            )}
                          </div>
                        );
                      })
                  ) : (
                    <div style={{ padding: '20px', color: 'var(--text-muted)' }}>
                      No strategy data available. Please check your setup parameters.
                    </div>
                  )}
                </div>

                <div className="card" style={plannerCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Detailed Stint Planner - {selectedStrategy === 'standard' ? 'Standard' : 'Fuel-Saving'} Strategy</h3>
          {(() => {
            const activeResult = selectedStrategy === 'standard' ? standardResult : fuelSavingResult;
            return !activeResult.errors?.length && (
              <span className="stat-label">
                Fuel target capped at tank capacity ({form.tankCapacity || 0} L)
              </span>
            );
          })()}
        </div>
        {(() => {
          const activeResult = selectedStrategy === 'standard' ? standardResult : selectedStrategy === 'fuel-saving' ? fuelSavingResult : pushResult;
          return !activeResult.errors?.length && activeResult.minLapsWarning ? (
            <div className="callout" style={{ marginBottom: 16 }}>
              Fuel window currently allows ~{activeResult.lapsPerStint} laps per stint, below your minimum target of{' '}
              {form.minLapsPerStint || 0} laps.
            </div>
          ) : null;
        })()}
        {(() => {
          const activeResult = selectedStrategy === 'standard' ? standardResult : fuelSavingResult;
          return (
            <StintPlanCard
              plan={activeResult.errors?.length ? [] : activeResult.stintPlan}
              reservePerStint={reservePerStint}
              formationLapFuel={Number(form.formationLapFuel) || 0}
            />
          );
        })()}
        {(() => {
          const activeResult = selectedStrategy === 'standard' ? standardResult : fuelSavingResult;
          return !activeResult.errors?.length ? (
            <StrategyGraph plan={activeResult.stintPlan} perStopLoss={activeResult.perStopLoss} />
          ) : null;
        })()}
                </div>
              </>
              );
            } catch (error) {
              console.error('Strategy tab error:', error);
              return (
                <div style={{ padding: '20px', color: 'var(--danger)' }}>
                  Error loading strategy tab: {error.message || String(error)}. Please check the browser console for details.
                </div>
              );
            }
          })()}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="tab-content">
          <div className="card">
            <SectionHeading
              title="Race Schedule"
              helpText="Configure drivers, session start times, and view the complete schedule with timezone conversions."
            />
        <div className="inputs-grid" style={{ marginTop: 20 }}>
          <div className="card">
            <DriverManager drivers={drivers} onDriversChange={setDrivers} />
          </div>
          <div className="card">
            <SectionHeading title="Session Start Times" />
            <InputField
              label="Session Start (GMT)"
              type="time"
              value={raceStartGMTTime}
              onChange={(e) => setRaceStartGMTTime(e.target.value)}
              step="1"
              helpText="The time when the session starts in GMT/UTC (HH:MM:SS)."
            />
            <InputField
              label="Session Start (Game)"
              type="time"
              value={raceStartGameTime}
              onChange={(e) => setRaceStartGameTime(e.target.value)}
              step="1"
              helpText="The time when the session starts in the game/simulator (HH:MM:SS)."
            />
            <div>
              <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: 2, display: 'block' }}>
                Delay to First Stint
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div className="toggle-group">
                  <button
                    className={delayInputMode === 'manual' ? 'active' : ''}
                    onClick={() => setDelayInputMode('manual')}
                    style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                  >
                    Manual
                  </button>
                  <button
                    className={delayInputMode === 'log' ? 'active' : ''}
                    onClick={() => setDelayInputMode('log')}
                    style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                  >
                    Log
                  </button>
                </div>
              </div>
              {delayInputMode === 'manual' ? (
                <input
                  type="text"
                  placeholder="MM:SS"
                  value={delayTime}
                  onChange={(e) => setDelayTime(e.target.value)}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem' }}
                />
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      if (raceStartGMT) {
                        const now = new Date();
                        const diffMs = now.getTime() - raceStartGMT.getTime();
                        const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
                        const minutes = Math.floor(diffSeconds / 60);
                        const seconds = diffSeconds % 60;
                        setDelayTime(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--accent)',
                      color: '#071321',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                    }}
                    disabled={!raceStartGMT}
                    title="Log current timestamp and calculate delay from Session Start (GMT)"
                  >
                    Log Timestamp
                  </button>
                  {delayTime && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Delay: {delayTime}
                    </span>
                  )}
                </div>
              )}
              <div className="stat-label" style={{ marginTop: 4, fontSize: '0.7rem' }}>
                {delayInputMode === 'manual' 
                  ? 'Delay between session start and green flag (MM:SS format).'
                  : 'Click "Log Timestamp" to capture current time and calculate delay from Session Start (GMT).'
                }
              </div>
            </div>
          </div>
        </div>
        {!result.errors?.length && enhancedStintPlan.length > 0 ? (
          <ScheduleSummary
            stintPlan={enhancedStintPlan}
            drivers={drivers}
            raceStartGMT={raceStartGMT}
            raceStartGame={raceStartGame}
            delaySeconds={delaySeconds}
            actualEndTimes={stintActualEndTimes}
            actualLaps={stintActualLaps}
            onActualEndTimeUpdate={handleActualEndTimeUpdate}
            onActualLapsUpdate={handleActualLapsUpdate}
            lapSeconds={result.lapSeconds}
            onStintDriverChange={handleStintDriverChange}
            onStintLapModeChange={handleStintLapModeChange}
            perStopLoss={result.perStopLoss}
            totalLapsRequired={result.totalLaps}
            stintEndInputModes={stintEndInputModes}
            onStintEndInputModeChange={handleStintEndInputModeChange}
            stintReplayTimestamps={stintReplayTimestamps}
            onStintReplayTimestampChange={handleStintReplayTimestampChange}
            raceDurationMinutes={form.raceDurationMinutes}
            standardResult={standardResult}
            fuelSavingResult={fuelSavingResult}
          />
        ) : null}
          </div>
        </div>
      )}

      {activeTab === 'sandbox' && (
        <div className="tab-content">
          <div className="card">
            <SectionHeading
              title="Pit Stop Modelling"
              helpText="Estimate total pit service time by toggling tires, fueling, and pit wall position."
            />
            {(() => {
              try {
                // Calculate pit sandbox values safely
                const sandboxTankCapacity = Number(form?.tankCapacity) || 100;
                const sandboxFuelBefore = Math.max(0, parseFloat(pitSandbox?.fuelBefore) || 0);
                const sandboxFuelRequested = Math.max(0, parseFloat(pitSandbox?.fuelToAdd) || 0);
                const availableFuelRoom = Math.max(0, sandboxTankCapacity - sandboxFuelBefore);
                const sandboxFuelToAdd = Math.min(sandboxFuelRequested, availableFuelRoom);
                const sandboxFuelingTime = sandboxFuelToAdd > 0 ? (sandboxFuelToAdd / sandboxTankCapacity) * 41 : 0;
                const pitWallIsRight = pitSandbox?.pitWallSide === 'right';
                const wallCorners = pitWallIsRight ? ['RF', 'RR'] : ['LF', 'LR'];
                const laneCorners = pitWallIsRight ? ['LF', 'LR'] : ['RF', 'RR'];
                const frontCorners = ['LF', 'RF'];
                const rearCorners = ['LR', 'RR'];
                const selectedCorners = pitSandbox?.tires || { LF: true, RF: true, LR: true, RR: true };
                const selectedCornerKeys = Object.entries(selectedCorners)
                  .filter(([, selected]) => selected)
                  .map(([corner]) => corner);
                const selectedCount = selectedCornerKeys.length;
                let sandboxTireTime = 0;
                if (selectedCount > 0) {
                  const frontsSelectedOnly = frontCorners.every((corner) => selectedCorners[corner]) && !rearCorners.some((corner) => selectedCorners[corner]);
                  const rearsSelectedOnly = rearCorners.every((corner) => selectedCorners[corner]) && !frontCorners.some((corner) => selectedCorners[corner]);
                  if (frontsSelectedOnly) {
                    sandboxTireTime = 10.5;
                  } else if (rearsSelectedOnly) {
                    sandboxTireTime = 12;
                  } else {
                    sandboxTireTime = selectedCornerKeys.reduce((total, corner) => {
                      const wallCorner = wallCorners.includes(corner);
                      return total + (wallCorner ? 5.5 : 7);
                    }, 0);
                  }
                }
                const sandboxDriverSwapTime = pitSandbox?.driverSwap ? 22 : 0;
                const sandboxServiceTime = Math.max(sandboxFuelingTime, sandboxTireTime, sandboxDriverSwapTime);
                const sandboxPitLaneDelta = Number(form?.pitLaneDeltaSeconds) || 0;
                const sandboxTotalPitTime = sandboxPitLaneDelta + sandboxServiceTime;
                // Compare all to bottleneck (sandboxServiceTime)
                const fuelingWithinBottleneck = sandboxFuelingTime > 0 && sandboxFuelingTime <= sandboxServiceTime && sandboxServiceTime !== sandboxFuelingTime;
                const tiresWithinBottleneck = sandboxTireTime > 0 && sandboxTireTime <= sandboxServiceTime && sandboxServiceTime !== sandboxTireTime;
                const driverSwapWithinBottleneck = sandboxDriverSwapTime > 0 && sandboxDriverSwapTime <= sandboxServiceTime && sandboxServiceTime !== sandboxDriverSwapTime;
                const sandboxExtraTireTime = sandboxTireTime > sandboxFuelingTime ? sandboxTireTime - sandboxFuelingTime : 0;
                const sandboxExtraDriverSwapTime = sandboxDriverSwapTime > sandboxFuelingTime ? sandboxDriverSwapTime - sandboxFuelingTime : 0;
                
                return (
                  <div className="pit-sandbox-grid">
                    <div className="pit-wall-panel">
                {/* Reordered inputs: 1. Driver Swap, 2. Remaining Fuel, 3. Fuel to Add */}
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* 1. Driver Swap */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={pitSandbox?.driverSwap || false}
                        onChange={(e) => updatePitSandbox('driverSwap', e.target.checked)}
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                      <span className="field-label" style={{ fontSize: '0.85rem', margin: 0 }}>
                        Driver Swap
                      </span>
                    </label>
                  </div>
                  {/* 2. Remaining Fuel */}
                  <InputField
                    label="Remaining Fuel"
                    suffix="L"
                    type="number"
                    value={pitSandbox?.fuelBefore || ''}
                    onChange={(e) => updatePitSandbox('fuelBefore', e.target.value)}
                    helpText="Estimated liters remaining when you enter the box."
                  />
                  {/* 3. Fuel To Add */}
                  <InputField
                    label="Fuel To Add"
                    suffix="L"
                    type="number"
                    value={pitSandbox?.fuelToAdd || ''}
                    onChange={(e) => updatePitSandbox('fuelToAdd', e.target.value)}
                    helpText="Liters requested during the stop."
                  />
                  
                  {/* 4. Tire Change */}
                  <div style={{ marginTop: 8, padding: 12, background: 'rgba(56, 189, 248, 0.05)', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>Tire Change</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span className="stat-label" style={{ fontSize: '0.75rem' }}>Pit Wall Side</span>
                      <span className="help-badge" tabIndex={0}>
                        <span className="help-icon">?</span>
                        <span className="help-tooltip">Tires on the same side as the pit wall are changed faster (5.5s) than tires on the pit lane side (7s), simulating real-life conditions where mechanics have easier access.</span>
                      </span>
                    </div>
                    <div className="toggle-group" style={{ marginBottom: 8 }}>
                      {['left', 'right'].map((side) => (
                        <button
                          key={side}
                          className={pitSandbox?.pitWallSide === side ? 'active' : ''}
                          onClick={() => updatePitSandbox('pitWallSide', side)}
                          style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                        >
                          {side === 'left' ? 'Left' : 'Right'}
                        </button>
                      ))}
                    </div>
                    <div className="pit-car-body">
                      <div className="pit-car-row">
                        {['LF', 'RF'].map((corner) => {
                          const isSelected = pitSandbox?.tires?.[corner];
                          const isWallSide = wallCorners.includes(corner);
                          return (
                            <label 
                              key={corner} 
                              className={`pit-tire ${isSelected ? 'selected' : ''}`}
                              title={isWallSide ? 'Pit wall side (5.5s)' : 'Pit lane side (7s)'}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSandboxTire(corner)}
                              />
                              <span>{corner}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="pit-car-row">
                        {['LR', 'RR'].map((corner) => {
                          const isSelected = pitSandbox?.tires?.[corner];
                          const isWallSide = wallCorners.includes(corner);
                          return (
                            <label 
                              key={corner} 
                              className={`pit-tire ${isSelected ? 'selected' : ''}`}
                              title={isWallSide ? 'Pit wall side (5.5s)' : 'Pit lane side (7s)'}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSandboxTire(corner)}
                              />
                              <span>{corner}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                    </div>
                    <div className="pit-controls-panel">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  {/* Left Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 4,
                      padding: 12,
                      borderRadius: 8,
                      background: sandboxServiceTime === sandboxFuelingTime ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                      border: sandboxServiceTime === sandboxFuelingTime ? '2px solid var(--accent)' : '1px solid transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="stat-label">Fueling Time</span>
                        {sandboxServiceTime === sandboxFuelingTime && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600 }}>(Bottleneck)</span>
                        )}
                        {fuelingWithinBottleneck && (
                          <span style={{ 
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            fontWeight: 500
                          }}>
                            ({roundTo(sandboxServiceTime - sandboxFuelingTime, 2)}s within bottleneck)
                          </span>
                        )}
                      </div>
                      <div className="stat-value">{roundTo(sandboxFuelingTime, 2)} s</div>
                      <div className="stat-label" style={{ fontSize: '0.7rem' }}>
                        {sandboxFuelToAdd.toFixed(1)} L @ {sandboxTankCapacity} L tank
                      </div>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 4,
                      padding: 12,
                      borderRadius: 8,
                      background: sandboxServiceTime === sandboxTireTime ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                      border: sandboxServiceTime === sandboxTireTime ? '2px solid var(--accent)' : '1px solid transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="stat-label">Tire Service</span>
                        {sandboxServiceTime === sandboxTireTime && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600 }}>(Bottleneck)</span>
                        )}
                        {tiresWithinBottleneck && (
                          <span style={{ 
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            fontWeight: 500
                          }}>
                            ({roundTo(sandboxServiceTime - sandboxTireTime, 2)}s within bottleneck)
                          </span>
                        )}
                      </div>
                      <div className={`stat-value ${sandboxTireTime > 0 ? (tiresWithinBottleneck ? 'text-green' : '') : ''}`}>
                        {roundTo(sandboxTireTime, 2)} s
                      </div>
                      <div className="stat-label" style={{ fontSize: '0.7rem' }}>
                        {selectedCount > 0 ? Object.entries(selectedCorners).filter(([, v]) => v).map(([corner]) => corner).join(', ') : 'No tires selected'}
                      </div>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 4,
                      padding: 12,
                      borderRadius: 8,
                      background: sandboxServiceTime === sandboxDriverSwapTime ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                      border: sandboxServiceTime === sandboxDriverSwapTime ? '2px solid var(--accent)' : '1px solid transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="stat-label">Driver Swap</span>
                        {sandboxServiceTime === sandboxDriverSwapTime && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600 }}>(Bottleneck)</span>
                        )}
                        {driverSwapWithinBottleneck && (
                          <span style={{ 
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            fontWeight: 500
                          }}>
                            ({roundTo(sandboxServiceTime - sandboxDriverSwapTime, 2)}s within bottleneck)
                          </span>
                        )}
                      </div>
                      <div className="stat-value">{roundTo(sandboxDriverSwapTime, 2)} s</div>
                      <div className="stat-label" style={{ fontSize: '0.7rem' }}>
                        {sandboxDriverSwapTime > 0 ? '22s' : 'Not selected'}
                      </div>
                    </div>
                  </div>
                  {/* Right Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="stat-label">Total Service Time</span>
                      </div>
                      <div className="stat-value">{roundTo(sandboxServiceTime, 2)} s</div>
                      <div className="stat-label" style={{ fontSize: '0.7rem' }}>
                        Longest of fueling, tire service, or driver swap
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="stat-label">Total Pit Stop Time</span>
                      </div>
                      <div className="stat-value">{roundTo(sandboxTotalPitTime, 2)} s</div>
                      <div className="stat-label" style={{ fontSize: '0.7rem' }}>
                        Service ({roundTo(sandboxServiceTime, 2)}s) + Lane Delta ({roundTo(sandboxPitLaneDelta, 1)}s)
                      </div>
                    </div>
                  </div>
                </div>
                <p className="stat-label" style={{ marginTop: 8, fontSize: '0.7rem' }}>
                  Note: iRacing applies slight randomness to each tire change, so real stops may vary a few tenths. Times shown are as calculated based on your inputs.
                </p>
                    </div>
                  </div>
                );
              } catch (error) {
                console.error('Pit sandbox error:', error);
                return (
                  <div style={{ padding: '20px', color: 'var(--danger)' }}>
                    Error loading pit sandbox. Please refresh the page.
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}

      {activeTab === 'lap-times' && (
        <div className="tab-content">
          <div className="card">
            <SectionHeading
              title="Stint Modelling"
              helpText="Visualize and adjust lap times for each stint. Drag data points to modify individual lap times and see the total stint time update in real-time."
            />
            {(() => {
              try {
                const activeResult = selectedStrategy === 'standard' ? standardResult : fuelSavingResult;
                if (activeResult.errors?.length || !activeResult.stintPlan?.length) {
                  return (
                    <div className="empty-state" style={{ padding: '40px' }}>
                      {activeResult.errors?.length 
                        ? activeResult.errors.map((err, idx) => <div key={idx}>{err}</div>)
                        : 'Generate a strategy plan first to see lap-by-lap times.'}
                    </div>
                  );
                }
                
                // Calculate average lap without pits for the active strategy
                const timeOnTrack = activeResult.totalRaceTimeWithStops - activeResult.totalPitTime;
                const avgLapWithoutPits = activeResult.totalLaps > 0 && timeOnTrack > 0
                  ? timeOnTrack / activeResult.totalLaps
                  : 0;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {activeResult.stintPlan.map((stint) => {
                      const StintGraph = ({ avgLapWithoutPits }) => {
                        // Get the correct result based on strategy selection
                        const getStrategyResult = (strategy) => {
                          return strategy === 'standard' ? standardResult : fuelSavingResult;
                        };
                        
                        const [stintStrategy, setStintStrategy] = useState(selectedStrategy);
                        const strategyResult = useMemo(() => getStrategyResult(stintStrategy), [stintStrategy, standardResult, fuelSavingResult]);
                        const strategyStint = useMemo(() => 
                          strategyResult.stintPlan?.find(s => s.id === stint.id) || stint,
                          [strategyResult, stint.id]
                        );
                        
                        const lapSeconds = strategyResult.lapSeconds || activeResult.lapSeconds;
                        const outLapPenalties = [
                          safeNumber(form.outLapPenaltyOutLap),
                          safeNumber(form.outLapPenaltyLap1),
                          safeNumber(form.outLapPenaltyLap2),
                          safeNumber(form.outLapPenaltyLap3),
                        ].map((val) => (Number.isFinite(val) && val > 0 ? val : 0));
                        
                        // Generate default lap times: outlaps are slower, then gradually improve
                        const generateDefaultLapTimes = () => {
                          const times = [];
                          for (let lap = 1; lap <= strategyStint.laps; lap++) {
                            let baseTime = lapSeconds;
                            // Apply outlap penalties for first few laps
                            if (lap <= outLapPenalties.length && outLapPenalties[lap - 1]) {
                              baseTime += outLapPenalties[lap - 1];
                            }
                            // Make lap 3 slower (inlap)
                            if (lap === 3) {
                              baseTime += 0.5; // Add 0.5s penalty for inlap
                            }
                            // Gradually improve after penalties (simulate tire warm-up) - limited improvement
                            if (lap > outLapPenalties.length) {
                              const improvementFactor = Math.min(0.3, (lap - outLapPenalties.length) * 0.05);
                              baseTime -= improvementFactor;
                            }
                            times.push(Math.max(lapSeconds * 0.9, baseTime));
                          }
                          return times;
                        };

                        const [lapTimes, setLapTimes] = useState(generateDefaultLapTimes);
                        const [activePreset, setActivePreset] = useState(null); // Track which preset is active: 'standard' or 'fuel-saving'
                        const defaultLapTimes = useMemo(() => generateDefaultLapTimes(), [strategyStint.laps, lapSeconds, outLapPenalties, stintStrategy]);
                        
                        // Update lap times when strategy changes
                        useEffect(() => {
                          const newResult = getStrategyResult(stintStrategy);
                          const newStint = newResult.stintPlan?.find(s => s.id === stint.id);
                          if (newStint && newStint.laps !== lapTimes.length) {
                            // Regenerate lap times for new lap count
                            const newTimes = [];
                            for (let lap = 1; lap <= newStint.laps; lap++) {
                              let baseTime = lapSeconds;
                              if (lap <= outLapPenalties.length && outLapPenalties[lap - 1]) {
                                baseTime += outLapPenalties[lap - 1];
                              }
                            if (lap === 3) {
                              baseTime += 0.5;
                            }
                            if (lap > outLapPenalties.length) {
                              const improvementFactor = Math.min(0.3, (lap - outLapPenalties.length) * 0.05);
                              baseTime -= improvementFactor;
                            }
                              newTimes.push(Math.max(lapSeconds * 0.9, baseTime));
                            }
                            setLapTimes(newTimes);
                            setActivePreset(null);
                          }
                        }, [stintStrategy, lapSeconds, outLapPenalties, stint.id]);
                        
                        const resetToDefault = () => {
                          setLapTimes([...defaultLapTimes]);
                          setActivePreset(null);
                        };
                        
                        // Preset functions based on strategy - use the current strategyStint
                        const applyStandardPreset = (targetStint = strategyStint) => {
                          const standardLapTime = parseLapTime(form.averageLapTime) || lapSeconds;
                          const newTimes = [];
                          for (let lap = 1; lap <= targetStint.laps; lap++) {
                            let baseTime = standardLapTime;
                            if (lap <= outLapPenalties.length && outLapPenalties[lap - 1]) {
                              baseTime += outLapPenalties[lap - 1];
                            }
                            // Make lap 3 slower (inlap)
                            if (lap === 3) {
                              baseTime += 0.5; // Add 0.5s penalty for inlap
                            }
                            // Gradually improve after penalties (simulate tire warm-up) - limited improvement
                            if (lap > outLapPenalties.length) {
                              const improvementFactor = Math.min(0.3, (lap - outLapPenalties.length) * 0.05);
                              baseTime -= improvementFactor;
                            }
                            newTimes.push(Math.max(standardLapTime * 0.9, baseTime));
                          }
                          setLapTimes(newTimes);
                          setActivePreset('standard');
                        };

                        const applyFuelSavingPreset = (targetStint = strategyStint) => {
                          const fuelSavingLapTime = parseLapTime(form.fuelSavingLapTime) || lapSeconds;
                          const newTimes = [];
                          for (let lap = 1; lap <= targetStint.laps; lap++) {
                            let baseTime = fuelSavingLapTime;
                            if (lap <= outLapPenalties.length && outLapPenalties[lap - 1]) {
                              baseTime += outLapPenalties[lap - 1];
                            }
                            // Make lap 3 slower (inlap)
                            if (lap === 3) {
                              baseTime += 0.5; // Add 0.5s penalty for inlap
                            }
                            // Gradually improve after penalties (simulate tire warm-up) - limited improvement
                            if (lap > outLapPenalties.length) {
                              const improvementFactor = Math.min(0.3, (lap - outLapPenalties.length) * 0.05);
                              baseTime -= improvementFactor;
                            }
                            newTimes.push(Math.max(fuelSavingLapTime * 0.9, baseTime));
                          }
                          setLapTimes(newTimes);
                          setActivePreset('fuel-saving');
                        };
                        const [draggingIndex, setDraggingIndex] = useState(null);
                        const [hoverIndex, setHoverIndex] = useState(null);
                        const svgRef = useRef(null);

                        // Calculate graph dimensions and scales
                        const padding = { top: 40, right: 40, bottom: 50, left: 60 };
                        const width = 800;
                        const height = 400;
                        const graphWidth = width - padding.left - padding.right;
                        const graphHeight = height - padding.top - padding.bottom;

                        const minTime = Math.min(...lapTimes) * 0.98;
                        const maxTime = Math.max(...lapTimes) * 1.02;
                        const timeRange = maxTime - minTime;

                        const scaleX = (lapIndex) => padding.left + (lapIndex / (strategyStint.laps - 1 || 1)) * graphWidth;
                        const scaleY = (time) => padding.top + graphHeight - ((time - minTime) / timeRange) * graphHeight;

                        // Generate line path
                        const linePath = lapTimes.map((time, index) => {
                          const x = scaleX(index);
                          const y = scaleY(time);
                          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ');

                        const handleMouseDown = (e, index) => {
                          e.preventDefault();
                          setDraggingIndex(index);
                        };

                        const handleMouseMove = (e) => {
                          if (draggingIndex === null) return;
                          
                          const svg = svgRef.current;
                          if (!svg) return;
                          
                          const rect = svg.getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          
                          // Convert Y to time (only vertical dragging allowed)
                          const graphY = y - padding.top;
                          const normalizedY = 1 - (graphY / graphHeight);
                          const newTime = minTime + normalizedY * timeRange;
                          
                          // Clamp time to reasonable bounds
                          const clampedTime = Math.max(lapSeconds * 0.7, Math.min(lapSeconds * 1.5, newTime));
                          
                          setLapTimes(prev => {
                            const newTimes = [...prev];
                            newTimes[draggingIndex] = clampedTime;
                            return newTimes;
                          });
                        };

                        const handleMouseUp = () => {
                          setDraggingIndex(null);
                        };

                        // Use strategy stint duration and average, or calculate from lap times if modified
                        const strategyStintDuration = strategyStint.stintDuration || 0;
                        const strategyAvgLapTime = strategyStintDuration > 0 && strategyStint.laps > 0 
                          ? strategyStintDuration / strategyStint.laps 
                          : 0;
                        
                        const totalStintTime = lapTimes.reduce((sum, time) => sum + time, 0);
                        // Use strategy values if lap times haven't been modified, otherwise use calculated
                        const avgLapTime = activePreset === null && Math.abs(totalStintTime - strategyStintDuration) < 0.1
                          ? strategyAvgLapTime
                          : totalStintTime / strategyStint.laps;

                        // Generate Y-axis labels with rounded values
                        const yAxisLabels = [];
                        const numYLabels = 8;
                        for (let i = 0; i <= numYLabels; i++) {
                          const time = minTime + (timeRange * i / numYLabels);
                          // Round to nearest second for cleaner display
                          const roundedTime = Math.round(time);
                          yAxisLabels.push({
                            time: roundedTime,
                            y: scaleY(time),
                            label: formatLapTimeRounded(roundedTime)
                          });
                        }

                        return (
                          <div style={{ 
                            padding: 20, 
                            background: 'var(--surface-muted)', 
                            borderRadius: 16, 
                            border: '1px solid var(--border)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                              <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fbff' }}>
                                Stint {stint.id} - {strategyStint.laps} laps ({stintStrategy === 'standard' ? 'Standard' : 'Fuel-Saving'})
                              </h4>
                              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <label className="field-label" style={{ fontSize: '0.75rem', marginRight: 8 }}>
                                    Strategy:
                                  </label>
                                  <select
                                    value={stintStrategy}
                                    onChange={(e) => {
                                      const newStrategy = e.target.value;
                                      setStintStrategy(newStrategy);
                                      // Get the new strategy result and apply preset
                                      const newResult = getStrategyResult(newStrategy);
                                      const newStint = newResult.stintPlan?.find(s => s.id === stint.id);
                                      if (newStint) {
                                        // Apply the strategy preset based on selection with the new stint data
                                        if (newStrategy === 'standard') {
                                          applyStandardPreset(newStint);
                                        } else if (newStrategy === 'fuel-saving') {
                                          applyFuelSavingPreset(newStint);
                                        }
                                      }
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      background: 'var(--surface-muted)',
                                      color: 'var(--text)',
                                      border: '1px solid var(--border)',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                    }}
                                  >
                                    <option value="standard">Standard</option>
                                    <option value="fuel-saving">Fuel-Saving</option>
                                  </select>
                                  <button
                                    onClick={resetToDefault}
                                    style={{
                                      padding: '4px 8px',
                                      background: 'rgba(148, 163, 184, 0.15)',
                                      color: '#94a3b8',
                                      border: '1px solid #94a3b8',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '0.7rem',
                                      fontWeight: 500,
                                      marginLeft: 8,
                                    }}
                                    title="Reset to default line"
                                  >
                                    ↺
                                  </button>
                                </div>
                                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div className="stat-label" style={{ fontSize: '0.75rem', marginBottom: 2 }}>Total Stint Time</div>
                                    <div className="stat-value" style={{ fontSize: '1.3rem', fontWeight: 600 }}>
                                      {formatDuration(activePreset === null && Math.abs(totalStintTime - strategyStintDuration) < 0.1 
                                        ? strategyStintDuration 
                                        : totalStintTime)}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div className="stat-label" style={{ fontSize: '0.75rem', marginBottom: 2 }}>Average Lap</div>
                                    <div className="stat-value" style={{ 
                                      fontSize: '1.1rem', 
                                      fontWeight: 600, 
                                      color: stintStrategy === 'standard' ? '#0ea5e9' : '#10b981'
                                    }}>
                                      {formatLapTime(avgLapTime)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div 
                              style={{ 
                                position: 'relative',
                                background: 'var(--surface)',
                                borderRadius: 12,
                                padding: 16,
                                border: '1px solid var(--border)'
                              }}
                              onMouseMove={handleMouseMove}
                              onMouseUp={handleMouseUp}
                              onMouseLeave={handleMouseUp}
                            >
                              <svg
                                ref={svgRef}
                                width={width}
                                height={height}
                                style={{ display: 'block', cursor: draggingIndex !== null ? 'grabbing' : 'default' }}
                              >
                                {/* Grid lines */}
                                {yAxisLabels.map((label, idx) => (
                                  <g key={idx}>
                                    <line
                                      x1={padding.left}
                                      y1={label.y}
                                      x2={width - padding.right}
                                      y2={label.y}
                                      stroke="rgba(255, 255, 255, 0.08)"
                                      strokeWidth="1"
                                      strokeDasharray="2 4"
                                    />
                                  </g>
                                ))}
                                
                                {/* X-axis grid lines */}
                                {Array.from({ length: strategyStint.laps }, (_, i) => {
                                  const x = scaleX(i);
                                  return (
                                    <line
                                      key={i}
                                      x1={x}
                                      y1={padding.top}
                                      x2={x}
                                      y2={height - padding.bottom}
                                      stroke="rgba(255, 255, 255, 0.05)"
                                      strokeWidth="1"
                                    />
                                  );
                                })}

                                {/* Y-axis labels */}
                                {yAxisLabels.map((label, idx) => (
                                  <g key={idx}>
                                    <text
                                      x={padding.left - 12}
                                      y={label.y + 4}
                                      fill="var(--text-muted)"
                                      fontSize="11"
                                      textAnchor="end"
                                      style={{ userSelect: 'none' }}
                                    >
                                      {label.label}
                                    </text>
                                  </g>
                                ))}

                                {/* X-axis labels */}
                                {Array.from({ length: strategyStint.laps }, (_, i) => {
                                  const x = scaleX(i);
                                  const showLabel = i === 0 || i === strategyStint.laps - 1 || (i % Math.ceil(strategyStint.laps / 8) === 0);
                                  return showLabel ? (
                                    <text
                                      key={i}
                                      x={x}
                                      y={height - padding.bottom + 20}
                                      fill="var(--text-muted)"
                                      fontSize="11"
                                      textAnchor="middle"
                                      style={{ userSelect: 'none' }}
                                    >
                                      {i + 1}
                                    </text>
                                  ) : null;
                                })}

                                {/* Axis lines */}
                                <line
                                  x1={padding.left}
                                  y1={padding.top}
                                  x2={padding.left}
                                  y2={height - padding.bottom}
                                  stroke="var(--border)"
                                  strokeWidth="2"
                                />
                                <line
                                  x1={padding.left}
                                  y1={height - padding.bottom}
                                  x2={width - padding.right}
                                  y2={height - padding.bottom}
                                  stroke="var(--border)"
                                  strokeWidth="2"
                                />

                                {/* Line connecting points */}
                                <path
                                  d={linePath}
                                  fill="none"
                                  stroke={stintStrategy === 'standard' ? '#0ea5e9' : stintStrategy === 'fuel-saving' ? '#10b981' : 'var(--accent)'}
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{ filter: stintStrategy === 'standard' ? 'drop-shadow(0 2px 4px rgba(14, 165, 233, 0.3))' : stintStrategy === 'fuel-saving' ? 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.3))' : 'drop-shadow(0 2px 4px rgba(56, 189, 248, 0.3))' }}
                                />

                                {/* Data points */}
                                {lapTimes.map((time, index) => {
                                  const x = scaleX(index);
                                  const y = scaleY(time);
                                  const isDragging = draggingIndex === index;
                                  const isHovering = hoverIndex === index;
                                  
                                  return (
                                    <g key={index}>
                                      {/* Hover circle (larger, semi-transparent) */}
                                      {(isHovering || isDragging) && (
                                        <circle
                                          cx={x}
                                          cy={y}
                                          r="8"
                                          fill={stintStrategy === 'standard' ? '#0ea5e9' : stintStrategy === 'fuel-saving' ? '#10b981' : 'var(--accent)'}
                                          opacity="0.2"
                                        />
                                      )}
                                      {/* Main point */}
                                      <circle
                                        cx={x}
                                        cy={y}
                                        r={isDragging ? 7 : isHovering ? 6 : 5}
                                        fill={stintStrategy === 'standard' ? '#0ea5e9' : stintStrategy === 'fuel-saving' ? '#10b981' : 'var(--accent)'}
                                        stroke="#071321"
                                        strokeWidth="2"
                                        style={{ 
                                          cursor: 'grab',
                                          transition: isDragging ? 'none' : 'r 0.2s ease',
                                          filter: isDragging || isHovering 
                                            ? (stintStrategy === 'standard' ? 'drop-shadow(0 0 8px rgba(14, 165, 233, 0.6))' : stintStrategy === 'fuel-saving' ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))' : 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.6))')
                                            : (stintStrategy === 'standard' ? 'drop-shadow(0 2px 4px rgba(14, 165, 233, 0.3))' : stintStrategy === 'fuel-saving' ? 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.3))' : 'drop-shadow(0 2px 4px rgba(56, 189, 248, 0.3))')
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, index)}
                                        onMouseEnter={() => setHoverIndex(index)}
                                        onMouseLeave={() => setHoverIndex(null)}
                                      />
                                      {/* Tooltip */}
                                      {(isHovering || isDragging) && (
                                        <g>
                                          <rect
                                            x={x - 45}
                                            y={y - 45}
                                            width="90"
                                            height="32"
                                            rx="4"
                                            fill="rgba(2, 11, 22, 0.95)"
                                            stroke={stintStrategy === 'standard' ? '#0ea5e9' : stintStrategy === 'fuel-saving' ? '#10b981' : 'var(--accent)'}
                                            strokeWidth="1"
                                          />
                                          <text
                                            x={x}
                                            y={y - 28}
                                            fill={stintStrategy === 'standard' ? '#0ea5e9' : stintStrategy === 'fuel-saving' ? '#10b981' : 'var(--accent)'}
                                            fontSize="10"
                                            fontWeight="600"
                                            textAnchor="middle"
                                            style={{ userSelect: 'none' }}
                                          >
                                            Lap {index + 1}
                                          </text>
                                          <text
                                            x={x}
                                            y={y - 15}
                                            fill={stintStrategy === 'standard' ? '#0ea5e9' : stintStrategy === 'fuel-saving' ? '#10b981' : 'var(--accent)'}
                                            fontSize="11"
                                            fontWeight="600"
                                            textAnchor="middle"
                                            style={{ userSelect: 'none' }}
                                          >
                                            {formatLapTime(time)}
                                          </text>
                                        </g>
                                      )}
                                    </g>
                                  );
                                })}
                              </svg>

                              {/* Instructions */}
                              <div style={{ 
                                marginTop: 12, 
                                padding: 8, 
                                background: 'rgba(56, 189, 248, 0.1)', 
                                borderRadius: 6,
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                textAlign: 'center'
                              }}>
                                💡 Drag any point to adjust lap time • Total and average update in real-time
                              </div>
                            </div>
                          </div>
                        );
                      };

                      return <StintGraph key={stint.id} avgLapWithoutPits={avgLapWithoutPits} />;
                    })}
                  </div>
                );
              } catch (error) {
                console.error('Stint modelling tab error:', error);
                return (
                  <div style={{ padding: '20px', color: 'var(--danger)' }}>
                    Error loading stint modelling: {error.message || String(error)}. Please check the browser console for details.
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}

      {activeTab === 'release-notes' && (
        <div className="tab-content">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Release Notes</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 8, color: 'var(--accent)' }}>v0.1.0 - Initial Release</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <strong style={{ color: 'var(--text)' }}>Features:</strong>
                    <ul style={{ marginTop: 4, paddingLeft: 20, color: 'var(--text-muted)' }}>
                      <li>Multi-strategy planning (Standard, Fuel-Saving modes)</li>
                      <li>Detailed stint planner</li>
                      <li>Race schedule with driver assignment and lap mode selection</li>
                      <li>Plan vs. Reality Gantt chart visualization</li>
                      <li>Pit Stop Sandbox with dynamic fueling and tire change modeling</li>
                      <li>Driver swap time calculation (22s)</li>
                      <li>Formation lap fuel consumption tracking</li>
                      <li>Out-lap penalty modeling</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>Built for iRacing Endurance strategy preparation — race smarter.</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v0.1.0</span>
            <a 
              href="#release-notes" 
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('release-notes');
              }}
              style={{ 
                fontSize: '0.75rem', 
                color: 'var(--accent)', 
                textDecoration: 'none',
                cursor: 'pointer'
              }}
            >
              Release Notes
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('app-root'));
root.render(<PlannerApp />);
