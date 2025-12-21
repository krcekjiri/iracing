// ==================== STRATEGY CALCULATION LOGIC ====================

// ==================== CONFIGURATION ====================

// Minimum efficient stint ratio (configurable from defaultForm.js)
// Ratio below which a stint is considered a "splash" (inefficient refuel)
// Default: 0.61 (25s tire change / 41.1s full refuel time)
const MIN_EFFICIENT_STINT_RATIO = (() => {
  // Try to get from config, fallback to default
  if (typeof defaultForm !== 'undefined' && defaultForm.splashThresholdRatio !== undefined) {
    return safeNumber(defaultForm.splashThresholdRatio) || 0.61;
  }
  return 0.61;
})();

// ==================== STINT CAPACITY CALCULATOR ====================

const calculateStintCapacities = (tankCapacity, reserveFuel, stdFuelPerLap, fsFuelPerLap, efsFuelPerLap) => {
  const usableFuel = Math.max(0, tankCapacity - reserveFuel);
  // Prevent division by zero - ensure minimum values
  const safeStdFuel = Math.max(0.01, stdFuelPerLap);
  const safeFsFuel = Math.max(0.01, fsFuelPerLap);
  const safeEfsFuel = Math.max(0.01, efsFuelPerLap);
  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategy.js:18',message:'calculateStintCapacities',data:{tankCapacity,reserveFuel,usableFuel,stdFuelPerLap,safeStdFuel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    console.log('[DEBUG] calculateStintCapacities', {tankCapacity, reserveFuel, usableFuel, stdFuelPerLap, safeStdFuel});
  } catch(e) { console.error('[DEBUG] Log error:', e); }
  // #endregion
  return {
    std: Math.max(1, Math.floor(usableFuel / safeStdFuel)),
    fs: Math.max(1, Math.floor(usableFuel / safeFsFuel)),
    efs: Math.max(1, Math.floor(usableFuel / safeEfsFuel)),
  };
};

// ==================== RACE SIMULATION ====================

