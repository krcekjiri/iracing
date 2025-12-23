const PlannerApp = () => {
  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerApp.jsx:1',message:'PlannerApp component rendering',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    console.log('[DEBUG] PlannerApp rendering');
  } catch(e) { console.error('[DEBUG] Log error:', e); }
  // #endregion
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
  
  // Always start with safe defaults on initial load to prevent expensive calculations
  const getSafeDefaults = () => {
    const stored = loadFromStorage('form', defaultForm);
    // Validate and sanitize stored values to prevent expensive calculations
    const safeForm = {
      ...defaultForm,
      ...stored,
      // Ensure race duration is reasonable (max 24h = 1440 minutes)
      raceDurationMinutes: Math.min(Math.max(Number(stored.raceDurationMinutes) || defaultForm.raceDurationMinutes, 60), 1440),
      // Ensure tank capacity is reasonable
      tankCapacity: Math.min(Math.max(Number(stored.tankCapacity) || defaultForm.tankCapacity, 10), 200),
      // Ensure fuel per lap is reasonable
      fuelPerLap: Math.min(Math.max(Number(stored.fuelPerLap) || defaultForm.fuelPerLap, 0.1), 10),
      fuelSavingFuelPerLap: Math.min(Math.max(Number(stored.fuelSavingFuelPerLap) || defaultForm.fuelSavingFuelPerLap, 0.1), 10),
      extraFuelSavingFuelPerLap: Math.min(Math.max(Number(stored.extraFuelSavingFuelPerLap) || defaultForm.extraFuelSavingFuelPerLap, 0.1), 10),
      // Ensure other numeric fields are valid
      fuelBoP: Math.min(Math.max(Number(stored.fuelBoP) || defaultForm.fuelBoP, 0), 10),
      fuelReserveLiters: Math.min(Math.max(Number(stored.fuelReserveLiters) || defaultForm.fuelReserveLiters, 0), 5),
      formationLapFuel: Math.min(Math.max(Number(stored.formationLapFuel) || defaultForm.formationLapFuel, 0), 5),
      pitLaneDeltaSeconds: Math.min(Math.max(Number(stored.pitLaneDeltaSeconds) || defaultForm.pitLaneDeltaSeconds, 10), 60),
    };
    return safeForm;
  };

  const [form, setForm] = useState(() => getSafeDefaults());
  // Start confirmedForm with safe defaults, not from localStorage, to prevent expensive initial calculations
  const [confirmedForm, setConfirmedForm] = useState(() => defaultForm);
  const [showStrategyCalculated, setShowStrategyCalculated] = useState(false);
  const [isCalculatingStrategy, setIsCalculatingStrategy] = useState(false);
  const [validation, setValidation] = useState({ errors: [], warnings: [] });

  // Validation function - returns { errors: [], warnings: [] }
  // Memoized with useCallback to prevent recreation on every render
  const validateForm = useCallback((form) => {
    const errors = []; // Hard stops - block calculation
    const warnings = []; // Soft warnings - allow but warn
    
    const tankCapacity = Number(form.tankCapacity) || 0;
    const fuelBoP = Number(form.fuelBoP) || 0;
    const effectiveTank = tankCapacity * (1 - fuelBoP / 100);
    const fuelReserve = Number(form.fuelReserveLiters) || 0;
    const fuelPerLap = Number(form.fuelPerLap) || 0;
    const fuelSavingFuelPerLap = Number(form.fuelSavingFuelPerLap) || 0;
    const extraFuelSavingFuelPerLap = Number(form.extraFuelSavingFuelPerLap) || 0;
    const pitLaneDelta = Number(form.pitLaneDeltaSeconds) || 0;
    const formationLapFuel = Number(form.formationLapFuel) || 0;
    const raceDuration = Number(form.raceDurationMinutes) || 0;
    
    // === HARD STOPS (errors) ===
    
    // Tank capacity
    if (tankCapacity <= 0) {
      errors.push({ field: 'tankCapacity', message: 'Tank capacity must be greater than 0' });
    }
    
    // Fuel BoP
    if (fuelBoP >= 100) {
      errors.push({ field: 'fuelBoP', message: 'Fuel BoP cannot be 100% or more (no usable tank)' });
    }
    if (fuelBoP < 0) {
      errors.push({ field: 'fuelBoP', message: 'Fuel BoP cannot be negative' });
    }
    
    // Fuel reserve vs effective tank
    if (fuelReserve >= effectiveTank && effectiveTank > 0) {
      errors.push({ field: 'fuelReserveLiters', message: `Reserve (${fuelReserve}L) must be less than effective tank (${effectiveTank.toFixed(1)}L)` });
    }
    
    // Fuel per lap validations
    if (fuelPerLap <= 0) {
      errors.push({ field: 'fuelPerLap', message: 'Standard fuel/lap must be greater than 0' });
    }
    if (fuelPerLap >= effectiveTank && effectiveTank > 0) {
      errors.push({ field: 'fuelPerLap', message: `Fuel/lap (${fuelPerLap}L) exceeds effective tank (${effectiveTank.toFixed(1)}L)` });
    }
    
    // Lap time validation - must be mm:ss.000 or m:ss.000 format
    const lapTimeStr = String(form.averageLapTime || '').trim();
    const lapTimePattern = /^(\d{1,2}):(\d{2})\.(\d{3})$/;
    let lapTimeSeconds = 0;
    
    if (!lapTimeStr || !lapTimePattern.test(lapTimeStr)) {
      errors.push({ field: 'averageLapTime', message: 'Invalid lap time format (use mm:ss.000 or m:ss.000)' });
    } else {
      lapTimeSeconds = parseLapTime(form.averageLapTime);
      if (!lapTimeSeconds || lapTimeSeconds <= 0) {
        errors.push({ field: 'averageLapTime', message: 'Invalid lap time format (use mm:ss.000 or m:ss.000)' });
      }
      // Warning if lap time > 15 minutes (900 seconds)
      if (lapTimeSeconds > 900) {
        warnings.push({ field: 'averageLapTime', message: `Lap time (${(lapTimeSeconds / 60).toFixed(1)}min) is unusually long - verify measurement` });
      }
    }
    
    // Race duration
    if (raceDuration <= 0) {
      errors.push({ field: 'raceDurationMinutes', message: 'Race duration must be greater than 0' });
    }
    // Warning if race duration > 1440 minutes (24 hours)
    if (raceDuration > 1440) {
      warnings.push({ field: 'raceDurationMinutes', message: `Race duration (${(raceDuration / 60).toFixed(1)}h) exceeds 24 hours - verify schedule` });
    }
    
    // Pit lane delta
    if (pitLaneDelta < 0) {
      errors.push({ field: 'pitLaneDeltaSeconds', message: 'Pit lane delta cannot be negative' });
    }
    
    // === SOFT WARNINGS ===
    
    // Tank capacity warning
    if (tankCapacity > 120) {
      warnings.push({ field: 'tankCapacity', message: `Tank capacity (${tankCapacity}L) is unusually large - verify series rules` });
    }
    
    // Fuel BoP warnings
    if (fuelBoP > 5 && fuelBoP < 100) {
      warnings.push({ field: 'fuelBoP', message: `${fuelBoP}% BoP is unusually high - verify series rules` });
    }
    
    // Fuel reserve warnings - check if reserve is high relative to effective tank
    if (fuelReserve > 2 && effectiveTank > 0 && fuelReserve < effectiveTank) {
      warnings.push({ field: 'fuelReserveLiters', message: `${fuelReserve}L reserve is quite high` });
    }
    
    // Formation lap fuel warnings
    if (formationLapFuel > 4) {
      warnings.push({ field: 'formationLapFuel', message: `${formationLapFuel}L seems high for formation lap` });
    }
    
    // Pit lane delta warnings
    if (pitLaneDelta > 0 && pitLaneDelta < 15) {
      warnings.push({ field: 'pitLaneDeltaSeconds', message: `${pitLaneDelta}s is very short - verify measurement` });
    }
    if (pitLaneDelta > 60) {
      warnings.push({ field: 'pitLaneDeltaSeconds', message: `${pitLaneDelta}s is unusually long - verify measurement` });
    }
    
    // Fuel consumption warnings
    if (fuelPerLap > 6) {
      warnings.push({ field: 'fuelPerLap', message: `${fuelPerLap}L/lap is very high consumption` });
    }
    
    // Fuel saving mode consistency
    if (fuelSavingFuelPerLap > 0 && fuelSavingFuelPerLap >= fuelPerLap) {
      warnings.push({ field: 'fuelSavingFuelPerLap', message: 'Fuel-saving should use less fuel than standard' });
    }
    if (extraFuelSavingFuelPerLap > 0 && fuelSavingFuelPerLap > 0 && extraFuelSavingFuelPerLap >= fuelSavingFuelPerLap) {
      warnings.push({ field: 'extraFuelSavingFuelPerLap', message: 'Extra fuel-saving should use less fuel than fuel-saving' });
    }
    
    // Lap time warnings for fuel saving modes
    const fuelSavingLapTime = parseLapTime(form.fuelSavingLapTime);
    const extraFuelSavingLapTime = parseLapTime(form.extraFuelSavingLapTime);
    if (fuelSavingLapTime > 0 && lapTimeSeconds > 0 && fuelSavingLapTime <= lapTimeSeconds) {
      warnings.push({ field: 'fuelSavingLapTime', message: 'Fuel-saving lap time should be slower than standard' });
    }
    if (extraFuelSavingLapTime > 0 && fuelSavingLapTime > 0 && extraFuelSavingLapTime <= fuelSavingLapTime) {
      warnings.push({ field: 'extraFuelSavingLapTime', message: 'Extra fuel-saving should be slower than fuel-saving' });
    }
    
    // Stint length sanity check
    if (fuelPerLap > 0 && effectiveTank > 0 && fuelReserve >= 0) {
      const lapsPerStint = Math.floor((effectiveTank - fuelReserve) / fuelPerLap);
      if (lapsPerStint < 3) {
        warnings.push({ field: 'fuelPerLap', message: `Only ${lapsPerStint} laps per stint - check fuel consumption` });
      }
    }
    
    return { errors, warnings };
  }, []); // Empty deps - function doesn't depend on component state

  // Helper to get field-specific validation state
  const getFieldValidation = useCallback((validation, fieldName) => {
    const error = validation.errors.find(e => e.field === fieldName);
    const warning = validation.warnings.find(w => w.field === fieldName);
    return { error, warning };
  }, []); // Empty deps - pure function

  // Race duration presets
  const racePresets = [
    { label: '2h', value: 120 },
    { label: '3h', value: 180 },
    { label: '4h', value: 240 },
    { label: '6h', value: 360 },
    { label: '8h', value: 480 },
    { label: '12h', value: 720 },
    { label: '24h', value: 1440 },
  ];

  // Format duration helper
  const formatDuration = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };
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
  
  // Save to localStorage whenever state changes (debounced to prevent performance issues)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveToStorage('form', form);
    }, 300); // Debounce by 300ms
    
    return () => clearTimeout(timeoutId);
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

  // Real-time validation (debounced to avoid excessive re-validation)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const validationResult = validateForm(form);
      setValidation(validationResult);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [form, validateForm]);
  const [activeTab, setActiveTab] = useState('setup');
  const [selectedStrategy, setSelectedStrategy] = useState('standard');
  const [pitSandbox, setPitSandbox] = useState(() => {
    const initialForm = loadFromStorage('form', defaultForm);
    return {
      pitWallSide: 'right',
      tires: { LF: true, RF: true, LR: true, RR: true },
      fuelBefore: '1',
      fuelToAdd: String(initialForm.tankCapacity || 106),
      pitLaneDelta: String(initialForm.pitLaneDeltaSeconds || 27),
      driverSwap: true,
    };
  });

  const standardResult = useMemo(() => {
    // Guard: Skip expensive calculation if form data is invalid or extreme
    const raceDuration = Number(confirmedForm.raceDurationMinutes) || 0;
    const tankCapacity = Number(confirmedForm.tankCapacity) || 0;
    const fuelPerLap = Number(confirmedForm.fuelPerLap) || 0;
    
    // Prevent calculations with invalid or extreme values that would freeze the browser
    if (raceDuration <= 0 || raceDuration > 1440 || tankCapacity <= 0 || fuelPerLap <= 0) {
      return { errors: ['Invalid form data'], stintPlan: [], totalLaps: 0 };
    }
    
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerApp.jsx:103',message:'standardResult useMemo entry',data:{tankCapacity:confirmedForm.tankCapacity,tankCapacityType:typeof confirmedForm.tankCapacity,tankCapacityNum:Number(confirmedForm.tankCapacity)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      console.log('[DEBUG] standardResult useMemo entry', {tankCapacity: confirmedForm.tankCapacity, tankCapacityType: typeof confirmedForm.tankCapacity, tankCapacityNum: Number(confirmedForm.tankCapacity)});
    } catch(e) { console.error('[DEBUG] Log error:', e); }
    // #endregion
    try {
      const result = computePlan(confirmedForm, 'standard');
      // #region agent log
      try {
        fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerApp.jsx:107',message:'standardResult useMemo success',data:{hasErrors:!!result.errors,errorCount:result.errors?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        console.log('[DEBUG] standardResult useMemo success', {hasErrors: !!result.errors, errorCount: result.errors?.length || 0});
      } catch(e) { console.error('[DEBUG] Log error:', e); }
      // #endregion
      return result;
    } catch (error) {
      // #region agent log
      try {
        fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerApp.jsx:112',message:'standardResult useMemo ERROR',data:{errorMessage:error.message,errorStack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        console.error('[DEBUG] standardResult useMemo ERROR', error);
      } catch(e) { console.error('[DEBUG] Log error:', e); }
      // #endregion
      throw error;
    }
  }, [confirmedForm]);
  const fuelSavingResult = useMemo(() => {
    // Guard: Skip expensive calculation if form data is invalid or extreme
    const raceDuration = Number(confirmedForm.raceDurationMinutes) || 0;
    const tankCapacity = Number(confirmedForm.tankCapacity) || 0;
    const fuelPerLap = Number(confirmedForm.fuelSavingFuelPerLap) || Number(confirmedForm.fuelPerLap) || 0;
    
    // Prevent calculations with invalid or extreme values that would freeze the browser
    if (raceDuration <= 0 || raceDuration > 1440 || tankCapacity <= 0 || fuelPerLap <= 0) {
      return { errors: ['Invalid form data'], stintPlan: [], totalLaps: 0 };
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerApp.jsx:116',message:'fuelSavingResult useMemo entry',data:{tankCapacity:confirmedForm.tankCapacity},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    try {
      const result = computePlan(confirmedForm, 'fuel-saving');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerApp.jsx:120',message:'fuelSavingResult useMemo success',data:{hasErrors:!!result.errors},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return result;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerApp.jsx:125',message:'fuelSavingResult useMemo ERROR',data:{errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      throw error;
    }
  }, [confirmedForm]);
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
  const reservePerStint = Number(confirmedForm.fuelReserveLiters) || 0;
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

  // Handle input with proper type conversion for number fields
  const handleInput = (field) => (eventOrValue) => {
    let value;
    let fieldType = 'text';
    
    if (typeof eventOrValue === 'number') {
      value = eventOrValue;
      fieldType = 'number';
    } else {
      value = eventOrValue.target.value;
      fieldType = eventOrValue.target.type || 'text';
    }
    
    // For number fields, try to parse immediately but allow empty strings
    if (fieldType === 'number') {
      // Allow empty string for typing, but convert valid numbers
      if (value === '' || value === null || value === undefined) {
        setForm((prev) => ({
          ...prev,
          [field]: '',
        }));
      } else {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          setForm((prev) => ({
            ...prev,
            [field]: numValue,
          }));
        } else {
          // Invalid number - keep as string for now, will be cleaned on blur
          setForm((prev) => ({
            ...prev,
            [field]: value,
          }));
        }
      }
    } else {
      // For text fields (like lap time), store as-is
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  // Add onBlur handler for number fields to clean up values
  const handleInputBlur = (field, defaultValue = 0) => () => {
    setForm((prev) => {
      const currentValue = prev[field];
      // If empty or invalid, set to default
      if (currentValue === '' || currentValue === null || currentValue === undefined) {
        return { ...prev, [field]: defaultValue };
      }
      // If it's a string that can be parsed, parse it
      if (typeof currentValue === 'string') {
        const parsed = parseFloat(currentValue);
        if (isNaN(parsed)) {
          return { ...prev, [field]: defaultValue };
        }
        return { ...prev, [field]: parsed };
      }
      return prev;
    });
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

  // SliderInput Component - Compact version with tooltip
  const SliderInput = ({ 
    label, 
    value, 
    onChange, 
    min, 
    max, 
    step, 
    suffix = '', 
    helpText,
    formatValue = (v) => v 
  }) => {
    const numValue = parseFloat(value) || min;
    const clampedValue = Math.max(min, Math.min(max, numValue));
    
    const handleSliderChange = (e) => {
      const newValue = parseFloat(e.target.value);
      if (!isNaN(newValue)) {
        onChange(newValue);
      }
    };
    
    const handleInputChange = (e) => {
      const inputValue = e.target.value;
      if (inputValue === '') {
        return; // Allow empty for typing
      }
      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue)) {
        const clamped = Math.max(min, Math.min(max, numValue));
        onChange(clamped);
      }
    };
    
    const handleInputBlur = (e) => {
      const numValue = parseFloat(e.target.value) || min;
      const clamped = Math.max(min, Math.min(max, numValue));
      onChange(clamped);
    };

    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <label className="field-label" style={{ margin: 0, fontSize: 'var(--font-sm)' }}>
            {label}
          </label>
          {helpText && (
            <span className="help-badge" tabIndex={0}>
              <span className="help-icon">?</span>
              <span className="help-tooltip">{typeof helpText === 'function' ? helpText(clampedValue) : helpText}</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input 
            type="range" 
            min={min} 
            max={max} 
            step={step}
            value={clampedValue}
            onInput={handleSliderChange}
            onChange={handleSliderChange}
            onMouseUp={(e) => {
              e.currentTarget.style.cursor = 'grab';
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.cursor = 'grab';
            }}
            style={{ 
              flex: 1, 
              cursor: 'grab', 
              WebkitAppearance: 'none', 
              appearance: 'none',
              height: '6px',
              background: 'var(--surface-muted)',
              borderRadius: '3px',
              outline: 'none',
              border: 'none'
            }}
          />
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={clampedValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            style={{ 
              width: '80px', 
              padding: '4px 6px',
              fontSize: 'var(--font-sm)',
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)'
            }}
          />
          {suffix && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', minWidth: '20px' }}>{suffix}</span>}
        </div>
      </div>
    );
  };

  // Handle confirmation - copy draft form to confirmed form
  const handleConfirmForm = () => {
    // Validate form first
    const validationResult = validateForm(form);
    setValidation(validationResult);
    
    // Block calculation if there are errors
    if (validationResult.errors.length > 0) {
      setIsCalculatingStrategy(false);
      return; // Don't proceed with calculation
    }
    
    setIsCalculatingStrategy(true);
    
    // Sanitize form values before calculation to prevent expensive operations
    const sanitizedForm = {
      ...form,
      // Ensure race duration is reasonable (max 24h = 1440 minutes)
      raceDurationMinutes: Math.min(Math.max(Number(form.raceDurationMinutes) || defaultForm.raceDurationMinutes, 60), 1440),
      // Ensure tank capacity is reasonable
      tankCapacity: Math.min(Math.max(Number(form.tankCapacity) || defaultForm.tankCapacity, 10), 200),
      // Ensure fuel per lap is reasonable
      fuelPerLap: Math.min(Math.max(Number(form.fuelPerLap) || defaultForm.fuelPerLap, 0.1), 10),
      fuelSavingFuelPerLap: Math.min(Math.max(Number(form.fuelSavingFuelPerLap) || defaultForm.fuelSavingFuelPerLap, 0.1), 10),
      extraFuelSavingFuelPerLap: Math.min(Math.max(Number(form.extraFuelSavingFuelPerLap) || defaultForm.extraFuelSavingFuelPerLap, 0.1), 10),
      // Ensure other numeric fields are valid
      fuelBoP: Math.min(Math.max(Number(form.fuelBoP) || defaultForm.fuelBoP, 0), 10),
      fuelReserveLiters: Math.min(Math.max(Number(form.fuelReserveLiters) || defaultForm.fuelReserveLiters, 0), 5),
      formationLapFuel: Math.min(Math.max(Number(form.formationLapFuel) || defaultForm.formationLapFuel, 0), 5),
      pitLaneDeltaSeconds: Math.min(Math.max(Number(form.pitLaneDeltaSeconds) || defaultForm.pitLaneDeltaSeconds, 10), 60),
    };
    
    // Use requestAnimationFrame to allow UI to update before heavy calculation
    requestAnimationFrame(() => {
      // Small delay to ensure loading state is visible
      setTimeout(() => {
        // Update confirmed form which triggers useMemo calculations (with sanitized values)
        setConfirmedForm(sanitizedForm);
        saveToStorage('form', sanitizedForm);
        // Use another setTimeout to allow calculations to complete
        setTimeout(() => {
          setIsCalculatingStrategy(false);
          setShowStrategyCalculated(true);
          // Show confirmation and switch to Strategy tab
          setTimeout(() => {
            setActiveTab('strategy');
            setTimeout(() => {
              setShowStrategyCalculated(false);
            }, 3000);
          }, 100);
        }, 100);
      }, 50);
    });
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
        {/* Schedule tab hidden in initial version */}
        {/* <button
          className={activeTab === 'schedule' ? 'active' : ''}
          onClick={() => setActiveTab('schedule')}
        >
          Schedule <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: '4px' }}>(WIP)</span>
        </button> */}
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
          {/* Description */}
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: 8, border: '1px solid rgba(251, 191, 36, 0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6M1 12h6m6 0h6" />
              <path d="M19.07 4.93l-4.24 4.24M4.93 19.07l4.24-4.24M19.07 19.07l-4.24-4.24M4.93 4.93l4.24 4.24" />
            </svg>
            <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-muted)', flex: 1 }}>
              Configure race parameters and strategy modes. Click <strong style={{ color: 'var(--accent)' }}>Calculate Strategy</strong> to generate your race plan.
            </p>
          </div>
          
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
            {/* Validation Messages */}
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <div style={{ 
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                background: validation.errors.length > 0 
                  ? 'rgba(255, 107, 129, 0.1)' 
                  : 'rgba(251, 191, 36, 0.1)',
                border: `1px solid ${validation.errors.length > 0 
                  ? 'rgba(255, 107, 129, 0.3)' 
                  : 'rgba(251, 191, 36, 0.3)'}`,
              }}>
                {validation.errors.length > 0 && (
                  <div style={{ marginBottom: validation.warnings.length > 0 ? 12 : 0 }}>
                    <div style={{ 
                      fontSize: 'var(--font-sm)', 
                      fontWeight: 600, 
                      color: '#ff6b81',
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      Errors ({validation.errors.length})
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#ff6b81', fontSize: 'var(--font-sm)' }}>
                      {validation.errors.map((error, idx) => (
                        <li key={idx}>{error.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div>
                    <div style={{ 
                      fontSize: 'var(--font-sm)', 
                      fontWeight: 600, 
                      color: '#fbbf24',
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      Warnings ({validation.warnings.length})
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#fbbf24', fontSize: 'var(--font-sm)' }}>
                      {validation.warnings.map((warning, idx) => (
                        <li key={idx}>{warning.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="inputs-grid">
            {/* Race & Fuel Parameters */}
            <div className="card">
              <h3 className="section-title">Race & Fuel Parameters</h3>

              {/* Race Duration with Presets */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <label className="field-label" style={{ margin: 0, fontSize: '0.85rem' }}>Race Duration</label>
                  <span className="help-badge" tabIndex={0}>
                    <span className="help-icon">?</span>
                    <span className="help-tooltip">Scheduled race length. Click a preset or enter custom minutes.</span>
                  </span>
                </div>
                
                {/* Input + Presets inline */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="number"
                    value={form.raceDurationMinutes}
                    onChange={handleInput('raceDurationMinutes')}
                    onBlur={handleInputBlur('raceDurationMinutes', 60)}
                    min={10}
                    step={10}
                    className="input-field"
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>min</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {racePresets.map(preset => (
                      <button
                        key={preset.value}
                        onClick={() => setForm(prev => ({ ...prev, raceDurationMinutes: preset.value }))}
                        className={`preset-btn ${form.raceDurationMinutes === preset.value ? 'active' : ''}`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2-column Grid for all params */}
              <div className="param-grid">
                <div>
                  <InputField
                    label="Tank Capacity"
                    type="number"
                    suffix="L"
                    value={form.tankCapacity}
                    onChange={handleInput('tankCapacity')}
                    onBlur={handleInputBlur('tankCapacity', 100)}
                    min={10}
                    max={200}
                    step={1}
                    helpText="Base fuel tank capacity before BoP adjustments."
                  />
                  {getFieldValidation(validation, 'tankCapacity').error && (
                    <div style={{ 
                      fontSize: 'var(--font-xs)', 
                      color: '#ff6b81', 
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {getFieldValidation(validation, 'tankCapacity').error.message}
                    </div>
                  )}
                  {getFieldValidation(validation, 'tankCapacity').warning && (
                    <div style={{ 
                      fontSize: 'var(--font-xs)', 
                      color: '#fbbf24', 
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      {getFieldValidation(validation, 'tankCapacity').warning.message}
                    </div>
                  )}
                </div>
                <div>
                  <InputField
                    label="Fuel BoP"
                    type="number"
                    suffix="%"
                    value={form.fuelBoP}
                    onChange={handleInput('fuelBoP')}
                    onBlur={handleInputBlur('fuelBoP', 0)}
                    min={0}
                    max={10}
                    step={0.25}
                    helpText="Balance of Performance reduction to tank capacity."
                  />
                  {getFieldValidation(validation, 'fuelBoP').error && (
                    <div style={{ 
                      fontSize: 'var(--font-xs)', 
                      color: '#ff6b81', 
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {getFieldValidation(validation, 'fuelBoP').error.message}
                    </div>
                  )}
                  {getFieldValidation(validation, 'fuelBoP').warning && (
                    <div style={{ 
                      fontSize: 'var(--font-xs)', 
                      color: '#fbbf24', 
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      {getFieldValidation(validation, 'fuelBoP').warning.message}
                    </div>
                  )}
                </div>
                <div>
                  <InputField
                    label="Fuel Reserve"
                    type="number"
                    suffix="L"
                    value={form.fuelReserveLiters}
                    onChange={handleInput('fuelReserveLiters')}
                    onBlur={handleInputBlur('fuelReserveLiters', 0)}
                    min={0}
                    max={2}
                    step={0.1}
                    helpText="Buffer to keep in tank at each stop."
                  />
                  {getFieldValidation(validation, 'fuelReserveLiters').error && (
                    <div style={{ 
                      fontSize: 'var(--font-xs)', 
                      color: '#ff6b81', 
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {getFieldValidation(validation, 'fuelReserveLiters').error.message}
                    </div>
                  )}
                  {getFieldValidation(validation, 'fuelReserveLiters').warning && (
                    <div style={{ 
                      fontSize: 'var(--font-xs)', 
                      color: '#fbbf24', 
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      {getFieldValidation(validation, 'fuelReserveLiters').warning.message}
                    </div>
                  )}
                </div>
                <div>
                  <InputField
                    label="Formation Lap Fuel"
                    type="number"
                    suffix="L"
                    value={form.formationLapFuel}
                    onChange={handleInput('formationLapFuel')}
                    onBlur={handleInputBlur('formationLapFuel', 0)}
                    min={0}
                    max={5}
                    step={0.1}
                    helpText="Fuel consumed during formation lap."
                  />
                  {getFieldValidation(validation, 'formationLapFuel').error && (
                    <div style={{ 
                      fontSize: 'var(--font-xs)', 
                      color: '#ff6b81', 
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {getFieldValidation(validation, 'formationLapFuel').error.message}
                    </div>
                  )}
                  {getFieldValidation(validation, 'formationLapFuel').warning && (
                    <div style={{ 
                      fontSize: 'var(--font-xs)', 
                      color: '#fbbf24', 
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      {getFieldValidation(validation, 'formationLapFuel').warning.message}
                    </div>
                  )}
                </div>
                <div>
                  <InputField
                    label="Pit Lane Delta"
                    type="number"
                    suffix="sec"
                    value={form.pitLaneDeltaSeconds}
                    onChange={handleInput('pitLaneDeltaSeconds')}
                    onBlur={handleInputBlur('pitLaneDeltaSeconds', 27)}
                    min={10}
                    max={60}
                    step={0.1}
                    helpText="Time lost driving through pit lane (entry to exit)."
                  />
                  {getFieldValidation(validation, 'pitLaneDeltaSeconds').error && (
                    <div style={{ 
                      fontSize: 'var(--font-xs)', 
                      color: '#ff6b81', 
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {getFieldValidation(validation, 'pitLaneDeltaSeconds').error.message}
                    </div>
                  )}
                  {getFieldValidation(validation, 'pitLaneDeltaSeconds').warning && (
                    <div style={{ 
                      fontSize: 'var(--font-xs)', 
                      color: '#fbbf24', 
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      {getFieldValidation(validation, 'pitLaneDeltaSeconds').warning.message}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Strategy Modes */}
            <div className="card">
              <h3 className="section-title">Strategy Modes</h3>

              {/* Standard - Blue */}
              <div className="strategy-card strategy-standard">
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1ea7ff' }}>Standard</span>
                </div>
                <div className="strategy-inputs">
                  <InputField
                    label="Lap Time"
                    placeholder="MM:SS.sss"
                    value={form.averageLapTime}
                    onChange={handleInput('averageLapTime')}
                    helpText="Baseline lap time for standard pace."
                  />
                  <InputField
                    label="Fuel / Lap"
                    type="number"
                    suffix="L"
                    value={form.fuelPerLap}
                    onChange={handleInput('fuelPerLap')}
                    min={0.1}
                    max={10}
                    step={0.01}
                    helpText="Fuel consumption at standard pace."
                  />
                </div>
              </div>

              {/* Fuel-Saving - Green */}
              <div className="strategy-card strategy-fuel-saving">
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981' }}>Fuel-Saving</span>
                </div>
                <div className="strategy-inputs">
                  <div>
                    <InputField
                      label="Lap Time"
                      placeholder="MM:SS.sss"
                      value={form.fuelSavingLapTime}
                      onChange={handleInput('fuelSavingLapTime')}
                      helpText="Slower lap time when fuel saving."
                    />
                    {getFieldValidation(validation, 'fuelSavingLapTime').warning && (
                      <div style={{ 
                        fontSize: 'var(--font-xs)', 
                        color: '#fbbf24', 
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        {getFieldValidation(validation, 'fuelSavingLapTime').warning.message}
                      </div>
                    )}
                  </div>
                  <div>
                    <InputField
                      label="Fuel / Lap"
                      type="number"
                      suffix="L"
                      value={form.fuelSavingFuelPerLap}
                      onChange={handleInput('fuelSavingFuelPerLap')}
                      min={0.1}
                      max={10}
                      step={0.01}
                      helpText="Lower fuel consumption when saving."
                    />
                    {getFieldValidation(validation, 'fuelSavingFuelPerLap').warning && (
                      <div style={{ 
                        fontSize: 'var(--font-xs)', 
                        color: '#fbbf24', 
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        {getFieldValidation(validation, 'fuelSavingFuelPerLap').warning.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Extra Fuel-Saving - Purple */}
              <div className="strategy-card strategy-extra">
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#a855f7' }}>Extra Fuel-Saving</span>
                </div>
                <div className="strategy-inputs">
                  <div>
                    <InputField
                      label="Lap Time"
                      placeholder="MM:SS.sss"
                      value={form.extraFuelSavingLapTime}
                      onChange={handleInput('extraFuelSavingLapTime')}
                      helpText="Slowest lap time for maximum efficiency."
                    />
                    {getFieldValidation(validation, 'extraFuelSavingLapTime').warning && (
                      <div style={{ 
                        fontSize: 'var(--font-xs)', 
                        color: '#fbbf24', 
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        {getFieldValidation(validation, 'extraFuelSavingLapTime').warning.message}
                      </div>
                    )}
                  </div>
                  <div>
                    <InputField
                      label="Fuel / Lap"
                      type="number"
                      suffix="L"
                      value={form.extraFuelSavingFuelPerLap}
                      onChange={handleInput('extraFuelSavingFuelPerLap')}
                      min={0.1}
                      max={10}
                      step={0.01}
                      helpText="Lowest fuel consumption for max range."
                    />
                    {getFieldValidation(validation, 'extraFuelSavingFuelPerLap').warning && (
                      <div style={{ 
                        fontSize: 'var(--font-xs)', 
                        color: '#fbbf24', 
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        {getFieldValidation(validation, 'extraFuelSavingFuelPerLap').warning.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Hint */}
              <div style={{
                marginTop: 16,
                padding: '10px 12px',
                background: 'rgba(251, 191, 36, 0.08)',
                borderRadius: 6,
                border: '1px solid rgba(251, 191, 36, 0.15)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}>
                💡 Fine-tune lap times per stint in <strong style={{ color: '#fbbf24' }}>Stint Model</strong> tab.
              </div>
            </div>
          </div>
          
          {/* Buttons at bottom */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
            <button
              onClick={() => {
                setForm(defaultForm);
                setValidation({ errors: [], warnings: [] });
              }}
              style={{
                padding: '8px 16px',
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'var(--surface)';
                e.target.style.color = 'var(--text)';
                e.target.style.borderColor = 'var(--text-muted)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'var(--surface-muted)';
                e.target.style.color = 'var(--text-muted)';
                e.target.style.borderColor = 'var(--border)';
              }}
            >
              Reset to Defaults
            </button>
            
            <button
              onClick={handleConfirmForm}
              disabled={validation.errors.length > 0 || isCalculatingStrategy}
              style={{
                padding: '10px 20px',
                background: validation.errors.length > 0
                  ? 'var(--surface-muted)'
                  : 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                borderRadius: 8,
                color: validation.errors.length > 0 ? 'var(--text-muted)' : '#fff',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: validation.errors.length > 0 ? 'not-allowed' : 'pointer',
                boxShadow: validation.errors.length > 0 ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.2)',
                transition: 'all 0.2s ease',
                opacity: validation.errors.length > 0 ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (validation.errors.length === 0 && !isCalculatingStrategy) {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)';
                }
              }}
              onMouseLeave={(e) => {
                if (validation.errors.length === 0 && !isCalculatingStrategy) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.2)';
                }
              }}
            >
              {validation.errors.length > 0 ? 'Fix Errors to Calculate' : 'Calculate Strategy'}
            </button>
          </div>
        </div>
      )}


      {activeTab === 'strategy' && (
        <div className="tab-content">
          {showStrategyCalculated && (
            <div style={{ 
              marginBottom: 16, 
              padding: '12px 16px', 
              background: 'rgba(16, 185, 129, 0.15)', 
              borderRadius: 8, 
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ fontSize: '1.2rem' }}>✓</span>
              <p style={{ margin: 0, fontSize: 'var(--font-base)', color: '#10b981', fontWeight: 500 }}>
                Strategy calculated successfully! View your results below.
              </p>
            </div>
          )}
        <StrategyTab
            form={confirmedForm}
          standardResult={standardResult}
          fuelSavingResult={fuelSavingResult}
          strategyConfigs={strategyConfigs}
          selectedStrategy={selectedStrategy}
          setSelectedStrategy={setSelectedStrategy}
          strategyRecommendation={strategyRecommendation}
          reservePerStint={reservePerStint}
        />
        </div>
      )}

      {/* Schedule tab content hidden in initial version */}
      {/* {activeTab === 'schedule' && (
        <div className="tab-content">
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: 8, border: '1px solid rgba(251, 191, 36, 0.2)' }}>
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
      )} */}

      {activeTab === 'sandbox' && (
        <div className="tab-content">
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: 8, border: '1px solid rgba(251, 191, 36, 0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}>
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
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
                      <span className="field-label" style={{ fontSize: 'var(--font-sm)', margin: 0 }}>
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
                  <div style={{ marginTop: 8, padding: 12, background: 'rgba(251, 191, 36, 0.05)', borderRadius: 8, border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                    <h4 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>Tire Change</h4>
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
                      background: sandboxServiceTime === sandboxFuelingTime ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
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
                      background: sandboxServiceTime === sandboxTireTime ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
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
                      background: sandboxServiceTime === sandboxDriverSwapTime ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
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
              <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: 8, border: '1px solid rgba(251, 191, 36, 0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}>
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Calculate fuel saving requirements and lap time costs to optimize your stint strategy.
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
                  const [fuelReserveInput, setFuelReserveInput] = useState(
                    stintModelling.fuelReserve !== undefined
                    ? String(stintModelling.fuelReserve)
                    : '0.3'
                  );
                  
                  // Parse numeric values from string inputs
                  const baseFuel = parseFloat(baseFuelInput) || 0;
                  const tankCapacity = parseFloat(tankCapacityInput) || 0;
                  const fuelReserve = parseFloat(fuelReserveInput) || 0;
                  const usableFuel = Math.max(0, tankCapacity - fuelReserve);
                  
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
                  
                  // Cold Tire Penalties
                  const [coldTireLap1, setColdTireLap1] = useState(
                    stintModelling.coldTireLap1 !== undefined && !isNaN(parseFloat(stintModelling.coldTireLap1))
                      ? parseFloat(stintModelling.coldTireLap1)
                      : 2.5
                  );
                  const [coldTireLap2, setColdTireLap2] = useState(
                    stintModelling.coldTireLap2 !== undefined && !isNaN(parseFloat(stintModelling.coldTireLap2))
                      ? parseFloat(stintModelling.coldTireLap2)
                      : 1.5
                  );
                  const [coldTireLap3, setColdTireLap3] = useState(
                    stintModelling.coldTireLap3 !== undefined && !isNaN(parseFloat(stintModelling.coldTireLap3))
                      ? parseFloat(stintModelling.coldTireLap3)
                      : 0.5
                  );
                  
                  // Hover state for tooltip
                  const [hoverLap, setHoverLap] = useState(null);
                  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
                  
                  // -- 2. CALCULATIONS --
                  
                  // Helper: Persist specific keys to storage
                  const updateStorage = (key, val) => {
                    setStintModelling(prev => ({ ...prev, [key]: val }));
                  };
                  
                  // Parse Pace
                  const basePaceSeconds = useMemo(() => parseLapTime(basePaceInput) || 120, [basePaceInput]);
                  
                  // Auto-Calculate Laps based on Usable Fuel (Tank - Reserve)
                  const stdLapsFloat = baseFuel > 0 ? usableFuel / baseFuel : 0;
                  const stdLaps = Math.floor(stdLapsFloat);
                  
                  const saveFuel = Math.max(0.1, baseFuel - fuelSavingLiters);
                  const saveLapsFloat = saveFuel > 0 ? usableFuel / saveFuel : 0;
                  const saveLaps = Math.floor(saveLapsFloat);
                  
                  // Calculate fractional laps gained
                  const lapsGained = saveLapsFloat - stdLapsFloat;
                  // Only count full laps when we've actually gained a full lap worth
                  const fullLapsGained = lapsGained >= 1.0 ? Math.floor(lapsGained) : 0;
                  const progressToNextLap = lapsGained - Math.floor(lapsGained);
                  
                  // Calculate extra laps gained (for display in FUEL SAVED section)
                  const extraLapsGained = saveLaps - stdLaps;
                  
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
                      // Cold Tire Phase (Laps 1-3) - Configurable Penalties
                      if (lap === 1) time += coldTireLap1;
                      else if (lap === 2) time += coldTireLap2;
                      else if (lap === 3) time += coldTireLap3;
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
                  
                  const stdPoints = useMemo(() => generatePoints(basePaceSeconds, false), [basePaceSeconds, stdLaps, fuelBurnFactor, tireDegFactor, coldTireLap1, coldTireLap2, coldTireLap3]);
                  const savePoints = useMemo(() => generatePoints(basePaceSeconds, true), [basePaceSeconds, saveLaps, fuelBurnFactor, tireDegFactor, paceDelta, coldTireLap1, coldTireLap2, coldTireLap3]);
                  
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
                  const invertScaleX = (x) => Math.round(((x - padding.left) / innerW) * (graphLaps - 1));
                  
                  // Calculate average lap times (whole stint)
                  const stdAvgLapTime = stdPoints.length > 0 ? stdPoints.reduce((a, b) => a + b, 0) / stdPoints.length : 0;
                  const saveAvgLapTime = savePoints.length > 0 ? savePoints.reduce((a, b) => a + b, 0) / savePoints.length : 0;
                  
                  // Calculate cumulative times at each lap for tooltip
                  const stdCumulative = useMemo(() => {
                    let sum = 0;
                    return stdPoints.map(t => { sum += t; return sum; });
                  }, [stdPoints]);
                  
                  const saveCumulative = useMemo(() => {
                    let sum = 0;
                    return savePoints.map(t => { sum += t; return sum; });
                  }, [savePoints]);
                  
                  const handleMouseDown = (e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  };
                  
                  const handleMouseMove = (e) => {
                    const svg = svgRef.current;
                    if (!svg) return;
                    
                    const rect = svg.getBoundingClientRect();
                    const scaleFactor = height / rect.height;
                    const scaleFactorX = width / rect.width;
                    const clickY = (e.clientY - rect.top) * scaleFactor;
                    const clickX = (e.clientX - rect.left) * scaleFactorX;
                    
                    // Update hover position
                    const lapIdx = invertScaleX(clickX);
                    if (lapIdx >= 0 && lapIdx < Math.max(stdPoints.length, savePoints.length)) {
                      setHoverLap(lapIdx);
                      setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    } else {
                      setHoverLap(null);
                    }
                    
                    if (!isDragging) return;
                    
                    const lapAtClick = Math.round(((clickX - padding.left) / innerW) * (graphLaps - 1));
                    const safeLapIdx = Math.max(3, Math.min(stdPoints.length - 1, lapAtClick));
                    
                    const stdTimeAtX = stdPoints[safeLapIdx];
                    const mouseTime = invertScaleY(clickY);
                    
                    let newDelta = mouseTime - stdTimeAtX;
                    newDelta = Math.max(0, Math.min(3.0, newDelta));
                    
                    setPaceDelta(newDelta);
                  };
                  
                  const handleMouseUp = () => {
                    if (isDragging) {
                      setIsDragging(false);
                      updateStorage('fuelSaveOffset', paceDelta);
                    }
                  };
                  
                  const handleMouseLeave = () => {
                    setHoverLap(null);
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
                  
                  // ROI Math
                  const lapsForComparison = stdLaps;
                  const timeLostAtBox = (savePoints.slice(0, lapsForComparison).reduce((a,b)=>a+b,0) - stdPoints.slice(0, lapsForComparison).reduce((a,b)=>a+b,0));
                  const fuelSavedTotal = lapsForComparison * fuelSavingLiters;
                  const costPerLiter = fuelSavedTotal > 0 ? timeLostAtBox / fuelSavedTotal : 0;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      
                      {/* --- ROW 1: INPUTS --- */}
                      <div className="card" style={{ padding: 20, background: 'var(--surface-muted)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 20 }}>
                          
                          {/* Standard Lap Time */}
                          <div>
                            <label className="field-label" style={{ marginBottom: 8 }}>Standard Lap Time</label>
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
                            <label className="field-label" style={{ marginBottom: 8 }}>Standard Fuel / Lap</label>
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
                            <label className="field-label" style={{ marginBottom: 8 }}>Tank Capacity</label>
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
                          {/* Fuel Reserve */}
                          <div>
                            <label className="field-label" style={{ marginBottom: 8 }}>Fuel Reserve</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="input-field" 
                              value={fuelReserveInput}
                              onChange={(e) => setFuelReserveInput(e.target.value)}
                              onBlur={(e) => {
                                const v = Math.max(0, parseFloat(e.target.value) || 0);
                                setFuelReserveInput(String(v));
                                updateStorage('fuelReserve', v);
                              }}
                              style={{ width: '100%' }}
                            />
                          </div>
                          </div>
                        </div>
                        
                      {/* --- ROW 2: FUEL SAVING (HERO) + LAP TARGETS --- */}
                      <div className="card" style={{ padding: 20, background: 'var(--surface-muted)' }}>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '1fr 1fr', 
                          gap: 24,
                          padding: 16,
                          background: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          marginBottom: 16
                        }}>
                          {/* Fuel Saving Slider */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <label className="field-label" style={{ color: '#10b981', margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Fuel Saving</label>
                              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#10b981' }}>-{fuelSavingLiters.toFixed(2)} L/lap</span>
                            </div>
                            <input 
                              type="range" 
                              min={0} 
                              max={baseFuel * 0.10 || 0.5}
                              step={0.01}
                              value={fuelSavingLiters}
                              onInput={(e) => setFuelSavingLiters(parseFloat(e.target.value))}
                              onChange={(e) => setFuelSavingLiters(parseFloat(e.target.value))}
                              onMouseUp={() => updateStorage('fuelSavingPerLap', fuelSavingLiters)}
                              onTouchEnd={() => updateStorage('fuelSavingPerLap', fuelSavingLiters)}
                              style={{ width: '100%', accentColor: '#10b981', cursor: 'grab' }}
                            />
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                              Current: <strong style={{ color: '#10b981' }}>{saveFuel.toFixed(2)} L/lap</strong> → {saveLapsFloat.toFixed(2)} laps
                            </div>
                          </div>
                          
                          {/* Lap Targets */}
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                            {(() => {
                              const targets = [
                                { label: 'Standard', laps: stdLaps, consumption: baseFuel },
                                { label: '+1 lap', laps: stdLaps + 1, consumption: usableFuel / (stdLaps + 1) },
                                { label: '+2 laps', laps: stdLaps + 2, consumption: usableFuel / (stdLaps + 2) },
                              ];
                              // Color mapping: Standard (blue), +1 lap (green), +2 laps (purple)
                              const colors = [
                                { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.35)', text: '#3b82f6' }, // Standard - blue
                                { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.35)', text: '#22c55e' }, // +1 lap - green
                                { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.35)', text: '#a855f7' }, // +2 laps - purple
                              ];
                              return targets.map((target, idx) => {
                                const achieved = saveFuel <= target.consumption;
                                const isNext = !achieved && (idx === 0 || saveFuel <= targets[idx - 1].consumption);
                                const delta = saveFuel - target.consumption;
                                const displayDelta = delta > 0 && delta < 0.005 ? 0.01 : delta;
                                const color = colors[idx];
                                return (
                                  <div 
                                    key={idx}
                                    style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'center',
                                      padding: '4px 8px',
                                      borderRadius: 4,
                                      background: achieved ? color.bg : 'transparent',
                                      border: achieved ? `1px solid ${color.border}` : 'none',
                                      fontSize: '0.75rem'
                                    }}
                                  >
                                    <span style={{ color: achieved ? color.text : 'var(--text-muted)' }}>
                                      {target.label} ({target.laps} laps)
                                    </span>
                                    <span style={{ fontWeight: 500, color: achieved ? color.text : 'var(--text-muted)' }}>
                                      {target.consumption.toFixed(2)} L/lap
                                    </span>
                                    <span style={{ width: 80, textAlign: 'right' }}>
                                      {achieved ? (
                                        <span style={{ color: color.text }}>✓</span>
                                      ) : isNext ? (
                                        <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>-{displayDelta.toFixed(2)} L more</span>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>—</span>
                                      )}
                                    </span>
                            </div>
                                );
                              });
                            })()}
                            </div>
                          </div>
                          
                        {/* --- ROW 3: PHYSICS SLIDERS (3 columns) --- */}
                            <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(3, 1fr)', 
                          gap: 24,
                          padding: 16,
                          background: 'rgba(0, 0, 0, 0.2)',
                              borderRadius: 8, 
                          border: '1px solid var(--border)'
                        }}>
                          {/* Pace Delta Slider */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <label className="field-label" style={{ margin: 0, fontSize: '0.75rem' }}>Pace Delta</label>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>+{paceDelta.toFixed(2)} s</span>
                              </div>
                            <input 
                              type="range" 
                              min={0} 
                              max={2.5} 
                              step={0.01}
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
                          {/* Fuel Burn Slider */}
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
                          {/* Tire Deg Slider */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <label className="field-label" style={{ margin: 0, fontSize: '0.75rem' }}>Tire Deg Effect</label>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>+{tireDegFactor.toFixed(2)} s</span>
                            </div>
                            <input 
                              type="range" 
                              min={0} 
                              max={0.1} 
                              step={0.01}
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
                              
                        {/* --- COLD TIRE PENALTIES (3 columns) --- */}
                              <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(3, 1fr)', 
                          gap: 24, 
                          padding: 16, 
                          background: 'rgba(0, 0, 0, 0.2)', 
                          borderRadius: 8, 
                          border: '1px solid var(--border)',
                          marginTop: 16
                        }}>
                          {/* Lap 1 Lap Time */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <label className="field-label" style={{ margin: 0, fontSize: '0.75rem' }}>Lap 1 Lap Time</label>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>+{coldTireLap1.toFixed(1)} s</span>
                                </div>
                            <input 
                              type="range" 
                              min={0} 
                              max={6} 
                              step={0.1} 
                              value={coldTireLap1} 
                              onInput={(e) => setColdTireLap1(parseFloat(e.target.value))} 
                              onChange={(e) => setColdTireLap1(parseFloat(e.target.value))} 
                              onMouseUp={() => updateStorage('coldTireLap1', coldTireLap1)} 
                              onTouchEnd={() => updateStorage('coldTireLap1', coldTireLap1)} 
                              style={{ width: '100%', cursor: 'grab' }} 
                            />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Out lap penalty
                                </div>
                                </div>
                          
                          {/* Lap 2 Lap Time */}
                                <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <label className="field-label" style={{ margin: 0, fontSize: '0.75rem' }}>Lap 2 Lap Time</label>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>+{coldTireLap2.toFixed(1)} s</span>
                                </div>
                            <input 
                              type="range" 
                              min={0} 
                              max={3} 
                              step={0.1} 
                              value={coldTireLap2} 
                              onInput={(e) => setColdTireLap2(parseFloat(e.target.value))} 
                              onChange={(e) => setColdTireLap2(parseFloat(e.target.value))} 
                              onMouseUp={() => updateStorage('coldTireLap2', coldTireLap2)} 
                              onTouchEnd={() => updateStorage('coldTireLap2', coldTireLap2)} 
                              style={{ width: '100%', cursor: 'grab' }} 
                            />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Tires warming up
                              </div>
                            </div>
                          
                          {/* Lap 3 Lap Time */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <label className="field-label" style={{ margin: 0, fontSize: '0.75rem' }}>Lap 3 Lap Time</label>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>+{coldTireLap3.toFixed(1)} s</span>
                            </div>
                            <input 
                              type="range" 
                              min={0} 
                              max={1.5} 
                              step={0.1} 
                              value={coldTireLap3} 
                              onInput={(e) => setColdTireLap3(parseFloat(e.target.value))} 
                              onChange={(e) => setColdTireLap3(parseFloat(e.target.value))} 
                              onMouseUp={() => updateStorage('coldTireLap3', coldTireLap3)} 
                              onTouchEnd={() => updateStorage('coldTireLap3', coldTireLap3)} 
                              style={{ width: '100%', cursor: 'grab' }} 
                            />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Almost at temp
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* --- ROW 3: GRAPH + AVERAGES --- */}
                      <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
                        {/* Graph SVG */}
                        <div 
                          style={{ position: 'relative', height: height, flex: 1, background: 'var(--surface-muted)', cursor: isDragging ? 'grabbing' : 'crosshair' }}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseLeave}
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
                              {/* X-Axis Labels */}
                              <text x={scaleX(0)} y={height - 5} fill="var(--text-muted)" fontSize="10" textAnchor="middle">L1</text>
                              <text x={scaleX(stdLaps - 1)} y={height - 5} fill="#0ea5e9" fontSize="10" textAnchor="middle" fontWeight="bold">L{stdLaps}</text>
                              {saveLaps > stdLaps && (
                                <text x={scaleX(saveLaps - 1)} y={height - 5} fill="#10b981" fontSize="10" textAnchor="middle" fontWeight="bold">L{saveLaps}</text>
                              )}
                              
                              {/* Hover vertical line */}
                              {hoverLap !== null && hoverLap < Math.max(stdPoints.length, savePoints.length) && (
                          <line
                                  x1={scaleX(hoverLap)}
                            y1={padding.top}
                                  x2={scaleX(hoverLap)}
                            y2={height - padding.bottom}
                                  stroke="rgba(255,255,255,0.3)"
                                  strokeWidth="1"
                                  strokeDasharray="4 4"
                                />
                              )}
                              
                              {/* Blue (Standard) Line */}
                              <path d={makePath(stdPoints)} fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
                              <circle cx={scaleX(stdPoints.length-1)} cy={scaleY(stdPoints[stdPoints.length-1])} r="4" fill="#0ea5e9" />
                              
                              {/* Green (Saver) Line - Draggable */}
                              <g 
                                onMouseDown={handleMouseDown} 
                                style={{ cursor: 'grab' }}
                              >
                                <path d={makePath(savePoints)} fill="none" stroke="transparent" strokeWidth="20" />
                                <path d={makePath(savePoints)} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx={scaleX(savePoints.length-1)} cy={scaleY(savePoints[savePoints.length-1])} r="5" fill="#10b981" stroke="#fff" strokeWidth="2" />
                              </g>
                              
                              {/* Hover dots */}
                              {hoverLap !== null && stdPoints[hoverLap] !== undefined && (
                                <circle cx={scaleX(hoverLap)} cy={scaleY(stdPoints[hoverLap])} r="5" fill="#0ea5e9" stroke="#fff" strokeWidth="2" />
                              )}
                              {hoverLap !== null && savePoints[hoverLap] !== undefined && (
                                <circle cx={scaleX(hoverLap)} cy={scaleY(savePoints[hoverLap])} r="5" fill="#10b981" stroke="#fff" strokeWidth="2" />
                              )}
                          </svg>
                          
                           {/* Hover Tooltip */}
                           {hoverLap !== null && (stdPoints[hoverLap] !== undefined || savePoints[hoverLap] !== undefined) && (
                             <div style={{
                               position: 'absolute',
                               left: (() => {
                                 const dotX = scaleX(hoverLap);
                                 const tooltipWidth = 180;
                                 // Position to the right if there's space, otherwise to the left
                                 return dotX + tooltipWidth > width ? dotX - tooltipWidth - 12 : dotX + 12;
                               })(),
                               top: (() => {
                                 // Use the lower of the two points (higher Y value = lower on screen)
                                 const stdY = stdPoints[hoverLap] !== undefined ? scaleY(stdPoints[hoverLap]) : height;
                                 const saveY = savePoints[hoverLap] !== undefined ? scaleY(savePoints[hoverLap]) : height;
                                 const dotY = Math.max(stdY, saveY);
                                 // Position tooltip above the dot
                                 return Math.max(10, dotY - 100);
                               })(),
                               background: 'rgba(0,0,0,0.9)',
                               border: '1px solid var(--border)',
                               borderRadius: 6,
                               padding: '8px 12px',
                               pointerEvents: 'none',
                               zIndex: 10,
                               minWidth: 160
                             }}>
                               <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
                                 Lap {hoverLap + 1}
                               </div>
                               {stdPoints[hoverLap] !== undefined && (
                                 <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
                                   <span style={{ fontSize: '0.7rem', color: '#0ea5e9' }}>Standard:</span>
                                   <span style={{ fontSize: '0.7rem', color: '#0ea5e9', fontWeight: 600 }}>{formatLapTime(stdPoints[hoverLap])}</span>
                                 </div>
                               )}
                               {savePoints[hoverLap] !== undefined && (
                                 <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
                                   <span style={{ fontSize: '0.7rem', color: '#10b981' }}>Fuel Save:</span>
                                   <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>{formatLapTime(savePoints[hoverLap])}</span>
                                 </div>
                               )}
                               {stdPoints[hoverLap] !== undefined && savePoints[hoverLap] !== undefined && (
                                 <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                                   <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Delta:</span>
                                   <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>+{(savePoints[hoverLap] - stdPoints[hoverLap]).toFixed(3)}s</span>
                      </div>
                               )}
                              {stdCumulative[hoverLap] !== undefined && saveCumulative[hoverLap] !== undefined && (
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 4 }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Gap:</span>
                                    <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>-{(saveCumulative[hoverLap] - stdCumulative[hoverLap]).toFixed(1)}s</span>
                      </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Elapsed:</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                      {(() => {
                                        const totalSeconds = stdCumulative[hoverLap];
                                        const mins = Math.floor(totalSeconds / 60);
                                        const secs = Math.floor(totalSeconds % 60);
                                        return `${mins}:${String(secs).padStart(2, '0')}`;
                                      })()}
                                    </span>
                                  </div>
                                </>
                              )}
                             </div>
                           )}
                           
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
                          minWidth: 150
                        }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Stint Average
                        </div>
                        
                          {/* Standard */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: '0.7rem', color: '#0ea5e9' }}>Standard</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0ea5e9' }}>
                              {formatLapTime(stdAvgLapTime)}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {stdPoints.length} laps • {(() => {
                                const totalSeconds = stdCumulative[stdCumulative.length - 1] || 0;
                                const mins = Math.floor(totalSeconds / 60);
                                const secs = Math.floor(totalSeconds % 60);
                                return `${mins}:${String(secs).padStart(2, '0')}`;
                              })()}
                            </span>
                          </div>
                          
                          {/* Fuel Save */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: '0.7rem', color: '#10b981' }}>Fuel Save</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#10b981' }}>
                              {formatLapTime(saveAvgLapTime)}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {savePoints.length} laps • {(() => {
                                const totalSeconds = saveCumulative[saveCumulative.length - 1] || 0;
                                const mins = Math.floor(totalSeconds / 60);
                                const secs = Math.floor(totalSeconds % 60);
                                return `${mins}:${String(secs).padStart(2, '0')}`;
                              })()}
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
                        
                      {/* --- ROW 4: STRATEGY ROI (Enhanced) --- */}
                      <div className="card">
                        <div className="stat-label" style={{ marginBottom: 16 }}>Strategy ROI Analysis</div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                          {/* Left: The Cost */}
                          <div style={{ 
                            padding: 16, 
                            background: 'rgba(239, 68, 68, 0.05)', 
                            borderRadius: 8, 
                            border: '1px solid rgba(239, 68, 68, 0.2)' 
                          }}>
                            <div style={{ fontSize: '0.75rem', color: '#ef4444', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              LAP TIME COST
                            </div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
                              -{timeLostAtBox.toFixed(1)}s
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                              Total time lost over <strong>{lapsForComparison} laps</strong> by driving at fuel-save pace instead of standard pace.
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8, opacity: 0.7 }}>
                              = {lapsForComparison} laps × {paceDelta.toFixed(2)}s avg delta
                            </div>
                            </div>
                            
                          {/* Right: The Reward */}
                            <div style={{ 
                            padding: 16, 
                            background: 'rgba(16, 185, 129, 0.05)', 
                            borderRadius: 8, 
                            border: '1px solid rgba(16, 185, 129, 0.2)' 
                          }}>
                            <div style={{ fontSize: '0.75rem', color: '#10b981', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              FUEL SAVED
                              </div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981', marginBottom: 8 }}>
                              +{fuelSavedTotal.toFixed(2)}L
                              </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                              Total fuel saved over <strong>{lapsForComparison} laps</strong>{extraLapsGained > 0 ? <>, extending stint by <strong style={{ color: '#10b981' }}>+{extraLapsGained} lap{extraLapsGained > 1 ? 's' : ''}</strong></> : ', building safety margin'}.
                              </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8, opacity: 0.7 }}>
                              = {lapsForComparison} laps × {fuelSavingLiters.toFixed(2)}L saved/lap
                            </div>
                          </div>
                        </div>
                        
                        {/* Bottom: Efficiency Metric */}
                        <div style={{ 
                          marginTop: 16,
                          padding: 16,
                          background: 'rgba(251, 191, 36, 0.08)',
                          borderRadius: 8,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                              <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Efficiency: Time Cost per Liter Saved</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                              {timeLostAtBox.toFixed(1)}s ÷ {fuelSavedTotal.toFixed(2)}L
                              </div>
                            </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
                              {costPerLiter.toFixed(2)}
                          </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>seconds / liter</div>
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
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: 8, border: '1px solid rgba(251, 191, 36, 0.3)' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              ℹ️ <strong>Tank Capacity</strong>, <strong>Fuel BoP</strong>, and <strong>Fuel Reserve</strong> values are taken from the <strong>Setup</strong> tab.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'fuel-calculator' && (
        <div className="tab-content">
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: 8, border: '1px solid rgba(251, 191, 36, 0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}>
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
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
                                  background: isTarget ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
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

      <footer className="footer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v0.7 - alpha</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
