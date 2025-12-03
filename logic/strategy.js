// ==================== STRATEGY CALCULATION LOGIC ====================

// ==================== STINT CAPACITY CALCULATOR ====================

const calculateStintCapacities = (tankCapacity, reserveFuel, stdFuelPerLap, fsFuelPerLap, efsFuelPerLap) => {
  const usableFuel = tankCapacity - reserveFuel;
  return {
    std: Math.floor(usableFuel / stdFuelPerLap),
    fs: Math.floor(usableFuel / fsFuelPerLap),
    efs: Math.floor(usableFuel / efsFuelPerLap),
  };
};

// ==================== RACE SIMULATION ====================

/**
 * Simulates a race with given stint modes (array of 'std', 'fs', 'efs')
 * Returns detailed stint breakdown with laps, fuel consumption, and timing
 */
const simulateRace = ({
  raceDurationSeconds,
  tankCapacity,
  reserveFuel,
  formationLapFuel,
  pitLaneDelta,
  fullTankRefuelTime,
  stdLapTime,
  stdFuelPerLap,
  fsLapTime,
  fsFuelPerLap,
  efsLapTime,
  efsFuelPerLap,
  stintModes,
}) => {
  const stints = [];
  let currentTime = 0;
  let totalLapsCompleted = 0;
  let fuelInTank = tankCapacity - formationLapFuel;
  let totalFuelUsed = formationLapFuel;
  let raceEnded = false;
  let fractionalLaps = 0;

  let stintIndex = 0;
  let stintNumber = 1;
  let stintStartTime = 0;
  let stintStartLap = 1;
  let stintStartFuel = fuelInTank;
  let stintLaps = 0;

  const getModeParams = (mode) => {
    switch (mode) {
      case 'efs': return { lapTime: efsLapTime, fuelPerLap: efsFuelPerLap };
      case 'fs': return { lapTime: fsLapTime, fuelPerLap: fsFuelPerLap };
      default: return { lapTime: stdLapTime, fuelPerLap: stdFuelPerLap };
    }
  };

  while (!raceEnded) {
    const currentMode = stintModes[Math.min(stintIndex, stintModes.length - 1)];
    const { lapTime, fuelPerLap } = getModeParams(currentMode);
    const fuelNeeded = fuelPerLap + reserveFuel;

    // Need to pit?
    if (fuelInTank < fuelNeeded && stintLaps > 0) {
      const fuelUsedInStint = stintStartFuel - fuelInTank;
      totalFuelUsed += fuelUsedInStint;
      
      stints.push({
        id: stintNumber,
        laps: stintLaps,
        startLap: stintStartLap,
        endLap: stintStartLap + stintLaps - 1,
        duration: currentTime - stintStartTime,
        fuelUsed: fuelUsedInStint,
        fuelRemaining: fuelInTank,
        mode: currentMode,
        fuelPerLap,
        lapTime,
      });

      const fuelToAdd = tankCapacity - fuelInTank;
      const fuelingTime = (fuelToAdd / tankCapacity) * fullTankRefuelTime;
      const pitTime = pitLaneDelta + fuelingTime;
      currentTime += pitTime;

      if (currentTime >= raceDurationSeconds) {
        fractionalLaps = totalLapsCompleted;
        raceEnded = true;
        break;
      }

      fuelInTank = tankCapacity;
      stintIndex++;
      stintNumber++;
      stintStartTime = currentTime;
      stintStartLap = totalLapsCompleted + 1;
      stintStartFuel = fuelInTank;
      stintLaps = 0;
    }

    const lapStartTime = currentTime;
    currentTime += lapTime;
    totalLapsCompleted++;
    stintLaps++;
    fuelInTank -= fuelPerLap;

    // Check if race time expired during this lap
    if (lapStartTime < raceDurationSeconds && currentTime >= raceDurationSeconds) {
      const timeIntoLap = raceDurationSeconds - lapStartTime;
      fractionalLaps = (totalLapsCompleted - 1) + (timeIntoLap / lapTime);
      raceEnded = true;
    }
  }

  // Record final stint
  if (stintLaps > 0) {
    const currentMode = stintModes[Math.min(stintIndex, stintModes.length - 1)];
    const { lapTime, fuelPerLap } = getModeParams(currentMode);
    const fuelUsedInStint = stintStartFuel - fuelInTank;
    totalFuelUsed += fuelUsedInStint;
    
    stints.push({
      id: stintNumber,
      laps: stintLaps,
      startLap: stintStartLap,
      endLap: stintStartLap + stintLaps - 1,
      duration: currentTime - stintStartTime,
      fuelUsed: fuelUsedInStint,
      fuelRemaining: fuelInTank,
      mode: currentMode,
      fuelPerLap,
      lapTime,
    });
  }

  // Calculate pit times with splash-and-dash optimization for last pit stop
  let totalPitTime = 0;
  const pitStops = stints.length - 1;
  
  for (let i = 0; i < pitStops; i++) {
    const isLastPitStop = i === pitStops - 1;
    let fuelToAdd;
    
    if (isLastPitStop) {
      // Last pit: only add enough fuel for final stint + reserve (splash-and-dash)
      const finalStint = stints[i + 1];
      const finalStintFuelPerLap = finalStint.fuelPerLap;
      const fuelNeededForFinalStint = (finalStint.laps * finalStintFuelPerLap) + reserveFuel;
      fuelToAdd = Math.max(0, fuelNeededForFinalStint - stints[i].fuelRemaining);
      stints[i + 1].splashFuel = fuelToAdd;
      stints[i + 1].isSplash = true;
    } else {
      // Full tank for non-final pit stops
      fuelToAdd = tankCapacity - stints[i].fuelRemaining;
    }
    
    const fuelingTime = (fuelToAdd / tankCapacity) * fullTankRefuelTime;
    const pitTime = pitLaneDelta + fuelingTime;
    stints[i].pitTime = pitTime;
    stints[i].fuelToAdd = fuelToAdd;
    totalPitTime += pitTime;
  }

  // Build actual stint modes from simulated stints
  const actualModes = stints.map(s => s.mode);
  const totalLaps = stints.reduce((sum, s) => sum + s.laps, 0);

  if (fractionalLaps === 0) {
    fractionalLaps = totalLaps;
  }

  // Count modes from actual stints
  const stdCount = stints.filter(s => s.mode === 'std').length;
  const fsCount = stints.filter(s => s.mode === 'fs').length;
  const efsCount = stints.filter(s => s.mode === 'efs').length;

  // Calculate laps per mode
  const stdLaps = stints.filter(s => s.mode === 'std').reduce((sum, s) => sum + s.laps, 0);
  const fsLaps = stints.filter(s => s.mode === 'fs').reduce((sum, s) => sum + s.laps, 0);
  const efsLaps = stints.filter(s => s.mode === 'efs').reduce((sum, s) => sum + s.laps, 0);

  // Calculate fuel per mode
  const stdFuel = stints.filter(s => s.mode === 'std').reduce((sum, s) => sum + s.fuelUsed, 0);
  const fsFuel = stints.filter(s => s.mode === 'fs').reduce((sum, s) => sum + s.fuelUsed, 0);
  const efsFuel = stints.filter(s => s.mode === 'efs').reduce((sum, s) => sum + s.fuelUsed, 0);

  return {
    totalLaps,
    fractionalLaps,
    completeLapsAtWhiteFlag: Math.floor(fractionalLaps),
    pitStops: stints.length - 1,
    stintCount: stints.length,
    stints,
    totalPitTime,
    totalFuelUsed,
    stintModes: actualModes,
    stdCount,
    fsCount,
    efsCount,
    stdLaps,
    fsLaps,
    efsLaps,
    stdFuel,
    fsFuel,
    efsFuel,
    maxLapsPerStint: Math.max(...stints.map(s => s.laps), 0),
    lapTimeSeconds: stdLapTime,
    fuelPerLap: stdFuelPerLap,
    reserveFuel,
    tankCapacity,
  };
};