/**
 * Simulate a race with given stint modes
 * Returns detailed stint breakdown and race statistics
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

  // Main simulation loop
  while (!raceEnded) {
    const currentMode = stintModes[Math.min(stintIndex, stintModes.length - 1)];
    const { lapTime, fuelPerLap } = getModeParams(currentMode);
    const fuelNeeded = fuelPerLap + reserveFuel;

    // Check if pit stop needed
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
        fuelAtStart: stintStartFuel,
        mode: currentMode,
        fuelPerLap,
        lapTime,
      });

      // Pit stop (assume full tank for initial simulation)
      const fuelToAdd = tankCapacity - fuelInTank;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategy.js:98',message:'division by tankCapacity',data:{tankCapacity,fuelToAdd,willDivideByZero:tankCapacity===0||isNaN(tankCapacity)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
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

    // Complete a lap
    const lapStartTime = currentTime;
    currentTime += lapTime;
    totalLapsCompleted++;
    stintLaps++;
    fuelInTank -= fuelPerLap;

    // Check if race time expired during this lap (white flag)
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
      fuelAtStart: stintStartFuel,
      mode: currentMode,
      fuelPerLap,
      lapTime,
    });
  }

  // ========================================
  // POST-PROCESSING: Splash optimization with iterative solver
  // ========================================
  
  let totalPitTime = 0;
  const pitStops = stints.length - 1;
  
  // Calculate pit times for all NON-FINAL pit stops (always full tank)
  for (let i = 0; i < pitStops - 1; i++) {
    const fuelToAdd = tankCapacity - stints[i].fuelRemaining;
    const fuelingTime = (fuelToAdd / tankCapacity) * fullTankRefuelTime;
    const pitTime = pitLaneDelta + fuelingTime;
    stints[i].pitTime = pitTime;
    stints[i].fuelToAdd = fuelToAdd;
    totalPitTime += pitTime;
  }
  
  // Calculate time at end of second-to-last stint (before final pit)
  let timeBeforeFinalPit = 0;
  for (let i = 0; i < stints.length - 1; i++) {
    timeBeforeFinalPit += stints[i].duration;
    if (i < pitStops - 1) {
      timeBeforeFinalPit += stints[i].pitTime;
    }
  }
  
  // ITERATIVE SOLVER for final pit + final stint
  if (pitStops > 0) {
    const lastPitIndex = pitStops - 1;
    const fuelAfterPenultimateStint = stints[lastPitIndex].fuelRemaining;
    const finalStint = stints[stints.length - 1];
    const timeRemaining = raceDurationSeconds - timeBeforeFinalPit;
    
    // Start with full tank assumption, iterate until convergence
    let fuelToAdd = tankCapacity - fuelAfterPenultimateStint;
    let iterations = 0;
    const maxIterations = 10;
    
    while (iterations < maxIterations) {
      iterations++;
      
      const fuelingTime = (fuelToAdd / tankCapacity) * fullTankRefuelTime;
      const pitTime = pitLaneDelta + fuelingTime;
      const drivingTimeAvailable = timeRemaining - pitTime;
      const fuelAtStart = fuelAfterPenultimateStint + fuelToAdd;
      const maxLapsFromTime = Math.floor(drivingTimeAvailable / finalStint.lapTime);
      const maxLapsFromFuel = Math.floor((fuelAtStart - reserveFuel) / finalStint.fuelPerLap);
      const completeLaps = Math.min(maxLapsFromTime, maxLapsFromFuel);
      const totalFinalLaps = completeLaps + 1; // +1 for white flag lap
      
      const fuelNeeded = (totalFinalLaps * finalStint.fuelPerLap) + reserveFuel;
      const newFuelToAdd = Math.max(0, fuelNeeded - fuelAfterPenultimateStint);
      
      // Check for convergence
      if (Math.abs(newFuelToAdd - fuelToAdd) < 0.01) {
        fuelToAdd = newFuelToAdd;
        break;
      }
      
      fuelToAdd = newFuelToAdd;
    }
    
    // Apply the converged solution
    const fuelingTime = (fuelToAdd / tankCapacity) * fullTankRefuelTime;
    const pitTime = pitLaneDelta + fuelingTime;
    const drivingTimeAvailable = timeRemaining - pitTime;
    const fuelAtStart = fuelAfterPenultimateStint + fuelToAdd;
    const maxLapsFromTime = Math.floor(drivingTimeAvailable / finalStint.lapTime);
    const maxLapsFromFuel = Math.floor((fuelAtStart - reserveFuel) / finalStint.fuelPerLap);
    const completeLaps = Math.min(maxLapsFromTime, maxLapsFromFuel);
    
    // Update penultimate stint's pit info
    stints[lastPitIndex].pitTime = pitTime;
    stints[lastPitIndex].fuelToAdd = fuelToAdd;
    totalPitTime += pitTime;
    
    // Update final stint
    finalStint.fuelAtStart = fuelAtStart;
    finalStint.laps = completeLaps + 1;
    finalStint.startLap = stints[lastPitIndex].endLap + 1;
    finalStint.endLap = finalStint.startLap + finalStint.laps - 1;
    finalStint.duration = finalStint.laps * finalStint.lapTime;
    finalStint.fuelUsed = finalStint.laps * finalStint.fuelPerLap;
    finalStint.fuelRemaining = fuelAtStart - finalStint.fuelUsed;
    finalStint.isSplash = fuelToAdd < (tankCapacity - fuelAfterPenultimateStint) * 0.9;
    finalStint.splashFuel = fuelToAdd;
    
    // Calculate fractional laps
    const timeAfterCompleteLaps = timeBeforeFinalPit + pitTime + (completeLaps * finalStint.lapTime);
    const timeIntoWhiteFlagLap = raceDurationSeconds - timeAfterCompleteLaps;
    const fractionalPartOfLap = timeIntoWhiteFlagLap / finalStint.lapTime;
    const lapsBeforeFinalStint = stints.slice(0, -1).reduce((sum, s) => sum + s.laps, 0);
    
    fractionalLaps = lapsBeforeFinalStint + completeLaps + fractionalPartOfLap;
  }

  const actualModes = stints.map(s => s.mode);
  const totalLaps = stints.reduce((sum, s) => sum + s.laps, 0);
  const correctedTotalFuelUsed = formationLapFuel + stints.reduce((sum, s) => sum + s.fuelUsed, 0);

  return {
    totalLaps,
    fractionalLaps,
    completeLapsAtWhiteFlag: Math.floor(fractionalLaps),
    pitStops: stints.length - 1,
    stintCount: stints.length,
    stints,
    totalPitTime,
    totalFuelUsed: correctedTotalFuelUsed,
    stintModes: actualModes,
    stdCount: stints.filter(s => s.mode === 'std').length,
    fsCount: stints.filter(s => s.mode === 'fs').length,
    efsCount: stints.filter(s => s.mode === 'efs').length,
    stdLaps: stints.filter(s => s.mode === 'std').reduce((sum, s) => sum + s.laps, 0),
    fsLaps: stints.filter(s => s.mode === 'fs').reduce((sum, s) => sum + s.laps, 0),
    efsLaps: stints.filter(s => s.mode === 'efs').reduce((sum, s) => sum + s.laps, 0),
    stdFuel: stints.filter(s => s.mode === 'std').reduce((sum, s) => sum + s.fuelUsed, 0),
    fsFuel: stints.filter(s => s.mode === 'fs').reduce((sum, s) => sum + s.fuelUsed, 0),
    efsFuel: stints.filter(s => s.mode === 'efs').reduce((sum, s) => sum + s.fuelUsed, 0),
    maxLapsPerStint: Math.max(...stints.map(s => s.laps), 0),
  };
};

// ==================== OPTIMAL STRATEGY FINDER ====================

/**
 * Find optimal fuel strategies using Bookend Optimization
 * Returns Standard + top 10 fuel-saving alternatives
 */
