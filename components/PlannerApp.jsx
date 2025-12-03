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
  const sandboxPitLaneDelta = pitSandbox?.pitLaneDelta !== undefined && pitSandbox?.pitLaneDelta !== '' 
    ? Number(pitSandbox.pitLaneDelta) 
    : (Number(form.pitLaneDeltaSeconds) || 0);
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
    const { value, type } = event.target;
    // For number inputs, handle empty values and invalid numbers more gracefully
    if (type === 'number') {
      // For race duration specifically, always ensure it's a valid number to prevent app breakage
      if (field === 'raceDurationMinutes') {
        const numValue = parseFloat(value);
        if (value === '' || isNaN(numValue) || numValue <= 0) {
          // Use a safe default (1 minute) instead of 0 or empty to prevent computePlan errors
          setForm((prev) => ({
            ...prev,
            [field]: value === '' ? 1 : (isNaN(numValue) ? 1 : Math.max(1, numValue)),
          }));
        } else {
          setForm((prev) => ({
            ...prev,
            [field]: numValue,
          }));
        }
      } else {
        const numValue = parseFloat(value);
        if (value === '' || isNaN(numValue)) {
          // Allow empty for intermediate typing, but use 0 as fallback for calculations
          setForm((prev) => ({
            ...prev,
            [field]: value === '' ? '' : 0,
          }));
        } else {
          setForm((prev) => ({
            ...prev,
            [field]: numValue,
          }));
        }
      }
    } else {
      setForm((prev) => ({
        ...prev,
        [field]: value === '' ? '' : value,
      }));
    }
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
          Schedule <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: '4px' }}>(WIP)</span>
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
              Configure race duration, session timing, fuel parameters, and strategy mode settings. These values are used to calculate optimal strategy and stint planning.
            </p>
          </div>
          <div className="inputs-grid">
        <div className="card">
          <SectionHeading title="Race Parameters" />
          <InputField
            label="Race Duration"
            suffix="min"
            type="number"
            value={form.raceDurationMinutes}
            onChange={handleInput('raceDurationMinutes')}
            helpText="Scheduled race length from the event info. Determines total laps when combined with lap time."
          />
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
                      const gmtTime = parseTimeOnly(raceStartGMTTime);
                      if (gmtTime) {
                        const gmtDate = new Date();
                        gmtDate.setHours(gmtTime.hours, gmtTime.minutes, gmtTime.seconds || 0, 0);
                        const diffMs = now.getTime() - gmtDate.getTime();
                        if (diffMs > 0) {
                          const diffMins = Math.floor(diffMs / 60000);
                          const diffSecs = Math.floor((diffMs % 60000) / 1000);
                          setDelayTime(`${diffMins}:${diffSecs.toString().padStart(2, '0')}`);
                        }
                      }
                    }
                  }}
                  className="secondary-button"
                  style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                >
                  Log Now
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {delayTime || 'Not logged'}
                </span>
              </div>
            )}
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
              Delay between the start of the session and the start of the first stint (MM:SS format). Can include practice, quali, formation lap.
            </p>
          </div>
        </div>

        <div className="card">
          <SectionHeading title="Fuel and Pit Parameters" />
          <InputField
            label="Tank Capacity"
            suffix="L"
            type="number"
            value={form.tankCapacity}
            onChange={handleInput('tankCapacity')}
            helpText="Base fuel tank capacity. The effective capacity is reduced by Fuel BoP percentage."
          />
          <InputField
            label="Fuel BoP"
            suffix="%"
            type="number"
            value={form.fuelBoP || 0}
            onChange={handleInput('fuelBoP')}
            step="0.01"
            helpText="Balance of Performance adjustment. Percentage reduction to fuel tank capacity (e.g., 0.25% = 0.25). Applied as tank capacity × (1 - BoP/100)."
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
          <InputField
            label="Pit Lane Delta"
            suffix="sec"
            type="number"
            value={form.pitLaneDeltaSeconds}
            onChange={handleInput('pitLaneDeltaSeconds')}
            helpText="Time from pit entry to exit when just driving through. Already accounts for the shorter lane distance."
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
              helpText="Slower lap time when fuel saving (typically 0.2-0.5s slower)."
            />
            <InputField
              label="Fuel-Saving Fuel / Lap"
              suffix="L"
              type="number"
              value={form.fuelSavingFuelPerLap}
              onChange={handleInput('fuelSavingFuelPerLap')}
              step="0.01"
              helpText="Lower fuel consumption when fuel saving (typically 0.1-0.15L less)."
            />
          </div>
          <div className="input-row">
            <InputField
              label="Extra Fuel-Saving Lap Time"
              placeholder="MM:SS.sss"
              value={form.extraFuelSavingLapTime}
              onChange={handleInput('extraFuelSavingLapTime')}
              helpText="Slowest lap time for maximum fuel efficiency (typically 0.3-0.5s slower than fuel-saving)."
            />
            <InputField
              label="Extra Fuel-Saving Fuel / Lap"
              suffix="L"
              type="number"
              value={form.extraFuelSavingFuelPerLap}
              onChange={handleInput('extraFuelSavingFuelPerLap')}
              step="0.01"
              helpText="Lowest fuel consumption for maximum range (typically 0.1-0.15L less than fuel-saving)."
            />
          </div>
          <div style={{ 
            marginTop: 16, 
            padding: '10px 12px', 
            background: 'rgba(56, 189, 248, 0.08)', 
            borderRadius: 6, 
            border: '1px solid rgba(56, 189, 248, 0.15)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}>
            💡 Fine-tune lap times and fuel consumption for each stint in <strong style={{ color: '#38bdf8' }}>Stint Model</strong> tab.
          </div>
        </div>

          </div>
        </div>
      )}


      {activeTab === 'strategy' && (
        <StrategyTab
          form={form}
          standardResult={standardResult}
          fuelSavingResult={fuelSavingResult}
          strategyConfigs={strategyConfigs}
          selectedStrategy={selectedStrategy}
          setSelectedStrategy={setSelectedStrategy}
          strategyRecommendation={strategyRecommendation}
          reservePerStint={reservePerStint}
        />
      )}

      {activeTab === 'schedule' && (
        <div className="tab-content">
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Assign drivers to stints and log actual lap counts and end times during the race. View the complete schedule with timezone conversions and compare planned vs. actual performance.
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
                const sandboxPitLaneDelta = pitSandbox?.pitLaneDelta !== undefined && pitSandbox?.pitLaneDelta !== '' 
                  ? Number(pitSandbox.pitLaneDelta) 
                  : (Number(form?.pitLaneDeltaSeconds) || 0);
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
                  
                  {/* 4. Pit Lane Delta */}
                  <InputField
                    label="Pit Lane Delta"
                    suffix="s"
                    type="number"
                    value={pitSandbox?.pitLaneDelta !== undefined ? pitSandbox.pitLaneDelta : (form?.pitLaneDeltaSeconds || '')}
                    onChange={(e) => updatePitSandbox('pitLaneDelta', e.target.value)}
                    helpText="Time lost entering and exiting pit lane. Leave empty to use value from Setup tab."
                  />
                  
                  {/* 5. Tire Change */}
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