// ==================== OPTIMAL STRATEGY FINDER ====================

/**
 * Finds optimal strategies by:
 * 1. Calculate standard-only baseline (all STD stints)
 * 2. Try to reduce pit stops using minimum fuel saving necessary
 * 3. Priority: maximize STD stints → then FS → minimize EFS
 * 
 * Returns array of strategies sorted by effectiveness
 */
const findOptimalStrategies = (config) => {
  const stdLapTime = parseLapTime(config.averageLapTime);
  const stdFuelPerLap = safeNumber(config.fuelPerLap);
  const fsLapTime = parseLapTime(config.fuelSavingLapTime);
  const fsFuelPerLap = safeNumber(config.fuelSavingFuelPerLap);
  const efsLapTime = parseLapTime(config.extraFuelSavingLapTime);
  const efsFuelPerLap = safeNumber(config.extraFuelSavingFuelPerLap);
  
  // Apply Fuel BoP reduction to tank capacity
  const baseTankCapacity = safeNumber(config.tankCapacity) || 106;
  const fuelBoP = safeNumber(config.fuelBoP) || 0;
  const tankCapacity = baseTankCapacity * (1 - fuelBoP / 100);
  
  const reserveFuel = safeNumber(config.fuelReserveLiters) || 0;
  const formationLapFuel = safeNumber(config.formationLapFuel) || 0;
  const pitLaneDelta = safeNumber(config.pitLaneDeltaSeconds) || 27;
  const fullTankRefuelTime = FULL_TANK_FUELING_TIME; // Use constant from raceConstants.js
  const raceDurationSeconds = config.raceDurationMinutes * 60;

  const capacities = calculateStintCapacities(
    tankCapacity, reserveFuel, stdFuelPerLap, fsFuelPerLap, efsFuelPerLap
  );

  const baseParams = {
    raceDurationSeconds,
    tankCapacity,
    reserveFuel,
    formationLapFuel,
    pitLaneDelta,
    fullTankRefuelTime,
    stdLapTime,
    stdFuelPerLap,
    fsLapTime,
    fsFuelPerLap,
    efsLapTime,
    efsFuelPerLap,
  };

  const strategies = [];
  const avgPitTime = pitLaneDelta + fullTankRefuelTime;

  // Step 1: Calculate standard-only baseline
  const estimatedStints = Math.ceil(raceDurationSeconds / (stdLapTime * capacities.std));
  const standardModes = Array(Math.max(estimatedStints + 2, 10)).fill('std');
  const standardResult = simulateRace({ ...baseParams, stintModes: standardModes });
  
  standardResult.strategyName = 'Standard';
  standardResult.strategyType = 'standard';
  standardResult.strategyMode = 'standard';
  standardResult.lapTimeLoss = 0;
  standardResult.pitTimeSaved = 0;
  standardResult.netTimeDelta = 0;
  strategies.push(standardResult);

  const standardPitStops = standardResult.pitStops;

  // Step 2: Try to save pit stops with minimal fuel saving
  for (let targetPits = standardPitStops - 1; targetPits >= 0; targetPits--) {
    const targetStints = targetPits + 1;
    const modes = ['std', 'fs', 'efs'];
    const candidates = [];

    // Generate all combinations for this stint count
    const totalCombos = Math.pow(3, targetStints);
    
    for (let i = 0; i < totalCombos; i++) {
      const combo = [];
      let temp = i;
      for (let j = 0; j < targetStints; j++) {
        combo.push(modes[temp % 3]);
        temp = Math.floor(temp / 3);
      }

      const result = simulateRace({ ...baseParams, stintModes: combo });
      
      // Only accept if we actually achieved target pit count
      if (result.pitStops === targetPits) {
        // Calculate time impact vs standard
        const lapTimeLoss = 
          result.fsLaps * (fsLapTime - stdLapTime) + 
          result.efsLaps * (efsLapTime - stdLapTime);
        const pitTimeSaved = (standardPitStops - result.pitStops) * avgPitTime;
        const netTimeDelta = pitTimeSaved - lapTimeLoss;

        result.lapTimeLoss = lapTimeLoss;
        result.pitTimeSaved = pitTimeSaved;
        result.netTimeDelta = netTimeDelta;
        result.pitsSaved = standardPitStops - result.pitStops;
        
        // Build strategy name from actual simulated modes
        const modeSummary = result.stintModes.map(m => m.toUpperCase()).join('→');
        result.strategyName = `${result.pitStops} pit${result.pitStops !== 1 ? 's' : ''}: ${modeSummary}`;
        result.strategyType = result.efsCount > 0 ? 'efs' : (result.fsCount > 0 ? 'fs' : 'standard');
        result.strategyMode = result.efsCount > 0 ? 'extra-fuel-saving' : (result.fsCount > 0 ? 'fuel-saving' : 'standard');

        // Check for duplicates
        const isDuplicate = candidates.some(c => c.strategyName === result.strategyName);
        if (!isDuplicate) {
          candidates.push(result);
        }
      }
    }

    // Sort candidates: most STD stints → most FS stints → least EFS stints
    candidates.sort((a, b) => {
      if (a.stdCount !== b.stdCount) return b.stdCount - a.stdCount;
      if (a.fsCount !== b.fsCount) return b.fsCount - a.fsCount;
      return a.efsCount - b.efsCount;
    });

    // Add best candidates for this pit count
    if (candidates.length > 0) {
      strategies.push(...candidates.slice(0, 2));
    }
  }

  return {
    strategies,
    capacities,
    standardPitStops,
    tankCapacity,
    reserveFuel,
  };
};

