const { useState, useMemo, useRef, useEffect } = React;

const defaultForm = {
  raceDurationMinutes: 180,
  averageLapTime: '01:43.500',
  fuelPerLap: 3.18,
  fuelSavingLapTime: '01:43.900',
  fuelSavingFuelPerLap: 3.07,
  tankCapacity: 106,
  fuelReserveLiters: 0.3,
  pitLaneDeltaSeconds: 27,
  stationaryServiceSeconds: 42,
  formationLapFuel: 1.5,
  minLapsPerStint: '',
  maxLapsPerStint: '',
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

// Get timezone acronym
const getTimezoneAcronym = (timezone) => {
  const acronyms = {
    'UTC': 'UTC',
    'Europe/London': 'GMT',
    'America/New_York': 'EST',
    'America/Los_Angeles': 'PST',
    'Europe/Paris': 'CET',
    'Europe/Berlin': 'CET',
    'Asia/Tokyo': 'JST',
    'Australia/Sydney': 'AEST',
  };
  return acronyms[timezone] || timezone.split('/').pop().substring(0, 3).toUpperCase();
};

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
  // Outlap penalties removed from UI but still used in calculations with default values
  const outLapPenalties = [
    safeNumber(form.outLapPenaltyOutLap) || 0,
    safeNumber(form.outLapPenaltyLap1) || 0,
    safeNumber(form.outLapPenaltyLap2) || 0,
    safeNumber(form.outLapPenaltyLap3) || 0,
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
  const estimatedFuelingTime = 41.1; // Full tank
  const estimatedPerStopLoss = pitLaneDelta + estimatedFuelingTime;
  
  // Simulate lap by lap until timer hits zero
  while (simulatedTime < raceDurationSeconds) {
    // Determine which lap we're on (for outlap penalties)
    const lapNumber = simulatedLaps + 1;
    let currentLapTime = lapSeconds; // Use the correct lapSeconds for this strategy
    
    // Apply outlap penalties for first few laps of race
    if (lapNumber <= outLapPenalties.length && outLapPenalties[lapNumber - 1]) {
      currentLapTime += outLapPenalties[lapNumber - 1];
    }
    
    // Check if adding this lap would exceed race duration
    if (simulatedTime + currentLapTime > raceDurationSeconds) {
      // Calculate fractional laps at the moment timer hits zero
      const timeIntoCurrentLap = simulatedTime + currentLapTime - raceDurationSeconds;
      const fractionOfLap = timeIntoCurrentLap / currentLapTime;
      fractionalLapsAtZero = simulatedLaps + (1 - fractionOfLap);
      
      // Full laps for planning = all completed laps + 1 final lap (white flag rule)
      fullLapsForPlanning = simulatedLaps + 1;
      break;
    }
    
    simulatedTime += currentLapTime; // Use currentLapTime, not lapTime
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
    // Simulation completed but didn't hit the break conditions
    // This means we completed all laps within the time limit
    if (simulatedTime < raceDurationSeconds) {
      const timeRemaining = raceDurationSeconds - simulatedTime;
      const additionalLaps = timeRemaining / lapSeconds;
      fractionalLapsAtZero = simulatedLaps + additionalLaps;
      fullLapsForPlanning = simulatedLaps + Math.ceil(additionalLaps);
      if (additionalLaps > 0 && additionalLaps < 1) {
        fullLapsForPlanning = simulatedLaps + 1;
      }
    } else {
      // Time ran out exactly
      fractionalLapsAtZero = simulatedLaps;
      fullLapsForPlanning = simulatedLaps + 1;
    }
  }
  
  // Use the simulated totalLaps for planning
  const totalLaps = fullLapsForPlanning > 0 ? fullLapsForPlanning : Math.ceil(fractionalLapsAtZero);
  const totalFuelNeeded = totalLaps * fuelPerLap;

  // NOW calculate stint count - OPTIMIZE to minimize stints by redistributing laps
  // For fuel-saving, we want to use fewer stints by extending stints up to fuel limit
  const maxLapsPerStintWithFuel = Math.floor(tankCapacity / fuelPerLap);

  // Try to minimize stints by redistributing laps
  // Start with minimum possible stints
  let stintCount = Math.ceil(totalLaps / maxLapsPerStintWithFuel);

  // Check if we can actually fit all laps with this stint count
  const avgLapsPerStint = totalLaps / stintCount;
  if (avgLapsPerStint > maxLapsPerStintWithFuel) {
    // Can't fit - need more stints
    stintCount = Math.ceil(totalLaps / maxLapsPerStintWithFuel);
  } else {
    // We can fit - but check if we can use even fewer stints by redistributing
    // Try one fewer stint
    let testStintCount = stintCount - 1;
    while (testStintCount > 0) {
      const testAvgLaps = totalLaps / testStintCount;
      if (testAvgLaps <= maxLapsPerStintWithFuel) {
        // Can fit with fewer stints - use this
        stintCount = testStintCount;
        testStintCount--; // Try even fewer
      } else {
        // Can't fit with fewer - stop
        break;
      }
    }
  }

  // Ensure we have at least 1 stint
  stintCount = Math.max(1, stintCount);
  
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
      
      // For ALL strategies: optimize last pit stop (before final stint) for splash-and-dash
      // Add only enough fuel to complete last stint with reserve left
      if (idx === stintCount - 2) {
        // This is the last pit stop before the final stint
        // Calculate fuel needed for last stint
        const lastStintLaps = totalLaps - completedLaps - lapsThisStint;
        const lastStintFuelNeeded = lastStintLaps * fuelPerLap + reserveLiters;
        // Fuel needed = what's needed for last stint minus what we'll have left after this stint
        fuelNeeded = Math.max(0, lastStintFuelNeeded - fuelLeft);
        // Cap at tank capacity
        fuelNeeded = Math.min(fuelNeeded, tankCapacity);
      }
      
      // Fueling takes 41.1 seconds for full tank, so time is proportional
      fuelingTime = (fuelNeeded / tankCapacity) * 41.1;
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
  // Ensure decimalLaps is calculated from the simulation using correct strategy parameters
  const decimalLaps = (() => {
    // If simulation set fractionalLapsAtZero, use it
    if (fractionalLapsAtZero > 0) {
      return fractionalLapsAtZero;
    }
    
    // If simulation ran but didn't set fractionalLapsAtZero, calculate from remaining time
    if (simulatedLaps > 0 && simulatedTime < raceDurationSeconds) {
      const timeRemaining = raceDurationSeconds - simulatedTime;
      return simulatedLaps + (timeRemaining / lapSeconds);
    }
    
    // If simulation didn't run (shouldn't happen), calculate directly from race duration
    // This ensures fuel-saving uses its own lap time, not standard
    return raceDurationSeconds / lapSeconds;
  })();
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

// Helper function to calculate tire service time (reused from pit stop modelling)
const calculateTireServiceTime = (tireChange, pitWallSide) => {
  const pitWallIsRight = pitWallSide === 'right';
  const wallCorners = pitWallIsRight ? ['RF', 'RR'] : ['LF', 'LR'];
  const frontCorners = ['LF', 'RF'];
  const rearCorners = ['LR', 'RR'];
  
  // Convert tireChange object to corner keys
  const selectedCornerKeys = Object.entries(tireChange)
    .filter(([corner, selected]) => selected)
    .map(([corner]) => {
      // Map left/right/front/rear to corner codes
      if (corner === 'left') return ['LF', 'LR'];
      if (corner === 'right') return ['RF', 'RR'];
      if (corner === 'front') return ['LF', 'RF'];
      if (corner === 'rear') return ['LR', 'RR'];
      return [];
    })
    .flat();
  
  const selectedCount = selectedCornerKeys.length;
  if (selectedCount === 0) return 0;
  
  const frontsSelectedOnly = frontCorners.every((corner) => selectedCornerKeys.includes(corner)) && 
                            !rearCorners.some((corner) => selectedCornerKeys.includes(corner));
  const rearsSelectedOnly = rearCorners.every((corner) => selectedCornerKeys.includes(corner)) && 
                           !frontCorners.some((corner) => selectedCornerKeys.includes(corner));
  
  if (frontsSelectedOnly) {
    return 10.5;
  } else if (rearsSelectedOnly) {
    return 12;
  } else {
    return selectedCornerKeys.reduce((total, corner) => {
      const wallCorner = wallCorners.includes(corner);
      return total + (wallCorner ? 5.5 : 7);
    }, 0);
  }
};

// Compact Pit Stop Interface Component
const PitStopInterface = ({ stint, nextStint, form, onPitStopChange, pitStopIndex }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fuelToAdd, setFuelToAdd] = useState(stint.fuelToAdd || 0);
  const [tireChange, setTireChange] = useState(stint.pitStop?.tireChange || {
    left: false,
    right: false,
    front: false,
    rear: false,
  });
  const [driverSwap, setDriverSwap] = useState(stint.pitStop?.driverSwap || false);
  const [pitWallSide, setPitWallSide] = useState(stint.pitStop?.pitWallSide || 'left');
  
  // Calculate pit stop times using EXACT same logic as Pit Stop Modelling
  const tankCapacity = safeNumber(form.tankCapacity) || 106;
  const pitWallIsRight = pitWallSide === 'right';
  const wallCorners = pitWallIsRight ? ['RF', 'RR'] : ['LF', 'LR'];
  const frontCorners = ['LF', 'RF'];
  const rearCorners = ['LR', 'RR'];
  
  // Convert tireChange object to corner format used in pit stop modelling
  const selectedCorners = {};
  if (tireChange.left) { selectedCorners['LF'] = true; selectedCorners['LR'] = true; }
  if (tireChange.right) { selectedCorners['RF'] = true; selectedCorners['RR'] = true; }
  if (tireChange.front) { selectedCorners['LF'] = true; selectedCorners['RF'] = true; }
  if (tireChange.rear) { selectedCorners['LR'] = true; selectedCorners['RR'] = true; }
  
  const selectedCornerKeys = Object.keys(selectedCorners);
  const selectedCount = selectedCornerKeys.length;
  
  // Calculate tire service time EXACTLY as in pit stop modelling
  let tireServiceTime = 0;
  if (selectedCount > 0) {
    const frontsSelectedOnly = frontCorners.every((corner) => selectedCorners[corner]) && !rearCorners.some((corner) => selectedCorners[corner]);
    const rearsSelectedOnly = rearCorners.every((corner) => selectedCorners[corner]) && !frontCorners.some((corner) => selectedCorners[corner]);
    if (frontsSelectedOnly) {
      tireServiceTime = 10.5;
    } else if (rearsSelectedOnly) {
      tireServiceTime = 12;
    } else {
      tireServiceTime = selectedCornerKeys.reduce((total, corner) => {
        const wallCorner = wallCorners.includes(corner);
        return total + (wallCorner ? 5.5 : 7);
      }, 0);
    }
  }
  
  // Calculate fueling time
  const fuelingTime = fuelToAdd > 0 ? (fuelToAdd / tankCapacity) * 41.1 : 0;
  const driverSwapTime = driverSwap ? 25 : 0;
  const serviceTime = Math.max(fuelingTime, tireServiceTime, driverSwapTime);
  const pitLaneDelta = safeNumber(form.pitLaneDeltaSeconds) || 27;
  const totalPitTime = serviceTime + pitLaneDelta;
  const bottleneck = serviceTime === fuelingTime ? 'fuel' : 
                     serviceTime === tireServiceTime ? 'tires' : 'driver';
  
  const handleChange = (updates) => {
    const newData = { fuelToAdd, tireChange, driverSwap, pitWallSide, ...updates };
    onPitStopChange(newData);
  };
  
  return (
    <div style={{
      margin: '8px 0',
      padding: '12px',
      background: 'rgba(56, 189, 248, 0.05)',
      borderRadius: '6px',
      border: '1px solid rgba(56, 189, 248, 0.15)',
    }}>
      {/* Compact Header - Always Visible */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          cursor: 'pointer',
          marginBottom: isExpanded ? '12px' : '0'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>
          Pit Stop {pitStopIndex}
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent)' }}>
            {roundTo(totalPitTime, 1)}s
          </div>
          <div style={{ 
            fontSize: '0.7rem',
            color: bottleneck === 'fuel' ? '#0ea5e9' : 
                   bottleneck === 'tires' ? '#f59e0b' : '#10b981',
            fontWeight: 600
          }}>
            {bottleneck === 'fuel' ? '⛽' : bottleneck === 'tires' ? '🛞' : '👤'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {isExpanded ? '▼' : '▶'}
          </div>
        </div>
      </div>
      
      {/* Expanded Configuration - Only when clicked */}
      {isExpanded && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(56, 189, 248, 0.1)'
        }}>
          {/* Left Column - Compact Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                Fuel (L)
              </label>
              <input
                type="number"
                defaultValue={fuelToAdd || ''}
                onBlur={(e) => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                  setFuelToAdd(val);
                  handleChange({ fuelToAdd: val });
                }}
                style={{ 
                  width: '100%', 
                  padding: '6px 8px', 
                  fontSize: '0.85rem',
                  background: 'var(--surface)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '4px' 
                }}
              />
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {roundTo(fuelingTime, 1)}s
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                Tires
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {['left', 'right', 'front', 'rear'].map(side => (
                  <label key={side} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    fontSize: '0.75rem'
                  }}>
                    <input
                      type="checkbox"
                      checked={tireChange[side]}
                      onChange={(e) => {
                        const newTireChange = { ...tireChange, [side]: e.target.checked };
                        setTireChange(newTireChange);
                        handleChange({ tireChange: newTireChange });
                      }}
                      style={{ width: '14px', height: '14px' }}
                    />
                    {side.charAt(0).toUpperCase() + side.slice(1)}
                  </label>
                ))}
              </div>
              <div style={{ marginTop: '6px' }}>
                <select
                  value={pitWallSide}
                  onChange={(e) => {
                    setPitWallSide(e.target.value);
                    handleChange({ pitWallSide: e.target.value });
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '4px 6px', 
                    fontSize: '0.75rem',
                    background: 'var(--surface)', 
                    border: '1px solid var(--border)', 
                    borderRadius: '4px' 
                  }}
                >
                  <option value="left">Pit Wall: Left</option>
                  <option value="right">Pit Wall: Right</option>
                </select>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {roundTo(tireServiceTime, 1)}s
              </div>
            </div>
            
            <div>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontSize: '0.75rem'
              }}>
                <input
                  type="checkbox"
                  checked={driverSwap}
                  onChange={(e) => {
                    setDriverSwap(e.target.checked);
                    handleChange({ driverSwap: e.target.checked });
                  }}
                  style={{ width: '14px', height: '14px' }}
                />
                Driver Swap
              </label>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {driverSwapTime > 0 ? '25s' : 'Not selected'}
              </div>
            </div>
          </div>
          
          {/* Right Column - Compact Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
            <div style={{ 
              padding: '8px',
              background: bottleneck === 'fuel' ? 'rgba(14, 165, 233, 0.1)' :
                         bottleneck === 'tires' ? 'rgba(245, 158, 11, 0.1)' :
                         'rgba(16, 185, 129, 0.1)',
              borderRadius: '4px',
              border: `1px solid ${bottleneck === 'fuel' ? 'rgba(14, 165, 233, 0.3)' :
                              bottleneck === 'tires' ? 'rgba(245, 158, 11, 0.3)' :
                              'rgba(16, 185, 129, 0.3)'}`
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                Service Time
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                {roundTo(serviceTime, 1)}s
              </div>
            </div>
            
            <div style={{ padding: '8px', background: 'var(--surface-muted)', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                Total Pit Stop
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent)' }}>
                {roundTo(totalPitTime, 1)}s
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Service + Lane ({pitLaneDelta}s)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StintPlanCard = ({
  plan,
  reservePerStint = 0,
  formationLapFuel = 0,
  form,
  onReorder,
}) => {
  const [reorderedPlan, setReorderedPlan] = useState(plan);
  
  useEffect(() => {
    setReorderedPlan(plan);
  }, [plan]);
  
  if (!plan?.length) {
    return <div className="empty-state">Enter race details to generate a stint plan.</div>;
  }

  // Drag and drop removed - stints are no longer reorderable

  // Recalculate all stint data - ensure subsequent stints respect fuel added
  const recalculateStintPlan = (newPlan, form, reservePerStint, formationLapFuel) => {
    const tankCapacity = safeNumber(form.tankCapacity) || 106;
    const fuelPerLap = safeNumber(form.fuelPerLap) || 3.18;
    const pitLaneDelta = safeNumber(form.pitLaneDeltaSeconds) || 27;
    const lapSeconds = parseLapTime(form.averageLapTime) || 103.5;
    
    let fuelInTank = tankCapacity; // Start with full tank
    
    return newPlan.map((stint, idx) => {
      const isFirstStint = idx === 0;
      const isLastStint = idx === newPlan.length - 1;
      
      // Use fuelToAdd from pit stop configuration if it exists, otherwise calculate
      let fuelToAdd = stint.fuelToAdd;
      if (fuelToAdd === undefined && !isLastStint) {
        // Calculate fuel needed for this stint
        const baseFuelNeeded = stint.laps * fuelPerLap + reservePerStint;
        const fuelNeeded = isFirstStint && formationLapFuel > 0
          ? Math.max(0, baseFuelNeeded - formationLapFuel)
          : baseFuelNeeded;
        const fuelUsed = Math.min(fuelNeeded, fuelInTank);
        const fuelLeft = fuelInTank - fuelUsed;
        
        // Calculate fuel to add at next pit stop
        const nextStintFuelNeeded = newPlan[idx + 1].laps * fuelPerLap + reservePerStint;
        fuelToAdd = Math.max(0, nextStintFuelNeeded - fuelLeft);
        fuelToAdd = Math.min(fuelToAdd, tankCapacity);
      } else if (fuelToAdd === undefined) {
        fuelToAdd = 0;
      }
      
      // Calculate fuel needed for this stint
      const baseFuelNeeded = stint.laps * fuelPerLap + reservePerStint;
      const fuelNeeded = isFirstStint && formationLapFuel > 0
        ? Math.max(0, baseFuelNeeded - formationLapFuel)
        : baseFuelNeeded;
      const fuelUsed = Math.min(fuelNeeded, fuelInTank);
      const fuelLeft = fuelInTank - fuelUsed;
      
      // Calculate fueling time
      const fuelingTime = fuelToAdd > 0 ? (fuelToAdd / tankCapacity) * 41.1 : 0;
      
      // Get pit stop configuration if exists
      const pitStop = stint.pitStop || {
        tireChange: { left: false, right: false, front: false, rear: false },
        driverSwap: false,
        pitWallSide: 'left',
        fuelToAdd: fuelToAdd,
      };
      
      // Ensure fuelToAdd is in pit stop config
      if (pitStop.fuelToAdd === undefined) {
        pitStop.fuelToAdd = fuelToAdd;
      }
      
      // Calculate tire service time if tires are changed (using exact pit stop modelling logic)
      const pitWallIsRight = pitStop.pitWallSide === 'left' ? false : true;
      const wallCorners = pitWallIsRight ? ['RF', 'RR'] : ['LF', 'LR'];
      const frontCorners = ['LF', 'RF'];
      const rearCorners = ['LR', 'RR'];
      
      const selectedCorners = {};
      if (pitStop.tireChange.left) { selectedCorners['LF'] = true; selectedCorners['LR'] = true; }
      if (pitStop.tireChange.right) { selectedCorners['RF'] = true; selectedCorners['RR'] = true; }
      if (pitStop.tireChange.front) { selectedCorners['LF'] = true; selectedCorners['RF'] = true; }
      if (pitStop.tireChange.rear) { selectedCorners['LR'] = true; selectedCorners['RR'] = true; }
      
      const selectedCornerKeys = Object.keys(selectedCorners);
      const selectedCount = selectedCornerKeys.length;
      
      let tireServiceTime = 0;
      if (selectedCount > 0) {
        const frontsSelectedOnly = frontCorners.every((corner) => selectedCorners[corner]) && !rearCorners.some((corner) => selectedCorners[corner]);
        const rearsSelectedOnly = rearCorners.every((corner) => selectedCorners[corner]) && !frontCorners.some((corner) => selectedCorners[corner]);
        if (frontsSelectedOnly) {
          tireServiceTime = 10.5;
        } else if (rearsSelectedOnly) {
          tireServiceTime = 12;
        } else {
          tireServiceTime = selectedCornerKeys.reduce((total, corner) => {
            const wallCorner = wallCorners.includes(corner);
            return total + (wallCorner ? 5.5 : 7);
          }, 0);
        }
      }
      
      const driverSwapTime = pitStop.driverSwap ? 25 : 0;
      const serviceTime = Math.max(fuelingTime, tireServiceTime, driverSwapTime);
      const perStopLoss = !isLastStint ? pitLaneDelta + serviceTime : 0;
      
      // Update fuel in tank for next stint - CRITICAL: use fuelToAdd from pit stop config
      const actualFuelToAdd = pitStop.fuelToAdd !== undefined ? pitStop.fuelToAdd : fuelToAdd;
      fuelInTank = fuelLeft + actualFuelToAdd;
      
      // Calculate stint duration
      const stintSeconds = stint.laps * lapSeconds;
      
      return {
        ...stint,
        fuel: fuelUsed,
        fuelLeft: fuelLeft,
        fuelToAdd: actualFuelToAdd,
        fuelingTime: fuelingTime,
        perStopLoss: perStopLoss,
        stintDuration: stintSeconds,
        pitStop: pitStop,
      };
    });
  };

  return (
    <div className="stint-list">
      {reorderedPlan.map((stint, idx) => {
        const isFirstStint = idx === 0;
        const isLastStint = idx === reorderedPlan.length - 1;
        const nextStint = !isLastStint ? reorderedPlan[idx + 1] : null;
        const usableFuel = Math.max(stint.fuel - reservePerStint - (isFirstStint ? formationLapFuel : 0), 0);
        const fuelPerLapTarget = stint.laps ? usableFuel / stint.laps : 0;
        const perLapDisplay = fuelPerLapTarget.toFixed(2);

        return (
          <div key={stint.id} style={{ display: 'contents' }}>
            <div
              className="stint-item"
            >
              <div>
                <strong>Stint {stint.id}</strong>
                {/* Add fuel tank at start */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '4px' }}>
                  Fuel at Start: {idx === 0 ? roundTo(safeNumber(form.tankCapacity) || 106, 1) : roundTo((reorderedPlan[idx - 1]?.fuelLeft || 0) + (reorderedPlan[idx - 1]?.fuelToAdd || 0), 1)} L
                </div>
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
                <div className="stat-value" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  {perLapDisplay} L
                  {/* Move tooltip here and explain formation lap */}
                  <span className="help-badge" tabIndex={0}>
                    <span className="help-icon" style={{ fontSize: '0.7rem' }}>ℹ</span>
                    <span className="help-tooltip">
                      Target fuel consumption per lap. {isFirstStint && formationLapFuel > 0 ? `Formation lap fuel (${roundTo(formationLapFuel, 1)} L) is already accounted for in this calculation.` : 'Based on usable fuel and number of laps.'}
                    </span>
                  </span>
                </div>
                {stint.fuelLeft !== undefined && (
                  <div className="stat-label" style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                    Fuel Left: {roundTo(stint.fuelLeft, 1)} L
                  </div>
                )}
              </div>
            </div>
            
            {/* Pit Stop Interface (between stints) */}
            {!isLastStint && nextStint && (
              <PitStopInterface
                stint={stint}
                nextStint={nextStint}
                form={form}
                onPitStopChange={(pitStopData) => {
                  // Update pit stop data and recalculate
                  const updatedPlan = [...reorderedPlan];
                  updatedPlan[idx].pitStop = pitStopData;
                  const recalculated = recalculateStintPlan(updatedPlan, form, reservePerStint, formationLapFuel);
                  setReorderedPlan(recalculated);
                  if (onReorder) {
                    onReorder(recalculated);
                  }
                }}
              />
            )}
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
                    Start ({getTimezoneAcronym(item.driver?.timezone || 'UTC')})
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
                    End ({getTimezoneAcronym(item.driver?.timezone || 'UTC')})
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
  // Load from localStorage or use defaults
  const loadFromStorage = (key, defaultValue) => {
    try {
      const stored = localStorage.getItem(`iracing-planner-${key}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  };
  
  const saveToStorage = (key, value) => {
    try {
      localStorage.setItem(`iracing-planner-${key}`, JSON.stringify(value));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
  };
  
  const [form, setForm] = useState(() => loadFromStorage('form', defaultForm));
  const [drivers, setDrivers] = useState(() => loadFromStorage('drivers', [
    { id: Date.now(), name: 'John', timezone: 'UTC', color: '#0ea5e9' },
    { id: Date.now() + 1, name: 'Jack', timezone: 'UTC', color: '#8b5cf6' },
  ]));
  const [raceStartGMTTime, setRaceStartGMTTime] = useState(() => loadFromStorage('raceStartGMTTime', '12:00:00'));
  const [raceStartGameTime, setRaceStartGameTime] = useState(() => loadFromStorage('raceStartGameTime', '08:00:00'));
  const [delayTime, setDelayTime] = useState(() => loadFromStorage('delayTime', '44:00'));
  const [fuelCalc, setFuelCalc] = useState(() => loadFromStorage('fuelCalc', {
    fuelRemaining: '',
    targetLaps: '',
    fuelReserve: '0.3',
  }));
  const [delayInputMode, setDelayInputMode] = useState('manual'); // 'manual' or 'log'
  const [stintActualEndTimes, setStintActualEndTimes] = useState(() => loadFromStorage('stintActualEndTimes', {}));
  const [stintModelling, setStintModelling] = useState(() => loadFromStorage('stintModelling', {
    baselineLapTime: '02:04.000',
    numLaps: 30,
    standardLapTime: '',
    standardLaps: '',
    fuelSavingLapTime: '',
    fuelSavingLaps: '',
  }));
  const [stintActualLaps, setStintActualLaps] = useState(() => loadFromStorage('stintActualLaps', {}));
  const [stintDrivers, setStintDrivers] = useState(() => loadFromStorage('stintDrivers', {}));
  const [stintLapModes, setStintLapModes] = useState(() => loadFromStorage('stintLapModes', {}));
  const [stintEndInputModes, setStintEndInputModes] = useState({}); // 'manual' or 'log' per stint
  const [stintReplayTimestamps, setStintReplayTimestamps] = useState({}); // Store replay timestamp input per stint
  
  // Save to localStorage whenever state changes
  useEffect(() => {
    saveToStorage('form', form);
  }, [form]);
  
  useEffect(() => {
    saveToStorage('drivers', drivers);
  }, [drivers]);
  
  useEffect(() => {
    saveToStorage('raceStartGMTTime', raceStartGMTTime);
  }, [raceStartGMTTime]);
  
  useEffect(() => {
    saveToStorage('raceStartGameTime', raceStartGameTime);
  }, [raceStartGameTime]);
  
  useEffect(() => {
    saveToStorage('delayTime', delayTime);
  }, [delayTime]);
  
  useEffect(() => {
    saveToStorage('fuelCalc', fuelCalc);
  }, [fuelCalc]);
  
  useEffect(() => {
    saveToStorage('stintActualEndTimes', stintActualEndTimes);
  }, [stintActualEndTimes]);
  
  useEffect(() => {
    saveToStorage('stintActualLaps', stintActualLaps);
  }, [stintActualLaps]);
  
  useEffect(() => {
    saveToStorage('stintDrivers', stintDrivers);
  }, [stintDrivers]);
  
  useEffect(() => {
    saveToStorage('stintLapModes', stintLapModes);
  }, [stintLapModes]);
  
  useEffect(() => {
    saveToStorage('stintModelling', stintModelling);
  }, [stintModelling]);
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
  const sandboxFuelingTime = sandboxFuelToAdd > 0 ? (sandboxFuelToAdd / sandboxTankCapacity) * 41.1 : 0;
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
  const sandboxDriverSwapTime = pitSandbox.driverSwap ? 25 : 0;
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
    // Outlap penalties removed from UI but still used in calculations with default values
    const outLapPenalties = [
      safeNumber(form.outLapPenaltyOutLap) || 0,
      safeNumber(form.outLapPenaltyLap1) || 0,
      safeNumber(form.outLapPenaltyLap2) || 0,
      safeNumber(form.outLapPenaltyLap3) || 0,
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
        fuelingTime = (fuelNeeded / tankCapacity) * 41.1;
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
          Stint Model
        </button>
        <button
          className={activeTab === 'sandbox' ? 'active' : ''}
          onClick={() => setActiveTab('sandbox')}
        >
          Pit Calculator
        </button>
        <button
          className={activeTab === 'fuel-calculator' ? 'active' : ''}
          onClick={() => setActiveTab('fuel-calculator')}
        >
          Fuel Calculator
        </button>
      </div>

      {activeTab === 'setup' && (
        <div className="tab-content">
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Configure race parameters, fuel consumption, and pit stop settings. These values are used to calculate optimal strategy and stint planning.
            </p>
          </div>
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

          </div>
        </div>
      )}


      {activeTab === 'strategy' && (
        <div className="tab-content">
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              View calculated strategy plans for Standard and Fuel-Saving modes. Compare total laps, pit stops, and race times. Use the detailed stint planner to refine individual stints.
            </p>
          </div>
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
          const ReorderableStintPlanCard = () => {
            const [reorderedStints, setReorderedStints] = useState(activeResult.errors?.length ? [] : activeResult.stintPlan);
            
            useEffect(() => {
              setReorderedStints(activeResult.errors?.length ? [] : activeResult.stintPlan);
            }, [activeResult.stintPlan, activeResult.errors]);
            
            return (
              <>
              <StintPlanCard
                plan={reorderedStints}
                reservePerStint={reservePerStint}
                formationLapFuel={Number(form.formationLapFuel) || 0}
                form={form}
                onReorder={(newPlan) => {
                  setReorderedStints(newPlan);
                }}
              />
                {!activeResult.errors?.length && reorderedStints.length > 0 && (
                  <StrategyGraph plan={reorderedStints} perStopLoss={activeResult.perStopLoss} />
                )}
              </>
            );
          };
          
          return <ReorderableStintPlanCard />;
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
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Assign drivers to stints, log actual lap counts and end times during the race. Compare planned vs. actual performance with visual indicators and the plan vs. reality graph.
            </p>
          </div>
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
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Model pit stop times by configuring tire changes, fuel amounts, and driver swaps. See which service is the bottleneck and optimize your pit strategy.
            </p>
          </div>
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
                const sandboxFuelingTime = sandboxFuelToAdd > 0 ? (sandboxFuelToAdd / sandboxTankCapacity) * 41.1 : 0;
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
                const sandboxDriverSwapTime = pitSandbox?.driverSwap ? 25 : 0;
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
                            ({roundTo(sandboxServiceTime - sandboxFuelingTime, 1)}s within bottleneck)
                          </span>
                        )}
                      </div>
                      <div className="stat-value">{roundTo(sandboxFuelingTime, 1)} s</div>
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
                            ({roundTo(sandboxServiceTime - sandboxTireTime, 1)}s within bottleneck)
                          </span>
                        )}
                      </div>
                      <div className={`stat-value ${sandboxTireTime > 0 ? (tiresWithinBottleneck ? 'text-green' : '') : ''}`}>
                        {roundTo(sandboxTireTime, 1)} s
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
                            ({roundTo(sandboxServiceTime - sandboxDriverSwapTime, 1)}s within bottleneck)
                          </span>
                        )}
                      </div>
                      <div className="stat-value">{roundTo(sandboxDriverSwapTime, 1)} s</div>
                      <div className="stat-label" style={{ fontSize: '0.7rem' }}>
                        {sandboxDriverSwapTime > 0 ? '25s' : 'Not selected'}
                      </div>
                    </div>
                  </div>
                  {/* Right Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="stat-label">Total Service Time</span>
                      </div>
                      <div className="stat-value">{roundTo(sandboxServiceTime, 1)} s</div>
                      <div className="stat-label" style={{ fontSize: '0.7rem' }}>
                        Longest of fueling, tire service, or driver swap
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="stat-label">Total Pit Stop Time</span>
                      </div>
                      <div className="stat-value">{roundTo(sandboxTotalPitTime, 1)} s</div>
                      <div className="stat-label" style={{ fontSize: '0.7rem' }}>
                        Service ({roundTo(sandboxServiceTime, 1)}s) + Lane Delta ({roundTo(sandboxPitLaneDelta, 1)}s)
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
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Model lap times for a stint. Set baseline lap time, number of laps, and see how tyre warming penalties affect the stint.
            </p>
          </div>
          <div className="card">
            <SectionHeading
              title="Stint Modelling"
              helpText="Model lap times for a stint. Set baseline lap time, number of laps, and see how tyre warming penalties affect the stint."
            />
            {(() => {
              try {
                const StintGraph = () => {
                  // Get values from Setup tab, but allow overriding
                  // Pre-populate from Strategy tab if available
                  const defaultStandardLaps = standardResult?.stintPlan?.[0]?.laps || 0;
                  const defaultFuelSavingLaps = fuelSavingResult?.stintPlan?.[0]?.laps || 0;
                  
                  const standardLapTime = parseLapTime(stintModelling.standardLapTime || form.averageLapTime) || 103.5;
                  const fuelSavingLapTime = parseLapTime(stintModelling.fuelSavingLapTime || form.fuelSavingLapTime) || 103.9;
                  const standardLaps = parseInt(stintModelling.standardLaps || defaultStandardLaps) || 0;
                  const fuelSavingLaps = parseInt(stintModelling.fuelSavingLaps || defaultFuelSavingLaps) || 0;
                  
                  // Tyre warming penalties relative to lap 4: lap 1 = +3, lap 2 = +1.5, lap 3 = +0.5, lap 4 = baseline
                  const tyreWarmingPenalties = [3, 1.5, 0.5]; // Applied to laps 1, 2, 3
                  
                  // Generate default lap times - always decreasing (lap 1 > 2 > 3 > 4 > 5 > ...)
                  const generateDefaultLapTimes = (baseline, laps) => {
                    const times = [];
                    const midLap = Math.ceil(laps / 2);
                    
                    for (let lap = 1; lap <= laps; lap++) {
                      let baseTime = baseline;
                      
                      // Laps 1-5: Always decreasing penalties (lap 1 slowest, lap 5 fastest of first 5)
                      if (lap === 1) {
                        baseTime += 3.0; // Slowest
                      } else if (lap === 2) {
                        baseTime += 1.5; // Faster than lap 1
                      } else if (lap === 3) {
                        baseTime += 1.0; // Faster than lap 2 (includes inlap penalty)
                      } else if (lap === 4) {
                        baseTime += 0.3; // Faster than lap 3
                      } else if (lap === 5) {
                        baseTime += 0.1; // Faster than lap 4
                      }
                      // Lap 6+ continues decreasing
                      
                      // After lap 5: Continue decreasing toward middle, then stay flat or improve slightly
                      if (lap > 5) {
                        if (lap < midLap) {
                          // Before middle: gradually improve (decrease time) as we approach middle
                          const lapsFromMid = midLap - lap;
                          // Make it gradually faster (smaller time) - use negative multiplier
                          baseTime = baseTime * (1 - (lapsFromMid * 0.0003));
                        } else if (lap > midLap) {
                          // After middle: can stay same or improve slightly
                          const lapsFromMid = lap - midLap;
                          baseTime = baseTime * (1 - (lapsFromMid * 0.0002)); // Slight improvement
                        }
                        // lap === midLap stays at baseline (fastest)
                      }
                      
                      times.push(baseTime);
                    }
                    return times;
                  };
                  
                  // Generate lap times for both strategies
                  const standardLapTimes = useMemo(() => {
                    if (!standardLaps || standardLaps <= 0) return [];
                    return generateDefaultLapTimes(standardLapTime, standardLaps);
                  }, [standardLapTime, standardLaps]);
                  
                  const fuelSavingLapTimes = useMemo(() => {
                    if (!fuelSavingLaps || fuelSavingLaps <= 0) return [];
                    return generateDefaultLapTimes(fuelSavingLapTime, fuelSavingLaps);
                  }, [fuelSavingLapTime, fuelSavingLaps]);
                  
                  const [standardLapTimesState, setStandardLapTimesState] = useState(standardLapTimes);
                  const [fuelSavingLapTimesState, setFuelSavingLapTimesState] = useState(fuelSavingLapTimes);
                  const [standardDraggingIndex, setStandardDraggingIndex] = useState(null);
                  const [fuelSavingDraggingIndex, setFuelSavingDraggingIndex] = useState(null);
                  const [standardHoverIndex, setStandardHoverIndex] = useState(null);
                  const [fuelSavingHoverIndex, setFuelSavingHoverIndex] = useState(null);
                  const svgRef = useRef(null);
                  
                  // Update when inputs change
                  useEffect(() => {
                    setStandardLapTimesState(standardLapTimes);
                  }, [standardLapTimes]);
                  
                  useEffect(() => {
                    setFuelSavingLapTimesState(fuelSavingLapTimes);
                  }, [fuelSavingLapTimes]);
                  
                  // Calculate metrics
                  const standardTotalTime = standardLapTimesState.reduce((sum, time) => sum + time, 0);
                  const standardAvgLap = standardLaps > 0 ? standardTotalTime / standardLaps : 0;
                  
                  const fuelSavingTotalTime = fuelSavingLapTimesState.reduce((sum, time) => sum + time, 0);
                  const fuelSavingAvgLap = fuelSavingLaps > 0 ? fuelSavingTotalTime / fuelSavingLaps : 0;
                  
                  // Graph dimensions
                  const padding = { top: 40, right: 40, bottom: 50, left: 60 };
                  const width = 800;
                  const height = 400;
                  const graphWidth = width - padding.left - padding.right;
                  const graphHeight = height - padding.top - padding.bottom;
                  
                  // Calculate min/max for both lines with tighter zoom
                  const allTimes = [...standardLapTimesState, ...fuelSavingLapTimesState];
                  const minTime = allTimes.length > 0 ? Math.min(...allTimes) * 0.995 : 100; // Tighter zoom
                  const maxTime = allTimes.length > 0 ? Math.max(...allTimes) * 1.005 : 110; // Tighter zoom
                  const timeRange = maxTime - minTime;
                  
                  const maxLaps = Math.max(standardLaps, fuelSavingLaps);
                  
                  const scaleX = (lapIndex) => padding.left + (lapIndex / (maxLaps - 1 || 1)) * graphWidth;
                  const scaleY = (time) => padding.top + graphHeight - ((time - minTime) / timeRange) * graphHeight;
                  
                  // Generate line paths
                  const standardLinePath = standardLapTimesState.map((time, index) => {
                    const x = scaleX(index);
                    const y = scaleY(time);
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ');
                  
                  const fuelSavingLinePath = fuelSavingLapTimesState.map((time, index) => {
                    const x = scaleX(index);
                    const y = scaleY(time);
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ');

                  // Generate Y-axis labels with normalized values (rounded to clean intervals)
                  const yAxisLabels = [];
                  const numYLabels = 8;
                  for (let i = 0; i <= numYLabels; i++) {
                    const time = minTime + (timeRange * i / numYLabels);
                    // Round to nearest 0.1 second for cleaner display
                    const roundedTime = Math.round(time * 10) / 10;
                    yAxisLabels.push({
                      time: roundedTime,
                      y: scaleY(time),
                      label: formatLapTime(roundedTime)
                    });
                  }
                  
                  // Drag handlers for standard line
                  const handleStandardMouseDown = (e, index) => {
                    e.preventDefault();
                    setStandardDraggingIndex(index);
                  };
                  
                  // Drag handlers for fuel-saving line
                  const handleFuelSavingMouseDown = (e, index) => {
                    e.preventDefault();
                    setFuelSavingDraggingIndex(index);
                  };
                  
                  const handleMouseMove = (e) => {
                    const draggingIndex = standardDraggingIndex !== null ? standardDraggingIndex : fuelSavingDraggingIndex;
                    const isStandard = standardDraggingIndex !== null;
                    
                    if (draggingIndex === null) return;
                    
                    const svg = svgRef.current;
                    if (!svg) return;
                    
                    const rect = svg.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    
                    const graphY = y - padding.top;
                    const normalizedY = 1 - (graphY / graphHeight);
                    const newTime = minTime + normalizedY * timeRange;
                    
                    const baseline = isStandard ? standardLapTime : fuelSavingLapTime;
                    const clampedTime = Math.max(baseline * 0.7, Math.min(baseline * 1.5, newTime));
                    
                    if (isStandard) {
                      setStandardLapTimesState(prev => {
                        const newTimes = [...prev];
                        newTimes[draggingIndex] = clampedTime;
                        return newTimes;
                      });
                    } else {
                      setFuelSavingLapTimesState(prev => {
                        const newTimes = [...prev];
                        newTimes[draggingIndex] = clampedTime;
                        return newTimes;
                      });
                    }
                  };
                  
                  const handleMouseUp = () => {
                    setStandardDraggingIndex(null);
                    setFuelSavingDraggingIndex(null);
                  };

                  // Calculate fuel consumption difference for comparison
                  const fuelPerLap = safeNumber(form.fuelPerLap) || 3.18;
                  const fuelSavingFuelPerLap = safeNumber(form.fuelSavingFuelPerLap) || 3.07;
                  const fuelSavingsPercent = ((fuelPerLap - fuelSavingFuelPerLap) / fuelPerLap * 100).toFixed(1);
                  const timeDelta = fuelSavingTotalTime - standardTotalTime;

                  return (
                    <div style={{ 
                      padding: 20, 
                      background: 'var(--surface-muted)', 
                      borderRadius: 16, 
                      border: '1px solid var(--border)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                    }}>
                      {/* One block above graph: inputs left, metrics right */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: '24px',
                        marginBottom: '24px',
                        padding: '16px',
                        background: 'var(--surface)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)'
                      }}>
                        {/* Left - Inputs */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div>
                            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '8px' }}>
                              Standard Lap Time
                              <span title="Standard strategy lap time (inherited from Setup)" style={{ cursor: 'help', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', border: '1px solid var(--text-muted)' }}>?</span>
                            </label>
                            <input
                              type="text"
                              placeholder="MM:SS.sss"
                              defaultValue={stintModelling.standardLapTime || form.averageLapTime}
                              onBlur={(e) => {
                                const value = e.target.value;
                                setStintModelling(prev => ({ ...prev, standardLapTime: value }));
                              }}
                              style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem' }}
                            />
                          </div>
                          <div>
                            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '8px' }}>
                              Standard Laps
                              <span title="Number of laps for standard strategy" style={{ cursor: 'help', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', border: '1px solid var(--text-muted)' }}>?</span>
                            </label>
                            <input
                              type="number"
                              defaultValue={stintModelling.standardLaps || defaultStandardLaps}
                              onBlur={(e) => {
                                const value = e.target.value;
                                setStintModelling(prev => ({ ...prev, standardLaps: value }));
                              }}
                              style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem' }}
                            />
                          </div>
                          <div>
                            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '8px' }}>
                              Fuel-Saving Lap Time
                              <span title="Fuel-saving strategy lap time (inherited from Setup)" style={{ cursor: 'help', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', border: '1px solid var(--text-muted)' }}>?</span>
                            </label>
                            <input
                              type="text"
                              placeholder="MM:SS.sss"
                              defaultValue={stintModelling.fuelSavingLapTime || form.fuelSavingLapTime}
                              onBlur={(e) => {
                                const value = e.target.value;
                                setStintModelling(prev => ({ ...prev, fuelSavingLapTime: value }));
                              }}
                              style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem' }}
                            />
                          </div>
                          <div>
                            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '8px' }}>
                              Fuel-Saving Laps
                              <span title="Number of laps for fuel-saving strategy" style={{ cursor: 'help', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', border: '1px solid var(--text-muted)' }}>?</span>
                            </label>
                            <input
                              type="number"
                              defaultValue={stintModelling.fuelSavingLaps || defaultFuelSavingLaps}
                              onBlur={(e) => {
                                const value = e.target.value;
                                setStintModelling(prev => ({ ...prev, fuelSavingLaps: value }));
                              }}
                              style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem' }}
                            />
                          </div>
                        </div>
                        
                        {/* Right - Metrics & Comparison */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {/* Standard Metrics */}
                          <div style={{ padding: 12, background: 'rgba(14, 165, 233, 0.1)', borderRadius: 8, border: '1px solid rgba(14, 165, 233, 0.3)' }}>
                            <div className="stat-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Standard Strategy</div>
                            <div style={{ marginTop: '8px' }}>
                              <div className="stat-label" style={{ fontSize: '0.7rem' }}>Avg Lap</div>
                              <div className="stat-value" style={{ fontSize: '1rem', color: '#0ea5e9' }}>{formatLapTime(standardAvgLap)}</div>
                            </div>
                            <div style={{ marginTop: '8px' }}>
                              <div className="stat-label" style={{ fontSize: '0.7rem' }}>Total Time</div>
                              <div className="stat-value" style={{ fontSize: '1rem', color: '#0ea5e9' }}>{formatDuration(standardTotalTime)}</div>
                            </div>
                          </div>
                          
                          {/* Fuel-Saving Metrics */}
                          <div style={{ padding: 12, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                            <div className="stat-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Fuel-Saving Strategy</div>
                            <div style={{ marginTop: '8px' }}>
                              <div className="stat-label" style={{ fontSize: '0.7rem' }}>Avg Lap</div>
                              <div className="stat-value" style={{ fontSize: '1rem', color: '#10b981' }}>{formatLapTime(fuelSavingAvgLap)}</div>
                            </div>
                            <div style={{ marginTop: '8px' }}>
                              <div className="stat-label" style={{ fontSize: '0.7rem' }}>Total Time</div>
                              <div className="stat-value" style={{ fontSize: '1rem', color: '#10b981' }}>{formatDuration(fuelSavingTotalTime)}</div>
                            </div>
                          </div>
                          
                          {/* Comparison Metric - Standard vs Fuel-Saving */}
                          {standardLaps > 0 && fuelSavingLaps > 0 && standardLaps === fuelSavingLaps && (
                            <div style={{ 
                              padding: 12, 
                              background: 'rgba(14, 165, 233, 0.1)', 
                              borderRadius: 8, 
                              border: '1px solid rgba(14, 165, 233, 0.3)' 
                            }}>
                              <div className="stat-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>
                                Time Advantage ({standardLaps} laps)
                              </div>
                              <div className="stat-value" style={{ 
                                fontSize: '1.2rem', 
                                color: '#0ea5e9',
                                fontWeight: 600
                              }}>
                                {formatDuration(Math.abs(timeDelta))}
                              </div>
                              <div className="stat-label" style={{ fontSize: '0.7rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                                Standard is faster
                              </div>
                              
                              {/* Additional Context */}
                              <div style={{ 
                                marginTop: '12px', 
                                padding: '8px', 
                                background: 'rgba(255, 255, 255, 0.05)', 
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                lineHeight: '1.5'
                              }}>
                                <div style={{ marginBottom: '6px', fontWeight: 600 }}>
                                  <strong>Consider:</strong>
                                </div>
                                <div style={{ marginBottom: '4px' }}>
                                  • {formatDuration(Math.abs(timeDelta))} faster per stint
                                </div>
                                <div style={{ marginBottom: '4px' }}>
                                  • Fuel-saving uses {fuelSavingsPercent}% less fuel
                                </div>
                                <div>
                                  • May allow longer stints = fewer pit stops
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Graph as standalone block */}
                      <div>

                      {/* Graph SVG with drag points and tooltips */}
                      <div 
                        style={{ position: 'relative', background: 'var(--surface)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      >
                        <svg width={width} height={height} style={{ display: 'block', cursor: (standardDraggingIndex !== null || fuelSavingDraggingIndex !== null) ? 'grabbing' : 'default' }} ref={svgRef}>
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
                          
                          {/* X-axis grid lines - increments of 5 */}
                          {Array.from({ length: Math.ceil(maxLaps / 5) }, (_, i) => {
                            const lapNum = (i + 1) * 5;
                            if (lapNum > maxLaps) return null;
                            const x = scaleX(lapNum - 1);
                            return (
                              <line
                                key={lapNum}
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

                          {/* X-axis labels - increments of 5 */}
                          {Array.from({ length: Math.ceil(maxLaps / 5) }, (_, i) => {
                            const lapNum = (i + 1) * 5;
                            if (lapNum > maxLaps) return null;
                            const x = scaleX(lapNum - 1);
                            return (
                              <text
                                key={lapNum}
                                x={x}
                                y={height - padding.bottom + 20}
                                fill="var(--text-muted)"
                                fontSize="11"
                                textAnchor="middle"
                                style={{ userSelect: 'none' }}
                              >
                                {lapNum}
                              </text>
                            );
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

                          {/* Standard line (blue) */}
                          {standardLapTimesState.length > 0 && (
                            <path
                              d={standardLinePath}
                              fill="none"
                              stroke="#0ea5e9"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ filter: 'drop-shadow(0 2px 4px rgba(14, 165, 233, 0.3))' }}
                            />
                          )}
                          
                          {/* Fuel-saving line (green) */}
                          {fuelSavingLapTimesState.length > 0 && (
                            <path
                              d={fuelSavingLinePath}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.3))' }}
                            />
                          )}
                          
                          {/* Standard data points with drag and hover */}
                          {standardLapTimesState.map((time, index) => {
                            const x = scaleX(index);
                            const y = scaleY(time);
                            const isDragging = standardDraggingIndex === index;
                            const isHovering = standardHoverIndex === index;
                            
                            return (
                              <g key={`std-${index}`}>
                                {(isHovering || isDragging) && (
                                  <circle cx={x} cy={y} r="8" fill="#0ea5e9" opacity="0.2" />
                                )}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r={isDragging ? 7 : isHovering ? 6 : 5}
                                  fill="#0ea5e9"
                                  stroke="#071321"
                                  strokeWidth="2"
                                  style={{ cursor: 'grab', transition: isDragging ? 'none' : 'r 0.2s ease' }}
                                  onMouseDown={(e) => handleStandardMouseDown(e, index)}
                                  onMouseEnter={() => setStandardHoverIndex(index)}
                                  onMouseLeave={() => setStandardHoverIndex(null)}
                                />
                                {(isHovering || isDragging) && (
                                  <g>
                                    <rect x={x - 45} y={y - 45} width="90" height="32" rx="4" fill="rgba(2, 11, 22, 0.95)" stroke="#0ea5e9" strokeWidth="1" />
                                    <text x={x} y={y - 28} fill="#0ea5e9" fontSize="10" fontWeight="600" textAnchor="middle" style={{ userSelect: 'none' }}>
                                      Lap {index + 1}
                                    </text>
                                    <text x={x} y={y - 15} fill="#0ea5e9" fontSize="11" fontWeight="600" textAnchor="middle" style={{ userSelect: 'none' }}>
                                      {formatLapTime(time)}
                                    </text>
                                  </g>
                                )}
                              </g>
                            );
                          })}
                          
                          {/* Fuel-saving data points with drag and hover */}
                          {fuelSavingLapTimesState.map((time, index) => {
                            const x = scaleX(index);
                            const y = scaleY(time);
                            const isDragging = fuelSavingDraggingIndex === index;
                            const isHovering = fuelSavingHoverIndex === index;
                            
                            return (
                              <g key={`fs-${index}`}>
                                {(isHovering || isDragging) && (
                                  <circle cx={x} cy={y} r="8" fill="#10b981" opacity="0.2" />
                                )}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r={isDragging ? 7 : isHovering ? 6 : 5}
                                  fill="#10b981"
                                  stroke="#071321"
                                  strokeWidth="2"
                                  style={{ cursor: 'grab', transition: isDragging ? 'none' : 'r 0.2s ease' }}
                                  onMouseDown={(e) => handleFuelSavingMouseDown(e, index)}
                                  onMouseEnter={() => setFuelSavingHoverIndex(index)}
                                  onMouseLeave={() => setFuelSavingHoverIndex(null)}
                                />
                                {(isHovering || isDragging) && (
                                  <g>
                                    <rect x={x - 45} y={y - 45} width="90" height="32" rx="4" fill="rgba(2, 11, 22, 0.95)" stroke="#10b981" strokeWidth="1" />
                                    <text x={x} y={y - 28} fill="#10b981" fontSize="10" fontWeight="600" textAnchor="middle" style={{ userSelect: 'none' }}>
                                      Lap {index + 1}
                                    </text>
                                    <text x={x} y={y - 15} fill="#10b981" fontSize="11" fontWeight="600" textAnchor="middle" style={{ userSelect: 'none' }}>
                                      {formatLapTime(time)}
                                    </text>
                                  </g>
                                )}
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                      </div>
                      
                      {/* Right Column - Outputs & Comparison */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Standard Metrics */}
                        <div style={{ padding: 12, background: 'rgba(14, 165, 233, 0.1)', borderRadius: 8, border: '1px solid rgba(14, 165, 233, 0.3)' }}>
                          <div className="stat-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Standard Strategy</div>
                          <div style={{ marginTop: '8px' }}>
                            <div className="stat-label" style={{ fontSize: '0.7rem' }}>Avg Lap</div>
                            <div className="stat-value" style={{ fontSize: '1rem', color: '#0ea5e9' }}>{formatLapTime(standardAvgLap)}</div>
                          </div>
                          <div style={{ marginTop: '8px' }}>
                            <div className="stat-label" style={{ fontSize: '0.7rem' }}>Total Time</div>
                            <div className="stat-value" style={{ fontSize: '1rem', color: '#0ea5e9' }}>{formatDuration(standardTotalTime)}</div>
                          </div>
                        </div>
                        
                        {/* Fuel-Saving Metrics */}
                        <div style={{ padding: 12, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          <div className="stat-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Fuel-Saving Strategy</div>
                          <div style={{ marginTop: '8px' }}>
                            <div className="stat-label" style={{ fontSize: '0.7rem' }}>Avg Lap</div>
                            <div className="stat-value" style={{ fontSize: '1rem', color: '#10b981' }}>{formatLapTime(fuelSavingAvgLap)}</div>
                          </div>
                          <div style={{ marginTop: '8px' }}>
                            <div className="stat-label" style={{ fontSize: '0.7rem' }}>Total Time</div>
                            <div className="stat-value" style={{ fontSize: '1rem', color: '#10b981' }}>{formatDuration(fuelSavingTotalTime)}</div>
                          </div>
                        </div>
                        
                        {/* Comparison Metric - Standard vs Fuel-Saving */}
                        {standardLaps > 0 && fuelSavingLaps > 0 && standardLaps === fuelSavingLaps && (
                          <div style={{ 
                            padding: 12, 
                            background: 'rgba(14, 165, 233, 0.1)', 
                            borderRadius: 8, 
                            border: '1px solid rgba(14, 165, 233, 0.3)' 
                          }}>
                            <div className="stat-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>
                              Time Advantage ({standardLaps} laps)
                            </div>
                            <div className="stat-value" style={{ 
                              fontSize: '1.2rem', 
                              color: '#0ea5e9',
                              fontWeight: 600
                            }}>
                              {formatDuration(Math.abs(timeDelta))}
                            </div>
                            <div className="stat-label" style={{ fontSize: '0.7rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                              Standard is faster
                            </div>
                            
                            {/* Additional Context */}
                            <div style={{ 
                              marginTop: '12px', 
                              padding: '8px', 
                              background: 'rgba(255, 255, 255, 0.05)', 
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
                              lineHeight: '1.5'
                            }}>
                              <div style={{ marginBottom: '6px', fontWeight: 600 }}>
                                <strong>Consider:</strong>
                              </div>
                              <div style={{ marginBottom: '4px' }}>
                                • {formatDuration(Math.abs(timeDelta))} faster per stint
                              </div>
                              <div style={{ marginBottom: '4px' }}>
                                • Fuel-saving uses {fuelSavingsPercent}% less fuel
                              </div>
                              <div>
                                • May allow longer stints = fewer pit stops
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                };

                return <StintGraph />;

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

      {activeTab === 'fuel-calculator' && (
        <div className="tab-content">
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Calculate target fuel consumption per lap to achieve your target laps. View sensitivity analysis showing how fuel consumption variations affect possible lap counts.
            </p>
          </div>
          
          <div className="card">
            <SectionHeading title="Fuel Calculator" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
              <InputField
                label="Fuel Remaining"
                suffix="L"
                type="number"
                value={fuelCalc.fuelRemaining}
                onChange={(e) => setFuelCalc(prev => ({ ...prev, fuelRemaining: e.target.value }))}
                step="0.1"
                helpText="Current fuel remaining in the tank"
              />
              <InputField
                label="Target Laps"
                type="number"
                value={fuelCalc.targetLaps}
                onChange={(e) => setFuelCalc(prev => ({ ...prev, targetLaps: e.target.value }))}
                step="0.1"
                helpText="Number of laps you want to complete"
              />
              <InputField
                label="Fuel Reserve"
                suffix="L"
                type="number"
                value={fuelCalc.fuelReserve}
                onChange={(e) => setFuelCalc(prev => ({ ...prev, fuelReserve: e.target.value }))}
                step="0.1"
                helpText="Reserve fuel to keep in tank at the end"
              />
            </div>
            
            {/* Results */}
            {(() => {
              const fuelRemaining = parseFloat(fuelCalc.fuelRemaining) || 0;
              const targetLaps = parseFloat(fuelCalc.targetLaps) || 0;
              const fuelReserve = parseFloat(fuelCalc.fuelReserve) || 0;
              const usableFuel = fuelRemaining - fuelReserve;
              const targetFuelPerLap = targetLaps > 0 ? usableFuel / targetLaps : 0;
              
              return (
                <div style={{ marginTop: 24 }}>
                  <div style={{ padding: 16, background: 'var(--surface-muted)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span className="stat-label">Target Fuel Consumption</span>
                      <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>
                        {targetFuelPerLap > 0 ? targetFuelPerLap.toFixed(2) : '--'} L/lap
                      </div>
                    </div>
                    <div className="stat-label" style={{ fontSize: '0.75rem' }}>
                      {usableFuel > 0 ? `${usableFuel.toFixed(1)} L usable fuel ÷ ${targetLaps} laps` : 'Enter values to calculate'}
                    </div>
                  </div>
                  
                  {/* Sensitivity Chart */}
                  {targetFuelPerLap > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <h4 style={{ marginBottom: 16, fontSize: '1rem' }}>Sensitivity Analysis</h4>
                      <div style={{ padding: 16, background: 'var(--surface-muted)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                          <div>
                            <span className="stat-label" style={{ fontSize: '0.75rem' }}>Fuel Consumption</span>
                          </div>
                          <div>
                            <span className="stat-label" style={{ fontSize: '0.75rem' }}>Possible Laps</span>
                          </div>
                        </div>
                        {(() => {
                          const variations = [-0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2];
                          return variations.map((variation) => {
                            const testFuelPerLap = targetFuelPerLap + variation;
                            const possibleLaps = testFuelPerLap > 0 ? usableFuel / testFuelPerLap : 0;
                            const isTarget = variation === 0;
                            return (
                              <div 
                                key={variation}
                                style={{ 
                                  display: 'grid', 
                                  gridTemplateColumns: '1fr 1fr', 
                                  gap: 12,
                                  padding: '8px 12px',
                                  background: isTarget ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                                  borderRadius: 4,
                                  border: isTarget ? '1px solid var(--accent)' : 'none'
                                }}
                              >
                                <div style={{ fontSize: '0.85rem', color: isTarget ? 'var(--accent)' : 'var(--text)' }}>
                                  {testFuelPerLap.toFixed(2)} L/lap {variation !== 0 && `(${variation > 0 ? '+' : ''}${variation.toFixed(2)} L)`}
                                </div>
                                <div style={{ fontSize: '0.85rem', fontWeight: isTarget ? 600 : 400, color: isTarget ? 'var(--accent)' : 'var(--text)' }}>
                                  {possibleLaps.toFixed(2)} laps
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
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
                <h3 style={{ fontSize: '1.1rem', marginBottom: 8, color: 'var(--accent)' }}>v0.2.0 - Fuel Calculator & Improvements</h3>
                <ul style={{ marginTop: 8, paddingLeft: 20, color: 'var(--text-muted)' }}>
                  <li>New Fuel Calculator tab with sensitivity analysis</li>
                  <li>Removed outlap penalties from Setup (still used in calculations)</li>
                  <li>Added helpful descriptions to each tab</li>
                  <li>Improved UI clarity and organization</li>
                </ul>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 8, marginTop: 24, color: 'var(--accent)' }}>v0.1.0 - Initial Release</h3>
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
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v0.2.0</span>
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
