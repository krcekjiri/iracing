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
              <strong>"What If" Sandbox:</strong> Stint length is automatically calculated based on Tank Capacity and Fuel Burn. 
              Drag the green line or use sliders to plan your saving strategy.
            </p>
          </div>
          <div className="card">
            <SectionHeading
              title="Stint Modelling"
              helpText="Interactive sandbox to calculate the cost (pace) and reward (extra laps) of fuel saving."
            />
            {(() => {
              try {
                const StintGraph = () => {
                  // -- 1. STATE INITIALIZATION --
                  
                  // Defaults from global Setup
                  const globalTank = parseFloat(form.tankCapacity) || 100;
                  const globalBaseFuel = parseFloat(form.fuelPerLap) || 3.0;
                  const globalBasePace = form.averageLapTime || '02:00.000';
                  
                  // Inputs - use string state for text inputs to prevent focus loss
                  const [basePaceInput, setBasePaceInput] = useState(stintModelling.standardLapTime || globalBasePace);
                  const [baseFuelInput, setBaseFuelInput] = useState(
                    stintModelling.baseFuelConsumption !== undefined 
                    ? String(stintModelling.baseFuelConsumption)
                    : String(globalBaseFuel)
                  );
                  const [tankCapacityInput, setTankCapacityInput] = useState(
                    stintModelling.localTankCapacity !== undefined
                    ? String(stintModelling.localTankCapacity)
                    : String(globalTank)
                  );
                  
                  // Parse numeric values from string inputs
                  const baseFuel = parseFloat(baseFuelInput) || 0;
                  const tankCapacity = parseFloat(tankCapacityInput) || 0;
                  
                  // Sliders / Deltas
                  const [fuelSavingLiters, setFuelSavingLiters] = useState(
                    stintModelling.fuelSavingPerLap !== undefined 
                    ? parseFloat(stintModelling.fuelSavingPerLap) 
                    : 0.15
                  );
                  const [paceDelta, setPaceDelta] = useState(parseFloat(stintModelling.fuelSaveOffset) || 0.8);
                  
                  // Physics Factors
                  const [fuelBurnFactor, setFuelBurnFactor] = useState(parseFloat(stintModelling.fuelBurnFactor) || 0.05);
                  const [tireDegFactor, setTireDegFactor] = useState(parseFloat(stintModelling.tireDegFactor) || 0.05);
                  
                  // -- 2. CALCULATIONS --
                  
                  // Helper: Persist specific keys to storage
                  const updateStorage = (key, val) => {
                    setStintModelling(prev => ({ ...prev, [key]: val }));
                  };
                  
                  // Parse Pace
                  const basePaceSeconds = useMemo(() => parseLapTime(basePaceInput) || 120, [basePaceInput]);
                  
                  // Auto-Calculate Laps based on Tank
                  const stdLapsFloat = baseFuel > 0 ? tankCapacity / baseFuel : 0;
                  const stdLaps = Math.floor(stdLapsFloat);
                  
                  const saveFuel = Math.max(0.1, baseFuel - fuelSavingLiters);
                  const saveLapsFloat = saveFuel > 0 ? tankCapacity / saveFuel : 0;
                  const saveLaps = Math.floor(saveLapsFloat);
                  
                  // Calculate fractional laps gained
                  const lapsGained = saveLapsFloat - stdLapsFloat;
                  // Only count full laps when we've actually gained a full lap worth
                  const fullLapsGained = lapsGained >= 1.0 ? Math.floor(lapsGained) : 0;
                  
                  // Determine Graph X-Axis (Show whichever stint is longer, plus a buffer)
                  const graphLaps = Math.max(stdLaps, saveLaps) + 2;

                  // -- 3. PHYSICS CURVE GENERATOR --
                  
                  const generatePoints = (baseTime, isSaver) => {
                    const points = [];
                    // Limit loop to logical stint length for that strategy
                    const limit = isSaver ? saveLaps : stdLaps; 
                    
                    for (let lap = 1; lap <= graphLaps; lap++) {
                      // If car is out of fuel, stop generating points or flatline
                      if (lap > limit) break; 
                      let time = baseTime;
                      // Cold Tire Phase (Laps 1-3) - Fixed Penalties
                      if (lap === 1) time += 3.5;
                      else if (lap === 2) time += 1.5;
                      else if (lap === 3) time += 0.5;
                      else {
                        // Warm Phase (Lap 4+)
                        const lapsRunning = lap - 4; 
                        // Physics Slope: Burn (faster) vs Deg (slower)
                        time = time - (lapsRunning * fuelBurnFactor) + (lapsRunning * tireDegFactor);
                        
                        // Apply Strategy Offset
                        if (isSaver) {
                          time += paceDelta;
                        }
                      }
                      points.push(time);
                    }
                    return points;
                  };
                  
                  const stdPoints = useMemo(() => generatePoints(basePaceSeconds, false), [basePaceSeconds, stdLaps, fuelBurnFactor, tireDegFactor]);
                  const savePoints = useMemo(() => generatePoints(basePaceSeconds, true), [basePaceSeconds, saveLaps, fuelBurnFactor, tireDegFactor, paceDelta]);
                  
                  // -- 4. GRAPH INTERACTION --
                  const svgRef = useRef(null);
                  const [isDragging, setIsDragging] = useState(false);
                  
                  // Dimensions
                  const height = 300;
                  const width = 800; // viewbox width
                  const padding = { top: 20, bottom: 30, left: 50, right: 20 };
                  const innerH = height - padding.top - padding.bottom;
                  const innerW = width - padding.left - padding.right;
                  
                  // Scales
                  const allTimes = [...stdPoints, ...savePoints];
                  const rawMin = Math.min(...allTimes);
                  const rawMax = Math.max(...allTimes);
                  const rawRange = rawMax - rawMin;
                  
                  // Determine nice interval based on range (0.2s, 0.5s, or 1s)
                  const niceInterval = rawRange <= 3 ? 0.2 : rawRange <= 6 ? 0.5 : 1.0;
                  
                  // Round min down and max up to nice intervals
                  const minTime = Math.floor(rawMin / niceInterval) * niceInterval - niceInterval;
                  const maxTime = Math.ceil(rawMax / niceInterval) * niceInterval + niceInterval;
                  const timeRange = maxTime - minTime || 1;
                  
                  // Generate Y-axis tick values
                  const yTicks = [];
                  for (let t = minTime; t <= maxTime; t += niceInterval) {
                    yTicks.push(Math.round(t * 1000) / 1000); // Avoid floating point issues
                  }
                  
                  const scaleX = (lapIdx) => padding.left + (lapIdx / (graphLaps - 1)) * innerW;
                  const scaleY = (time) => padding.top + innerH - ((time - minTime) / timeRange) * innerH;
                  const invertScaleY = (y) => minTime + ((padding.top + innerH - y) / innerH) * timeRange;
                  
                  // Calculate average lap times (excluding cold laps 1-3)
                  const stdHotLaps = stdPoints.slice(3);
                  const saveHotLaps = savePoints.slice(3);
                  const stdAvgLapTime = stdHotLaps.length > 0 ? stdHotLaps.reduce((a, b) => a + b, 0) / stdHotLaps.length : 0;
                  const saveAvgLapTime = saveHotLaps.length > 0 ? saveHotLaps.reduce((a, b) => a + b, 0) / saveHotLaps.length : 0;
                  
                  const handleMouseDown = (e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  };
                  
                  const handleMouseMove = (e) => {
                    if (!isDragging) return;
                    const svg = svgRef.current;
                    if (!svg) return;
                    
                    const rect = svg.getBoundingClientRect();
                    // Calculate Y relative to SVG coordinate space
                    const scaleFactor = height / rect.height; // handle CSS resizing
                    const clickY = (e.clientY - rect.top) * scaleFactor;
                    
                    // Logic: Calculate what the time is at this Y
                    const clickX = (e.clientX - rect.left) * (width / rect.width);
                    const lapAtClick = Math.round(((clickX - padding.left) / innerW) * (graphLaps - 1));
                    const safeLapIdx = Math.max(3, Math.min(stdPoints.length - 1, lapAtClick)); // Clamp to valid range, ignore cold laps 0-2
                    
                    const stdTimeAtX = stdPoints[safeLapIdx];
                    const mouseTime = invertScaleY(clickY);
                    
                    let newDelta = mouseTime - stdTimeAtX;
                    // Clamp delta
                    newDelta = Math.max(0, Math.min(3.0, newDelta));
                    
                    setPaceDelta(newDelta);
                  };
                  
                  const handleMouseUp = () => {
                    if (isDragging) {
                      setIsDragging(false);
                      updateStorage('fuelSaveOffset', paceDelta);
                    }
                  };
                  
                  // Path Generators
                  const makePath = (points) => {
                    return points.map((t, i) => 
                      `${i===0?'M':'L'} ${scaleX(i)} ${scaleY(t)}`
                    ).join(' ');
                  };
                  
                  // ROI Math for Bottom Cards
                  const lapsForComparison = stdLaps; // Compare up to when standard car pits
                  const timeLostAtBox = (savePoints.slice(0, lapsForComparison).reduce((a,b)=>a+b,0) - stdPoints.slice(0, lapsForComparison).reduce((a,b)=>a+b,0));
                  
                  const fuelSavedTotal = (lapsForComparison - 3) * fuelSavingLiters;
                  const costPerLiter = fuelSavedTotal > 0 ? timeLostAtBox / fuelSavedTotal : 0;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      
                      {/* --- ROW 1: INPUTS --- */}
                      <div className="card" style={{ padding: 20, background: 'var(--surface-muted)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
                          
                          {/* Standard Lap Time */}
                          <div>
                            <label className="field-label">Standard Lap Time</label>
                            <input 
                              type="text" 
                              className="input-field" 
                              value={basePaceInput}
                              onChange={(e) => setBasePaceInput(e.target.value)}
                              onBlur={(e) => updateStorage('standardLapTime', e.target.value)}
                              style={{ width: '100%' }}
                            />
                          </div>
                          {/* Standard Fuel / Lap */}
                          <div>
                            <label className="field-label">Standard Fuel / Lap</label>
                            <input 
                              type="text"
                              inputMode="decimal"
                              className="input-field" 
                              value={baseFuelInput}
                              onChange={(e) => setBaseFuelInput(e.target.value)}
                              onBlur={(e) => {
                                const v = Math.max(0, parseFloat(e.target.value) || 0);
                                setBaseFuelInput(String(v));
                                updateStorage('baseFuelConsumption', v);
                              }}
                              style={{ width: '100%' }}
                            />
                          </div>
                          {/* Tank Capacity */}
                          <div>
                            <label className="field-label">Tank Capacity</label>
                            <input 
                              type="text"
                              inputMode="decimal"
                              className="input-field" 
                              value={tankCapacityInput}
                              onChange={(e) => setTankCapacityInput(e.target.value)}
                              onBlur={(e) => {
                                const v = Math.max(0, parseFloat(e.target.value) || 0);
                                setTankCapacityInput(String(v));
                                updateStorage('localTankCapacity', v);
                              }}
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* --- ROW 2: ALL 4 SLIDERS --- */}
                      <div className="card" style={{ padding: 20, background: 'var(--surface-muted)' }}>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(4, 1fr)', 
                          gap: 24,
                          padding: 16,
                          background: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: 8,
                          border: '1px solid var(--border)'
                        }}>
                          
                          {/* 1. Fuel Saving Slider */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <label className="field-label" style={{ color: '#10b981', margin: 0, fontSize: '0.75rem' }}>Fuel Saving</label>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#10b981' }}>{fuelSavingLiters.toFixed(2)} L</span>
                            </div>
                            <input 
                              type="range" 
                              min={0} 
                              max={baseFuel * 0.15 || 0.5}
                              step={0.001}
                              value={fuelSavingLiters}
                              onInput={(e) => setFuelSavingLiters(parseFloat(e.target.value))}
                              onChange={(e) => setFuelSavingLiters(parseFloat(e.target.value))}
                              onMouseUp={() => updateStorage('fuelSavingPerLap', fuelSavingLiters)}
                              onTouchEnd={() => updateStorage('fuelSavingPerLap', fuelSavingLiters)}
                              style={{ width: '100%', accentColor: '#10b981', cursor: 'grab' }}
                            />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              {baseFuel > 0 ? ((fuelSavingLiters/baseFuel)*100).toFixed(1) : 0}% reduction
                            </div>
                          </div>

                          {/* 2. Pace Delta Slider */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <label className="field-label" style={{ margin: 0, fontSize: '0.75rem' }}>Pace Delta</label>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>+{paceDelta.toFixed(2)} s</span>
                            </div>
                            <input 
                              type="range" 
                              min={0} 
                              max={2.5} 
                              step={0.001}
                              value={paceDelta}
                              onInput={(e) => setPaceDelta(parseFloat(e.target.value))}
                              onChange={(e) => setPaceDelta(parseFloat(e.target.value))}
                              onMouseUp={() => updateStorage('fuelSaveOffset', paceDelta)}
                              onTouchEnd={() => updateStorage('fuelSaveOffset', paceDelta)}
                              style={{ width: '100%', cursor: 'grab' }}
                            />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Time cost per lap
                            </div>
                          </div>

                          {/* 3. Fuel Burn Slider */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <label className="field-label" style={{ margin: 0, fontSize: '0.75rem' }}>Fuel Burn Effect</label>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>-{fuelBurnFactor.toFixed(2)} s</span>
                            </div>
                            <input 
                              type="range" 
                              min={0} 
                              max={0.1} 
                              step={0.001}
                              value={fuelBurnFactor}
                              onInput={(e) => setFuelBurnFactor(parseFloat(e.target.value))}
                              onChange={(e) => setFuelBurnFactor(parseFloat(e.target.value))}
                              onMouseUp={() => updateStorage('fuelBurnFactor', fuelBurnFactor)}
                              onTouchEnd={() => updateStorage('fuelBurnFactor', fuelBurnFactor)}
                              style={{ width: '100%', cursor: 'grab' }}
                            />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Faster as fuel burns
                            </div>
                          </div>

                          {/* 4. Tire Deg Slider */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <label className="field-label" style={{ margin: 0, fontSize: '0.75rem' }}>Tire Deg Effect</label>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>+{tireDegFactor.toFixed(2)} s</span>
                            </div>
                            <input 
                              type="range" 
                              min={0} 
                              max={0.2} 
                              step={0.001}
                              value={tireDegFactor}
                              onInput={(e) => setTireDegFactor(parseFloat(e.target.value))}
                              onChange={(e) => setTireDegFactor(parseFloat(e.target.value))}
                              onMouseUp={() => updateStorage('tireDegFactor', tireDegFactor)}
                              onTouchEnd={() => updateStorage('tireDegFactor', tireDegFactor)}
                              style={{ width: '100%', cursor: 'grab' }}
                            />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Slower as tires wear
                            </div>
                          </div>
                        </div>

                        {/* Extra Laps Result */}
                        <div style={{ 
                          marginTop: 20, 
                          paddingTop: 16, 
                          borderTop: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 12,
                            padding: '8px 16px',
                            background: lapsGained >= 1.0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                            borderRadius: 8,
                            border: lapsGained >= 1.0 ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border)'
                          }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Extra Laps:</span>
                            <span style={{ 
                              fontSize: '1.1rem', 
                              fontWeight: 700, 
                              color: lapsGained >= 1.0 ? '#10b981' : 'var(--text)' 
                            }}>
                              +{lapsGained.toFixed(2)}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Stint: <span style={{ color: '#0ea5e9' }}>{stdLaps}</span> → <span style={{ color: '#10b981', fontWeight: 600 }}>{saveLaps}</span> laps
                            {fullLapsGained >= 1 && (
                              <span style={{ marginLeft: 8, color: '#10b981' }}>
                                (+{fullLapsGained} full {fullLapsGained === 1 ? 'lap' : 'laps'})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* --- ROW 3: GRAPH + AVERAGES --- */}
                      <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
                        {/* Graph SVG */}
                        <div 
                          style={{ position: 'relative', height: height, flex: 1, background: 'var(--surface-muted)', cursor: isDragging ? 'grabbing' : 'default' }}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                          ref={svgRef}
                        >
                           <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
                              
                              {/* Grid Lines - using nice intervals */}
                              {yTicks.map((tickVal, idx) => {
                                const y = scaleY(tickVal);
                                // Skip if outside visible area
                                if (y < padding.top - 5 || y > height - padding.bottom + 5) return null;
                                return (
                                  <line 
                                    key={idx} 
                                    x1={padding.left} 
                                    y1={y} 
                                    x2={width - padding.right} 
                                    y2={y} 
                                    stroke="var(--border)" 
                                    strokeDasharray="4 4" 
                                    opacity={0.5}
                                  />
                                );
                              })}
                              
                              {/* Y-Axis Labels - using nice intervals */}
                              {yTicks.map((tickVal, idx) => {
                                const y = scaleY(tickVal);
                                // Skip if outside visible area or too close to edges
                                if (y < padding.top + 5 || y > height - padding.bottom - 5) return null;
                                return (
                                  <text 
                                    key={idx} 
                                    x={padding.left - 8} 
                                    y={y + 3} 
                                    fill="var(--text-muted)" 
                                    fontSize="9" 
                                    textAnchor="end"
                                  >
                                    {formatLapTime(tickVal)}
                                  </text>
                                );
                              })}
                              {/* Labels X */}
                              <text x={scaleX(0)} y={height - 5} fill="var(--text-muted)" fontSize="10" textAnchor="middle">Start</text>
                              <text x={scaleX(stdLaps)} y={height - 5} fill="#0ea5e9" fontSize="10" textAnchor="middle" fontWeight="bold">L{stdLaps}</text>
                              {saveLaps > stdLaps && (
                                <text x={scaleX(saveLaps)} y={height - 5} fill="#10b981" fontSize="10" textAnchor="middle" fontWeight="bold">L{saveLaps}</text>
                              )}
                              {/* LINES */}
                              {/* Blue (Standard) */}
                              <path d={makePath(stdPoints)} fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                              <circle cx={scaleX(stdPoints.length-1)} cy={scaleY(stdPoints[stdPoints.length-1])} r="4" fill="#0ea5e9" />
                              {/* Green (Saver) - Draggable */}
                              <g 
                                onMouseDown={handleMouseDown} 
                                style={{ cursor: 'grab' }}
                              >
                                {/* Transparent Hit Area for easier grabbing */}
                                <path d={makePath(savePoints)} fill="none" stroke="transparent" strokeWidth="20" />
                                
                                {/* Visible Line */}
                                <path d={makePath(savePoints)} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                
                                {/* End Dot */}
                                <circle cx={scaleX(savePoints.length-1)} cy={scaleY(savePoints[savePoints.length-1])} r="5" fill="#10b981" stroke="#fff" strokeWidth="2" />
                              </g>
                          </svg>
                          {/* Subtle drag hint */}
                          <div style={{ 
                            position: 'absolute', 
                            top: 8, 
                            right: 12, 
                            pointerEvents: 'none', 
                            fontSize: '0.65rem',
                            color: 'var(--text-muted)',
                            opacity: 0.5
                          }}>
                             ↕ Drag green line to adjust pace
                          </div>
                        </div>
                        
                        {/* Average Lap Time Panel - Right Side */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: 16,
                          padding: '16px 20px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderLeft: '1px solid var(--border)',
                          minWidth: 160
                        }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Avg Lap Time
                          </div>
                          
                          {/* Standard */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 10, height: 3, background: '#0ea5e9', borderRadius: 2 }} />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Standard</span>
                            </div>
                            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0ea5e9', marginLeft: 16 }}>
                              {formatLapTime(stdAvgLapTime)}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 16 }}>
                              {stdHotLaps.length} hot laps
                            </span>
                          </div>
                          
                          {/* Fuel Save */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 10, height: 3, background: '#10b981', borderRadius: 2 }} />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fuel Save</span>
                            </div>
                            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#10b981', marginLeft: 16 }}>
                              {formatLapTime(saveAvgLapTime)}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 16 }}>
                              {saveHotLaps.length} hot laps
                            </span>
                          </div>
                          
                          {/* Delta */}
                          <div style={{ 
                            paddingTop: 12, 
                            borderTop: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2
                          }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Difference</span>
                            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#ef4444' }}>
                              +{(saveAvgLapTime - stdAvgLapTime).toFixed(3)}s
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* --- ROW 4: ANALYSIS --- */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                        
                        {/* Card A: Gap at Box */}
                        <div className="card" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                           <div className="stat-label" style={{ color: '#ef4444', marginBottom: 8 }}>Gap at Box Entry (Lap {lapsForComparison})</div>
                           <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                             <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>-{timeLostAtBox.toFixed(1)}</span>
                             <span style={{ fontSize: '1rem', color: '#ef4444' }}>sec</span>
                           </div>
                           <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
                             Time lost over {lapsForComparison} laps compared to standard pace.
                           </p>
                        </div>

                        {/* Card B: Strategy ROI - Expanded */}
                        <div className="card">
                           <div className="stat-label" style={{ marginBottom: 12 }}>Strategy ROI</div>
                           
                           {/* Time Lost */}
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                              <span style={{ fontSize: '0.85rem', color: '#ef4444' }}>Time Lost:</span>
                              <span style={{ fontWeight: 600, color: '#ef4444' }}>-{timeLostAtBox.toFixed(1)} s</span>
                           </div>
                           
                           {/* Fuel Saved */}
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                              <span style={{ fontSize: '0.85rem', color: '#10b981' }}>Fuel Saved:</span>
                              <span style={{ fontWeight: 600, color: '#10b981' }}>+{fuelSavedTotal.toFixed(2)} L</span>
                           </div>
                           
                           {/* Division Line Visual */}
                           <div style={{ 
                             display: 'flex', 
                             justifyContent: 'space-between', 
                             alignItems: 'center',
                             padding: '12px', 
                             marginTop: 4,
                             background: 'rgba(56, 189, 248, 0.08)',
                             borderRadius: 6
                           }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cost per Liter:</span>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                <span style={{ fontWeight: 700, fontSize: '1.2rem', color: '#fff' }}>{costPerLiter.toFixed(2)}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>s / L</span>
                              </div>
                           </div>
                           
                           {/* Formula hint */}
                           <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                             {timeLostAtBox.toFixed(1)}s ÷ {fuelSavedTotal.toFixed(2)}L = {costPerLiter.toFixed(2)}s/L
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
