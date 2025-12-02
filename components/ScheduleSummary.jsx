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