const findOptimalStrategies = ({
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
}) => {
  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategy.js:310',message:'before calculateStintCapacities',data:{tankCapacity,reserveFuel,stdFuelPerLap,fsFuelPerLap,efsFuelPerLap},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    console.log('[DEBUG] before calculateStintCapacities', {tankCapacity, reserveFuel, stdFuelPerLap, fsFuelPerLap, efsFuelPerLap});
  } catch(e) { console.error('[DEBUG] Log error:', e); }
  // #endregion
  const capacities = calculateStintCapacities(
    tankCapacity, reserveFuel, stdFuelPerLap, fsFuelPerLap, efsFuelPerLap
  );
  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategy.js:318',message:'after calculateStintCapacities',data:{capacities,capacitiesStd:capacities.std,capacitiesFs:capacities.fs,capacitiesEfs:capacities.efs},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    console.log('[DEBUG] after calculateStintCapacities', {capacities, capacitiesStd: capacities.std, capacitiesFs: capacities.fs, capacitiesEfs: capacities.efs});
  } catch(e) { console.error('[DEBUG] Log error:', e); }
  // #endregion

  const baseParams = {
    raceDurationSeconds, tankCapacity, reserveFuel, formationLapFuel,
    pitLaneDelta, fullTankRefuelTime, stdLapTime, stdFuelPerLap,
    fsLapTime, fsFuelPerLap, efsLapTime, efsFuelPerLap,
  };

  const strategies = [];

  // ========================================
  // 1. STANDARD BASELINE
  // ========================================
  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategy.js:315',message:'calculating estimatedStints',data:{raceDurationSeconds,stdLapTime,capacitiesStd:capacities.std,denominator:stdLapTime*capacities.std,estimatedStints:Math.ceil(raceDurationSeconds/(stdLapTime*capacities.std))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    console.log('[DEBUG] calculating estimatedStints', {raceDurationSeconds, stdLapTime, capacitiesStd: capacities.std, denominator: stdLapTime * capacities.std});
  } catch(e) { console.error('[DEBUG] Log error:', e); }
  // #endregion
  // Ensure capacities.std is valid before using it
  const safeCapacitiesStd = Math.max(1, isFinite(capacities.std) ? capacities.std : 1);
  const safeStdLapTime = Math.max(0.1, isFinite(stdLapTime) ? stdLapTime : 120);
  const denominator = safeStdLapTime * safeCapacitiesStd;
  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategy.js:335',message:'denominator calculation',data:{capacitiesStd:capacities.std,safeCapacitiesStd,stdLapTime,safeStdLapTime,denominator,isFinite:isFinite(denominator)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    console.log('[DEBUG] denominator calculation', {capacitiesStd: capacities.std, safeCapacitiesStd, stdLapTime, safeStdLapTime, denominator, isFinite: isFinite(denominator)});
  } catch(e) { console.error('[DEBUG] Log error:', e); }
  // #endregion
  let estimatedStints = 10; // Safe default
  if (denominator > 0 && isFinite(denominator) && isFinite(raceDurationSeconds) && raceDurationSeconds > 0) {
    const rawEstimate = raceDurationSeconds / denominator;
    if (isFinite(rawEstimate) && rawEstimate > 0) {
      estimatedStints = Math.ceil(rawEstimate);
      // Cap at reasonable maximum to prevent array length issues (max 1000 stints)
      estimatedStints = Math.min(estimatedStints, 1000);
    }
  }
  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategy.js:332',message:'estimatedStints result',data:{estimatedStints,isFinite:isFinite(estimatedStints),isNaN:isNaN(estimatedStints),denominator,raceDurationSeconds},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    console.log('[DEBUG] estimatedStints result', {estimatedStints, isFinite: isFinite(estimatedStints), isNaN: isNaN(estimatedStints), denominator, raceDurationSeconds});
  } catch(e) { console.error('[DEBUG] Log error:', e); }
  // #endregion
  // Final safety check - ensure it's a valid positive integer
  const safeEstimatedStints = Math.max(1, Math.min(1000, Math.floor(Math.abs(estimatedStints))));
  let arrayLength = Math.max(10, Math.min(safeEstimatedStints + 2, 1002));
  // Ultimate safety check - ensure arrayLength is a valid positive integer
  if (!isFinite(arrayLength) || arrayLength <= 0 || arrayLength > 1002) {
    arrayLength = 10; // Safe fallback
  }
  arrayLength = Math.floor(Math.abs(arrayLength)); // Ensure it's an integer
  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategy.js:342',message:'creating standardModes array',data:{safeEstimatedStints,arrayLength,isFinite:isFinite(arrayLength),isValid:isFinite(arrayLength)&&arrayLength>0&&arrayLength<=1002},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    console.log('[DEBUG] creating standardModes array', {safeEstimatedStints, arrayLength, isFinite: isFinite(arrayLength), isValid: isFinite(arrayLength) && arrayLength > 0 && arrayLength <= 1002});
  } catch(e) { console.error('[DEBUG] Log error:', e); }
  // #endregion
  // Final validation right before Array() call
  if (!isFinite(arrayLength) || arrayLength <= 0 || arrayLength > 1002) {
    console.error('[DEBUG] Invalid arrayLength detected, using fallback', {arrayLength});
    arrayLength = 10;
  }
  const standardModes = Array(arrayLength).fill('std');
  const standardResult = simulateRace({ ...baseParams, stintModes: standardModes });
  
  const standardFinalStint = standardResult.stints[standardResult.stints.length - 1];
  const standardFinalStintRatio = standardFinalStint.laps / capacities.std;
  
  standardResult.strategyName = 'Standard';
  standardResult.strategyType = 'standard';
  standardResult.variant = null;
  standardResult.hasSplash = standardFinalStintRatio < MIN_EFFICIENT_STINT_RATIO;
  standardResult.finalStintRatio = standardFinalStintRatio;
  standardResult.fractionalLapsGained = 0;
  standardResult.netTimeDelta = 0;
  standardResult.pitTimeSaved = 0;
  standardResult.lapTimeCost = 0;
  strategies.push(standardResult);

  const standardPitStops = standardResult.pitStops;
  const standardHasSplash = standardResult.hasSplash;

  // ========================================
  // 2. HELPER: Evaluate strategy metrics
  // ========================================
  const evaluateStrategy = (result, nStd, nFs, nEfs, variant) => {
    const finalStint = result.stints[result.stints.length - 1];
    const maxLapsForMode = finalStint.mode === 'efs' ? capacities.efs : 
                          finalStint.mode === 'fs' ? capacities.fs : capacities.std;
    const finalStintRatio = finalStint.laps / maxLapsForMode;
    
    result.hasSplash = finalStintRatio < MIN_EFFICIENT_STINT_RATIO;
    result.finalStintRatio = finalStintRatio;
    
    // Pit time saved
    const pitTimeSaved = standardResult.totalPitTime - result.totalPitTime;
    
    // Lap time cost (using fractional laps for final stint)
    const lapsBeforeFinal = result.stints.slice(0, -1).reduce((sum, s) => sum + s.laps, 0);
    const finalStintFractionalLaps = result.fractionalLaps - lapsBeforeFinal;
    
    let lapTimeCost = 0;
    for (let i = 0; i < result.stints.length; i++) {
      const stint = result.stints[i];
      const isLast = i === result.stints.length - 1;
      const stintLaps = isLast ? finalStintFractionalLaps : stint.laps;
      
      if (stint.mode === 'fs') {
        lapTimeCost += stintLaps * (fsLapTime - stdLapTime);
      } else if (stint.mode === 'efs') {
        lapTimeCost += stintLaps * (efsLapTime - stdLapTime);
      }
    }
    
    // Net delta: pitTimeSaved - lapTimeCost (positive = ahead)
    const netTimeDelta = pitTimeSaved - lapTimeCost;
    const fractionalLapsGained = result.fractionalLaps - standardResult.fractionalLaps;

    // Build descriptive name
    const countParts = [];
    if (nStd > 0) countParts.push(`${nStd}×STD`);
    if (nFs > 0) countParts.push(`${nFs}×FS`);
    if (nEfs > 0) countParts.push(`${nEfs}×EFS`);
    const countStr = countParts.join(', ');
    const variantStr = variant ? ` (${variant})` : '';
    
    result.strategyName = `${result.pitStops} pit${result.pitStops !== 1 ? 's' : ''}: ${countStr}${variantStr}`;
    result.strategyType = nEfs > 0 ? 'efs' : (nFs > 0 ? 'fs' : 'standard');
    result.variant = variant;
    result.fractionalLapsGained = fractionalLapsGained;
    result.netTimeDelta = netTimeDelta;
    result.pitTimeSaved = pitTimeSaved;
    result.lapTimeCost = lapTimeCost;
    result.pitsSaved = standardPitStops - result.pitStops;
    
    return result;
  };

  // ========================================
  // 3. BOOKEND OPTIMIZATION
  // ========================================
  const maxPitsToTry = Math.max(0, standardPitStops - 2);
  
  for (let targetPits = standardPitStops - 1; targetPits >= maxPitsToTry; targetPits--) {
    const totalStints = targetPits + 1;
    
    for (let nEfs = 0; nEfs <= totalStints; nEfs++) {
      for (let nFs = 0; nFs <= totalStints - nEfs; nFs++) {
        const nStd = totalStints - nEfs - nFs;
        
        // Skip all-STD (that's the standard strategy)
        if (nEfs === 0 && nFs === 0) continue;
        
        // Check if mixed (needs both variants)
        const isMixed = (nStd > 0 && (nFs > 0 || nEfs > 0)) || (nFs > 0 && nEfs > 0);
        
        // Variant A: Save Late (STD → FS → EFS)
        // Ensure array lengths are valid (finite, positive integers, capped at reasonable max)
        const safeNStd = Math.max(0, Math.min(1000, Math.floor(Math.abs(isFinite(nStd) ? nStd : 0))));
        const safeNFs = Math.max(0, Math.min(1000, Math.floor(Math.abs(isFinite(nFs) ? nFs : 0))));
        const safeNEfs = Math.max(0, Math.min(1000, Math.floor(Math.abs(isFinite(nEfs) ? nEfs : 0))));
        const modesSaveLate = [
          ...Array(safeNStd).fill('std'),
          ...Array(safeNFs).fill('fs'),
          ...Array(safeNEfs).fill('efs')
        ];
        
        const saveLateResult = simulateRace({ ...baseParams, stintModes: modesSaveLate });
        
        if (saveLateResult.pitStops === targetPits) {
          strategies.push(evaluateStrategy(saveLateResult, nStd, nFs, nEfs, isMixed ? 'Save Late' : null));
        }
        
        // Variant B: Save Early (EFS → FS → STD)
        if (isMixed) {
          const modesSaveEarly = [
            ...Array(safeNEfs).fill('efs'),
            ...Array(safeNFs).fill('fs'),
            ...Array(safeNStd).fill('std')
          ];
          
          const saveEarlyResult = simulateRace({ ...baseParams, stintModes: modesSaveEarly });
          
          if (saveEarlyResult.pitStops === targetPits) {
            strategies.push(evaluateStrategy(saveEarlyResult, nStd, nFs, nEfs, 'Save Early'));
          }
        }
      }
    }
  }

  // ========================================
  // 4. SORT & RETURN
  // ========================================
  const standardStrategy = strategies.shift();
  
  // Sort: prioritize no-splash if standard has splash, then by netTimeDelta
  strategies.sort((a, b) => {
    if (standardHasSplash) {
      if (!a.hasSplash && b.hasSplash) return -1;
      if (a.hasSplash && !b.hasSplash) return 1;
    }
    return b.netTimeDelta - a.netTimeDelta;
  });

  // Return standard + top 10 alternatives
  return {
    strategies: [standardStrategy, ...strategies.slice(0, 10)],
    capacities,
    standardPitStops,
    tankCapacity,
    reserveFuel,
  };
};