// ==================== MAIN COMPUTE FUNCTION ====================

/**
 * Main entry point for strategy calculation
 * @param {Object} config - Race configuration
 * @param {string} strategyMode - 'standard' or 'fuel-saving'
 * @returns {Object} Computed strategy plan
 */
const computePlan = (config, strategyMode = 'standard') => {
  const errors = [];

  // Basic validation
  if (!config.raceDurationMinutes || config.raceDurationMinutes <= 0) {
    errors.push('Race duration must be greater than zero.');
  }
  if (!config.tankCapacity || safeNumber(config.tankCapacity) <= 0) {
    errors.push('Tank capacity must be greater than zero.');
  }
  if (!config.averageLapTime || parseLapTime(config.averageLapTime) <= 0) {
    errors.push('Provide a valid average lap time.');
  }
  if (!config.fuelPerLap || safeNumber(config.fuelPerLap) <= 0) {
    errors.push('Fuel usage per lap must be greater than zero.');
  }

  if (errors.length) {
    return { errors };
  }

  const result = findOptimalStrategies(config);

  if (!result.strategies || result.strategies.length === 0) {
    return { errors: ['No viable strategy found'] };
  }

  // Select strategy based on mode
  let selectedStrategy;
  if (strategyMode === 'fuel-saving') {
    selectedStrategy = result.strategies.find(s => 
      s.fsCount > 0 || s.efsCount > 0
    ) || result.strategies[0];
  } else {
    // Standard mode - use first strategy (all STD)
    selectedStrategy = result.strategies[0];
  }

  // Transform stints to stintPlan format with mode mapping for compatibility
  const reserveLiters = safeNumber(config.fuelReserveLiters) || 0;
  const formationLapFuel = safeNumber(config.formationLapFuel) || 0;
  
  const stintPlan = selectedStrategy.stints.map((stint, idx) => {
    const isFirstStint = idx === 0;
    
    // Map internal modes ('std', 'fs', 'efs') to component modes ('standard', 'fuel-saving', 'extra-fuel-saving')
    const modeMap = {
      'std': 'standard',
      'fs': 'fuel-saving',
      'efs': 'extra-fuel-saving',
    };
    const stintMode = modeMap[stint.mode] || 'standard';

    const fuelAtStart = isFirstStint
      ? result.tankCapacity - formationLapFuel
      : result.tankCapacity;

    const fuelTarget = stint.laps > 0 
      ? (fuelAtStart - result.reserveFuel) / stint.laps 
      : 0;

    return {
      id: stint.id,
      laps: stint.laps,
      startLap: stint.startLap,
      endLap: stint.endLap,
      stintDuration: stint.duration,
      fuel: stint.fuelUsed,
      fuelLeft: stint.fuelRemaining,
      fuelTarget: fuelTarget,
      fuelToAdd: stint.fuelToAdd || 0,
      fuelAtStart: fuelAtStart,
      stintMode: stintMode,
      strategyFuelPerLap: stint.fuelPerLap,
      perStopLoss: stint.pitTime || 0,
      lapTime: stint.lapTime,
      isSplash: stint.isSplash || false,
      splashFuel: stint.splashFuel || 0,
    };
  });

  // Calculate total race time with stops
  const totalRaceTimeWithStops = stintPlan.reduce((sum, stint) => sum + stint.stintDuration, 0) 
    + selectedStrategy.totalPitTime;

  // Calculate average per stop loss
  const avgPerStopLoss = selectedStrategy.pitStops > 0 
    ? selectedStrategy.totalPitTime / selectedStrategy.pitStops 
    : 0;

  // Calculate max race time seconds (legacy field)
  const lapSeconds = parseLapTime(config.averageLapTime);
  const maxRaceTimeSeconds = (config.raceDurationMinutes || 0) * 60 + lapSeconds;

  // Calculate total fuel with reserve (legacy field)
  const totalFuelWithReserve = selectedStrategy.totalFuelUsed + reserveLiters * selectedStrategy.stintCount;

  // Map allStrategies to allCandidates for compatibility
  const allCandidates = result.strategies.map(strategy => ({
    ...strategy,
    candidateName: strategy.strategyName,
  }));

  return {
    // Legacy fields (keep exact same names)
    errors: [],
    lapSeconds: lapSeconds,
    totalLaps: selectedStrategy.totalLaps,
    decimalLaps: selectedStrategy.fractionalLaps,
    raceDurationSeconds: (config.raceDurationMinutes || 0) * 60,
    maxRaceTimeSeconds: maxRaceTimeSeconds,
    totalFuelNeeded: selectedStrategy.totalFuelUsed,
    totalFuelWithReserve: totalFuelWithReserve,
    lapsPerStint: selectedStrategy.maxLapsPerStint,
    stintCount: selectedStrategy.stintCount,
    pitStops: selectedStrategy.pitStops,
    stintPlan: stintPlan,
    totalPitTime: selectedStrategy.totalPitTime,
    totalRaceTimeWithStops: totalRaceTimeWithStops,
    perStopLoss: avgPerStopLoss,
    pitLaneDelta: safeNumber(config.pitLaneDeltaSeconds) || 27,
    fuelPerLap: selectedStrategy.fuelPerLap,
    strategyMode: strategyMode,
    candidateName: selectedStrategy.strategyName,
    stintModes: selectedStrategy.stintModes,
    allCandidates: allCandidates,
    
    // New fields (additions, not replacements)
    strategyName: selectedStrategy.strategyName,
    strategyType: selectedStrategy.strategyType,
    stdCount: selectedStrategy.stdCount,
    fsCount: selectedStrategy.fsCount,
    efsCount: selectedStrategy.efsCount,
    stdLaps: selectedStrategy.stdLaps,
    fsLaps: selectedStrategy.fsLaps,
    efsLaps: selectedStrategy.efsLaps,
    stdFuel: selectedStrategy.stdFuel,
    fsFuel: selectedStrategy.fsFuel,
    efsFuel: selectedStrategy.efsFuel,
    lapTimeLoss: selectedStrategy.lapTimeLoss || 0,
    pitTimeSaved: selectedStrategy.pitTimeSaved || 0,
    netTimeDelta: selectedStrategy.netTimeDelta || 0,
    capacities: result.capacities,
    allStrategies: result.strategies,
  };
};
