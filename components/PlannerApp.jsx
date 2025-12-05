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
              Model stint pace with physics. <strong style={{color: '#fff'}}>Standard Lap Time</strong> sets the baseline (Lap 4). 
              The graph automatically calculates Laps 1-3 (Cold Tires) and Lap 5+ (Fuel Burn vs. Tire Deg).
              <br />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4, display: 'block' }}>
                Note: This comparison uses the same number of laps for both strategies, even though fuel saving may allow completing one additional lap.
              </span>
            </p>
          </div>
          <div className="card">
            <SectionHeading
              title="Stint Modelling"
              helpText="Model lap times with physics (Tire warming, fuel burn, and degradation) and calculate the ROI of fuel saving (Time lost vs. Range gained)."
            />
            {(() => {
              try {
                const StintGraph = () => {
                  // -- 1. STATE & DEFAULTS --
                  
                  // Pull defaults from Setup tab or previous inputs
                  const defaultLaps = standardResult?.stintPlan?.[0]?.laps || 25;
                  const defaultBaseFuel = parseFloat(form.fuelPerLap) || 3.0;
                  const defaultSaving = (parseFloat(form.fuelPerLap) - parseFloat(form.fuelSavingFuelPerLap)) || 0.15;
                  
                  // State for Inputs
                  const [baselineInput, setBaselineInput] = useState(stintModelling.standardLapTime || form.averageLapTime || '02:00.000');
                  const [numLaps, setNumLaps] = useState(parseInt(stintModelling.standardLaps || defaultLaps) || 25);
                  
                  // Physics Parameters
                  const [fuelSaveOffset, setFuelSaveOffset] = useState(stintModelling.fuelSaveOffset ?? 0.8); // Seconds slower for fuel saving
                  const [fuelBurnFactor, setFuelBurnFactor] = useState(stintModelling.fuelBurnFactor ?? 0.05); // Seconds gained per lap (lightening)
                  const [tireDegFactor, setTireDegFactor] = useState(stintModelling.tireDegFactor ?? 0.05);   // Seconds lost per lap (wear)
                  
                  // Fuel Consumption Parameters (New - Decoupled from Setup)
                  const [baseFuelConsumption, setBaseFuelConsumption] = useState(stintModelling.baseFuelConsumption ?? defaultBaseFuel);
                  const [fuelSavingPerLap, setFuelSavingPerLap] = useState(stintModelling.fuelSavingPerLap ?? Math.max(0.01, defaultSaving));

                  // Helper to parse/format
                  const baselineSeconds = useMemo(() => parseLapTime(baselineInput) || 120, [baselineInput]);

                  // -- 2. PHYSICS MODEL --
                  
                  // Generate the "Master" (Standard) curve
                  const generateStandardCurve = (base, laps, burnFactor, degFactor) => {
                    const times = [];
                    for (let lap = 1; lap <= laps; lap++) {
                      let time = base;

                      // Cold Tire Phase (Laps 1-3) - Fixed Penalties
                      if (lap === 1) time += 3.5;      // Outlap/Cold tires
                      else if (lap === 2) time += 1.5; // Warming up
                      else if (lap === 3) time += 0.5; // Almost there
                      
                      // Warm Phase (Lap 4+)
                      // Lap 4 is the exact baseline input (0.0 offset)
                      else {
                        const lapsRunning = lap - 4; 
                        // Physics: (Fuel Burn makes us faster) + (Tire Deg makes us slower)
                        const burnEffect = lapsRunning * burnFactor;
                        const degEffect = lapsRunning * degFactor;
                        time = time - burnEffect + degEffect;
                      }
                      times.push(time);
                    }
                    return times;
                  };

                  // Initial calculation
                  const calculatedStandardTimes = useMemo(() => {
                    return generateStandardCurve(baselineSeconds, numLaps, fuelBurnFactor, tireDegFactor);
                  }, [baselineSeconds, numLaps, fuelBurnFactor, tireDegFactor]);

                  // State for the draggable points (initialized with calculated physics)
                  const [standardLapTimesState, setStandardLapTimesState] = useState(calculatedStandardTimes);

                  // Reset state if inputs change significantly (rudimentary sync)
                  useEffect(() => {
                    setStandardLapTimesState(calculatedStandardTimes);
                  }, [calculatedStandardTimes]);

                  // Derive Fuel Saving line (Slave) from Standard line (Master)
                  const fuelSavingLapTimesState = useMemo(() => {
                    return standardLapTimesState.map((t, idx) => {
                      const lap = idx + 1;
                      // Logic: Fuel save line is identical for Laps 1-3 (cold tires dictate pace),
                      // then simply shifted by offset for Lap 4+
                      if (lap <= 3) return t;
                      return t + fuelSaveOffset;
                    });
                  }, [standardLapTimesState, fuelSaveOffset]);
                  
                  // -- 3. GRAPH INTERACTIONS --

                  const [draggingIndex, setDraggingIndex] = useState(null);
                  const [hoverIndex, setHoverIndex] = useState(null);
                  const svgRef = useRef(null);

                  // Graph Dimensions
                  const padding = { top: 40, right: 40, bottom: 50, left: 60 };
                  const width = 800;
                  const height = 400;
                  const graphWidth = width - padding.left - padding.right;
                  const graphHeight = height - padding.top - padding.bottom;

                  // Scales
                  const allTimes = [...standardLapTimesState, ...fuelSavingLapTimesState];
                  const minTime = Math.min(...allTimes) - 0.5;
                  const maxTime = Math.max(...allTimes) + 0.5;
                  const timeRange = maxTime - minTime || 1;

                  const scaleX = (lapIndex) => padding.left + (lapIndex / (numLaps - 1 || 1)) * graphWidth;
                  const scaleY = (time) => padding.top + graphHeight - ((time - minTime) / timeRange) * graphHeight;

                  // Drag Handlers (Only for Standard Line)
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
                    
                    // Convert Y coordinate back to time
                    const graphY = y - padding.top;
                    const normalizedY = 1 - (graphY / graphHeight);
                    const newTime = minTime + normalizedY * timeRange;
                    
                    // Update state
                    setStandardLapTimesState(prev => {
                      const newTimes = [...prev];
                      // Clamp strictly to prevent crazy values
                      newTimes[draggingIndex] = Math.max(baselineSeconds * 0.8, Math.min(baselineSeconds * 1.5, newTime));
                      return newTimes;
                    });
                  };

                  const handleMouseUp = () => {
                    setDraggingIndex(null);
                  };

                  // Line Path Generators
                  const generatePath = (data) => {
                    return data.map((time, index) => {
                      const x = scaleX(index);
                      const y = scaleY(time);
                      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ');
                  };

                  // Metrics Calculation
                  const calcTotal = (times) => times.reduce((a, b) => a + b, 0);
                  const stdTotal = calcTotal(standardLapTimesState);
                  const fsTotal = calcTotal(fuelSavingLapTimesState);
                  const stdAvg = stdTotal / numLaps;
                  const fsAvg = fsTotal / numLaps;
                  
                  // ROI Calculations
                  const totalTimeLost = fsTotal - stdTotal;
                  
                  // Apply savings only to laps > 3 (where we actually drive slower)
                  // Assumption: You cannot effectively fuel save during the chaotic cold tire phase
                  const applicableLaps = Math.max(0, numLaps - 3);
                  const totalFuelSaved = applicableLaps * fuelSavingPerLap;
                  const costPerLiter = totalFuelSaved > 0 ? (totalTimeLost / totalFuelSaved) : 0;

                  return (
                    <div style={{ 
                      padding: 20, 
                      background: 'var(--surface-muted)', 
                      borderRadius: 16, 
                      border: '1px solid var(--border)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                    }}>
                      {/* --- CONTROLS SECTION --- */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                        gap: 24,
                        marginBottom: 24,
                        padding: 16,
                        background: 'var(--surface)',
                        borderRadius: 8,
                        border: '1px solid var(--border)'
                      }}>
                        {/* 1. Baseline */}
                        <div>
                          <label className="field-label">Baseline Lap Time (Hot)</label>
                          <input
                            type="text"
                            value={baselineInput}
                            onChange={(e) => {
                              setBaselineInput(e.target.value);
                              setStintModelling(prev => ({ ...prev, standardLapTime: e.target.value }));
                            }}
                            className="input-field"
                            style={{ width: '100%' }}
                            placeholder="MM:SS.sss"
                          />
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            Pace on Lap 4 with full tank.
                          </p>
                        </div>

                        {/* 2. Number of Laps */}
                        <div>
                          <label className="field-label">Total Laps</label>
                          <input
                            type="number"
                            value={numLaps}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setNumLaps(val);
                              setStintModelling(prev => ({ ...prev, standardLaps: val }));
                            }}
                            className="input-field"
                            style={{ width: '100%' }}
                          />
                        </div>

                         {/* 3. Fuel Burn Factor */}
                         <div>
                          <label className="field-label" title="Time gained per lap as the car gets lighter from fuel consumption">Fuel Burn Gain / Lap</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="range"
                              min="0"
                              max="0.2"
                              step="0.01"
                              value={fuelBurnFactor}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setFuelBurnFactor(val);
                                setStintModelling(prev => ({ ...prev, fuelBurnFactor: val }));
                              }}
                              style={{ flex: 1 }}
                            />
                            <span style={{ fontSize: '0.85rem', width: 40 }}>{fuelBurnFactor.toFixed(2)}s</span>
                          </div>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            Time gained per lap as fuel burns off.
                          </p>
                        </div>
                        
                        {/* 3b. Tire Degradation */}
                        <div>
                          <label className="field-label" title="Time lost per lap due to tire wear and degradation">Tire Deg / Lap</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="range"
                              min="0"
                              max="0.3"
                              step="0.01"
                              value={tireDegFactor}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setTireDegFactor(val);
                                setStintModelling(prev => ({ ...prev, tireDegFactor: val }));
                              }}
                              style={{ flex: 1 }}
                            />
                            <span style={{ fontSize: '0.85rem', width: 40 }}>+{tireDegFactor.toFixed(2)}s</span>
                          </div>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            Time lost per lap due to wear.
                          </p>
                        </div>

                        {/* 4. Fuel Save Offset */}
                        <div>
                          <label className="field-label" style={{ color: '#10b981' }} title="Additional time penalty per lap when driving in fuel-saving mode (applied from Lap 4 onwards)">Fuel Saving Delta</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                             <input
                              type="number"
                              step="0.05"
                              value={fuelSaveOffset}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setFuelSaveOffset(val);
                                setStintModelling(prev => ({ ...prev, fuelSaveOffset: val }));
                              }}
                              className="input-field"
                              style={{ width: '100%', borderColor: '#10b981' }}
                            />
                            <span style={{ fontSize: '0.85rem', color: '#10b981' }}>sec</span>
                          </div>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            Offset applied to green line (Laps 4+).
                          </p>
                        </div>

                        {/* 5. Fuel Consumption Inputs (New) */}
                        <div>
                          <label className="field-label" title="Fuel consumption parameters for ROI calculation. These are independent from the Setup tab.">Fuel Parameters</label>
                          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                            <div style={{ flex: 1 }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={baseFuelConsumption}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0.01;
                                  setBaseFuelConsumption(val);
                                  setStintModelling(prev => ({ ...prev, baseFuelConsumption: val }));
                                }}
                                className="input-field"
                                style={{ width: '100%' }}
                                placeholder="3.0"
                              />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Base Cons. (L/lap)</span>
                            </div>
                            <div style={{ flex: 1 }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={fuelSavingPerLap}
                                onChange={(e) => {
                                  const val = Math.max(0.01, parseFloat(e.target.value) || 0.01);
                                  setFuelSavingPerLap(val);
                                  setStintModelling(prev => ({ ...prev, fuelSavingPerLap: val }));
                                }}
                                className="input-field"
                                style={{ width: '100%', borderColor: '#10b981' }}
                                placeholder="0.15"
                              />
                              <span style={{ fontSize: '0.7rem', color: '#10b981' }}>Saving (L/lap)</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* --- GRAPH SECTION --- */}
                      <div 
                        style={{ position: 'relative', background: 'var(--surface)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      >
                        {/* Legend */}
                        <div style={{ position: 'absolute', top: 20, right: 30, display: 'flex', gap: 16, background: 'rgba(0,0,0,0.5)', padding: '8px 12px', borderRadius: 6, pointerEvents: 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                             <div style={{ width: 12, height: 3, background: '#0ea5e9' }}></div>
                             <span style={{ fontSize: '0.75rem', color: '#0ea5e9' }}>Standard ({formatLapTime(stdAvg)} avg)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                             <div style={{ width: 12, height: 3, background: '#10b981', borderStyle: 'dashed', borderWidth: '1px' }}></div>
                             <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Fuel Save ({formatLapTime(fsAvg)} avg)</span>
                          </div>
                        </div>

                        <svg width={width} height={height} style={{ display: 'block', cursor: draggingIndex !== null ? 'grabbing' : 'default' }} ref={svgRef}>
                           {/* Grid Lines Y */}
                           {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                             const y = padding.top + (graphHeight * ratio);
                             const timeVal = maxTime - (timeRange * ratio);
                             return (
                               <g key={ratio}>
                                 <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
                                 <text x={padding.left - 10} y={y + 3} fill="var(--text-muted)" fontSize="10" textAnchor="end">
                                   {formatLapTime(timeVal)}
                                 </text>
                               </g>
                             )
                           })}

                           {/* Standard Line (Blue) - Renders First (Bottom layer) */}
                           <path d={generatePath(standardLapTimesState)} fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                           
                           {/* Fuel Save Line (Green) */}
                           <path d={generatePath(fuelSavingLapTimesState)} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />

                           {/* Interactive Points (Only Standard is draggable) */}
                           {standardLapTimesState.map((time, index) => {
                             const x = scaleX(index);
                             const y = scaleY(time);
                             const isHover = hoverIndex === index;
                             const isDrag = draggingIndex === index;
                             
                             return (
                               <g key={index}
                                  onMouseDown={(e) => handleMouseDown(e, index)}
                                  onMouseEnter={() => setHoverIndex(index)}
                                  onMouseLeave={() => setHoverIndex(null)}
                                  style={{ cursor: 'grab' }}
                               >
                                 <circle cx={x} cy={y} r="15" fill="transparent" />
                                 <circle cx={x} cy={y} r={isHover || isDrag ? 6 : 4} fill="#0ea5e9" stroke="#fff" strokeWidth="2" />
                                 
                                 {(isHover || isDrag) && (
                                   <g pointerEvents="none">
                                     <rect x={x - 40} y={y - 45} width="80" height="36" rx="4" fill="rgba(15, 23, 42, 0.9)" stroke="#0ea5e9" />
                                     <text x={x} y={y - 28} textAnchor="middle" fill="#0ea5e9" fontSize="10" fontWeight="bold">Lap {index + 1}</text>
                                     <text x={x} y={y - 14} textAnchor="middle" fill="#fff" fontSize="10">{formatLapTime(time)}</text>
                                   </g>
                                 )}
                               </g>
                             );
                           })}
                        </svg>
                        
                        {/* X Axis Labels */}
                        <div style={{ marginLeft: padding.left, marginRight: padding.right, marginTop: -30, display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                           <span>Lap 1</span>
                           <span>Lap {Math.round(numLaps/2)}</span>
                           <span>Lap {numLaps}</span>
                        </div>
                      </div>

                      {/* --- SUMMARY STATS --- */}
                      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                        <div style={{ padding: 12, background: 'rgba(14, 165, 233, 0.05)', borderRadius: 8, borderLeft: '4px solid #0ea5e9' }}>
                           <div className="stat-label" style={{ fontSize: '0.85rem' }}>Standard Stint Time</div>
                           <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)' }}>{formatDuration(stdTotal)}</div>
                           <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                             Avg: {formatLapTime(stdAvg)}
                           </div>
                        </div>
                         <div style={{ padding: 12, background: 'rgba(16, 185, 129, 0.05)', borderRadius: 8, borderLeft: '4px solid #10b981' }}>
                           <div className="stat-label" style={{ fontSize: '0.85rem' }}>Fuel Saving Stint Time</div>
                           <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)' }}>{formatDuration(fsTotal)}</div>
                           <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                             Avg: {formatLapTime(fsAvg)} <span style={{ color: '#10b981' }}>({formatDuration(totalTimeLost)} slower)</span>
                           </div>
                        </div>
                      </div>

                      {/* --- ANALYSIS & ROI SECTION --- */}
                      <div style={{ marginTop: 24 }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>Strategy Analysis</span>
                          <div style={{ height: 1, flex: 1, background: 'var(--border)' }}></div>
                        </h4>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                          
                          {/* 1. Gap at Box (New) */}
                          <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                             <div className="stat-label" style={{ marginBottom: 12, fontSize: '0.85rem', color: '#ef4444' }}>Gap at Box Entry</div>
                             <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                               <span style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>
                                 -{totalTimeLost.toFixed(1)}
                               </span>
                               <span style={{ fontSize: '1rem', color: '#ef4444' }}>sec</span>
                             </div>
                             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.4 }}>
                               At the end of this {numLaps} lap stint, you will be <strong>{totalTimeLost.toFixed(1)} seconds</strong> behind a driver running standard pace.
                             </div>
                          </div>
                          
                          {/* 2. ROI Calculator */}
                          <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                             <div className="stat-label" style={{ marginBottom: 12, fontSize: '0.85rem' }}>Cost of Saving</div>
                             <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Time Lost:</span>
                                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#ef4444' }}>{totalTimeLost.toFixed(1)}s</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fuel Saved:</span>
                                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#10b981' }}>{totalFuelSaved > 0 ? totalFuelSaved.toFixed(2) : '0.00'} L</span>
                                </div>
                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Cost / Liter:</div>
                                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                                    {costPerLiter > 0 ? `${costPerLiter.toFixed(2)}s` : '0.00s'} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>per Liter</span>
                                  </div>
                                  {costPerLiter === 0 && totalFuelSaved === 0 && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                                      No fuel savings calculated
                                    </div>
                                  )}
                                </div>
                             </div>
                          </div>
                        </div>
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