// ==================== MAIN COMPUTE FUNCTION ====================

/**
 * Main entry point for strategy calculation
 * @param {Object} config - Race configuration (form values)
 * @param {string} strategyMode - 'standard' or 'fuel-saving'
 * @returns {Object} Computed strategy plan
 */
const computePlan = (config, strategyMode = 'standard') => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategy.js:470',message:'computePlan entry',data:{tankCapacity:config.tankCapacity,tankCapacityType:typeof config.tankCapacity,tankCapacityNum:safeNumber(config.tankCapacity)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const errors = [];

  // Basic validation
  if (!config.raceDurationMinutes || config.raceDurationMinutes <= 0) {
    errors.push('Race duration must be greater than zero.');
  }
  const tankCapacitySafe = safeNumber(config.tankCapacity);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategy.js:477',message:'tankCapacity validation',data:{tankCapacity:config.tankCapacity,tankCapacitySafe,isEmpty:config.tankCapacity==='',isZeroOrLess:tankCapacitySafe<=0,willAddError:!config.tankCapacity||tankCapacitySafe<=0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (!config.tankCapacity || tankCapacitySafe <= 0) {
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

  // Parse and convert inputs
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
  const raceDurationSeconds = (config.raceDurationMinutes || 0) * 60;

  // Validate fuel-saving parameters
  if (!fsLapTime || !fsFuelPerLap || !efsLapTime || !efsFuelPerLap) {
    return { errors: ['Invalid fuel-saving parameters'] };
  }

  // Call findOptimalStrategies with parsed values - wrap in try-catch to prevent crashes
  let result;
  try {
    result = findOptimalStrategies({
      raceDurationSeconds,
      tankCapacity,
      reserveFuel,
      formationLapFuel,
      pitLaneDelta,
      fullTankRefuelTime: FULL_TANK_FUELING_TIME,
      stdLapTime,
      stdFuelPerLap,
      fsLapTime,
      fsFuelPerLap,
      efsLapTime,
      efsFuelPerLap,
    });
  } catch (error) {
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/294e85c6-299a-4f71-bd1a-c270e27a767a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategy.js:525',message:'findOptimalStrategies ERROR',data:{errorMessage:error.message,errorStack:error.stack,tankCapacity,stdFuelPerLap},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      console.error('[DEBUG] findOptimalStrategies ERROR', error, {tankCapacity, stdFuelPerLap});
    } catch(e) { console.error('[DEBUG] Log error:', e); }
    // #endregion
    return { errors: [`Calculation error: ${error.message}. Please check your input values.`] };
  }

  if (!result || !result.strategies || result.strategies.length === 0) {
    return { errors: ['No viable strategy found'] };
  }

  // Select strategy based on mode
  let selectedStrategy;
  if (strategyMode === 'fuel-saving') {
    // Use best netTimeDelta strategy (strategies[1] after sorting)
    selectedStrategy = result.strategies[1] || result.strategies[0];
  } else {
    // Standard mode - use first strategy (all STD)
    selectedStrategy = result.strategies[0];
  }

  // Transform stints to stintPlan format with mode mapping for compatibility
  const reserveLiters = safeNumber(config.fuelReserveLiters) || 0;
  const formationLapFuelValue = safeNumber(config.formationLapFuel) || 0;
  
  const stintPlan = selectedStrategy.stints.map((stint, idx) => {
    const isFirstStint = idx === 0;
    
    // Map internal modes ('std', 'fs', 'efs') to component modes ('standard', 'fuel-saving', 'extra-fuel-saving')
    const modeMap = {
      'std': 'standard',
      'fs': 'fuel-saving',
      'efs': 'extra-fuel-saving',
    };
    const stintMode = modeMap[stint.mode] || 'standard';

    // Use recalculated fuelAtStart from splash-and-dash logic
    const fuelAtStart = stint.fuelAtStart !== undefined 
      ? stint.fuelAtStart 
      : (isFirstStint ? tankCapacity - formationLapFuelValue : tankCapacity);

    const fuelTarget = stint.laps > 0 
      ? (fuelAtStart - reserveFuel) / stint.laps 
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
    raceDurationSeconds: raceDurationSeconds,
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
    pitLaneDelta: pitLaneDelta,
    fuelPerLap: selectedStrategy.fuelPerLap || stdFuelPerLap,
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
    lapTimeLoss: selectedStrategy.lapTimeCost || 0,  // Map lapTimeCost to lapTimeLoss for compatibility
    pitTimeSaved: selectedStrategy.pitTimeSaved || 0,
    netTimeDelta: selectedStrategy.netTimeDelta || 0,
    fractionalLapsGained: selectedStrategy.fractionalLapsGained || 0,
    hasSplash: selectedStrategy.hasSplash || false,
    finalStintRatio: selectedStrategy.finalStintRatio || 0,
    variant: selectedStrategy.variant || null,
    capacities: result.capacities,
    allStrategies: result.strategies,
  };
};
