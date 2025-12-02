// ==================== STRATEGY CALCULATION LOGIC ====================
// All strategy calculation functions in one file

// ==================== STANDARD STRATEGY ====================

const simulateRace = ({
  raceDurationSeconds,
  lapTimeSeconds,
  fuelPerLap,
  tankCapacity,
  reserveFuel,
  formationLapFuel,
  pitLaneDelta,
  stationaryService,
}) => {
  const usableFuel = tankCapacity - reserveFuel;
  const maxLapsPerStint = Math.floor(usableFuel / fuelPerLap);

  if (maxLapsPerStint <= 0) {
    return { error: 'Cannot complete even 1 lap with current fuel settings' };
  }

  const stints = [];
  let currentTime = 0;
  let totalLapsCompleted = 0;
  let fuelInTank = tankCapacity - formationLapFuel;
  let currentStintLaps = 0;
  let stintNumber = 1;
  let stintStartTime = 0;
  let stintStartLap = 1;
  let stintStartFuel = fuelInTank;
  let fractionalLaps = 0;
  let foundFractional = false;

  while (!foundFractional) {
    const fuelNeededForNextLap = fuelPerLap + reserveFuel;

    if (fuelInTank < fuelNeededForNextLap && currentStintLaps > 0) {
      stints.push({
        id: stintNumber,
        laps: currentStintLaps,
        startLap: stintStartLap,
        endLap: stintStartLap + currentStintLaps - 1,
        duration: currentTime - stintStartTime,
        fuelUsed: stintStartFuel - fuelInTank,
        fuelRemaining: fuelInTank,
        mode: 'standard',
      });

      const fuelToAdd = tankCapacity - fuelInTank;
      const fuelingTime = (fuelToAdd / tankCapacity) * FULL_TANK_FUELING_TIME;
      const pitStopTime = pitLaneDelta + Math.max(fuelingTime, stationaryService);
      currentTime += pitStopTime;

      if (currentTime >= raceDurationSeconds) {
        fractionalLaps = totalLapsCompleted;
        foundFractional = true;
        break;
      }

      fuelInTank = tankCapacity;
      stintNumber++;
      stintStartTime = currentTime;
      stintStartLap = totalLapsCompleted + 1;
      stintStartFuel = fuelInTank;
      currentStintLaps = 0;
    }

    const lapStartTime = currentTime;
    currentTime += lapTimeSeconds;
    totalLapsCompleted++;
    currentStintLaps++;
    fuelInTank -= fuelPerLap;

    if (currentTime >= raceDurationSeconds) {
      const timeIntoLap = raceDurationSeconds - lapStartTime;
      fractionalLaps = (totalLapsCompleted - 1) + timeIntoLap / lapTimeSeconds;
      foundFractional = true;
    }
  }

  if (currentStintLaps > 0) {
    stints.push({
      id: stintNumber,
      laps: currentStintLaps,
      startLap: stintStartLap,
      endLap: stintStartLap + currentStintLaps - 1,
      duration: currentTime - stintStartTime,
      fuelUsed: stintStartFuel - fuelInTank,
      fuelRemaining: fuelInTank,
      mode: 'standard',
    });
  }

  const completeLapsAtWhiteFlag = Math.floor(fractionalLaps);
  const whiteFlagLapCount = completeLapsAtWhiteFlag + 1;

  const pitStops = stints.length - 1;
  let totalPitTime = 0;
  for (let i = 0; i < pitStops; i++) {
    const fuelToAdd = tankCapacity - stints[i].fuelRemaining;
    const fuelingTime = (fuelToAdd / tankCapacity) * FULL_TANK_FUELING_TIME;
    totalPitTime += pitLaneDelta + Math.max(fuelingTime, stationaryService);
  }

  return {
    totalLaps: whiteFlagLapCount,
    fractionalLaps,
    completeLapsAtWhiteFlag,
    stintCount: stints.length,
    pitStops,
    stints,
    totalPitTime,
    maxLapsPerStint,
    lapTimeSeconds,
    fuelPerLap,
  };
};

const calculateStandardStrategy = (config) => {
  const lapTimeSeconds = parseLapTime(config.averageLapTime);
  const fuelPerLap = safeNumber(config.fuelPerLap);

  if (!lapTimeSeconds || !fuelPerLap) {
    return { error: 'Invalid lap time or fuel consumption' };
  }

  const result = simulateRace({
    raceDurationSeconds: config.raceDurationMinutes * 60,
    lapTimeSeconds,
    fuelPerLap,
    tankCapacity: safeNumber(config.tankCapacity) || 106,
    reserveFuel: safeNumber(config.fuelReserveLiters) || 0,
    formationLapFuel: safeNumber(config.formationLapFuel) || 0,
    pitLaneDelta: safeNumber(config.pitLaneDeltaSeconds) || 27,
    stationaryService: safeNumber(config.stationaryServiceSeconds) || 0,
  });

  if (result.error) return result;

  result.stints = result.stints.map((stint) => ({
    ...stint,
    mode: 'standard',
    fuelPerLapTarget: fuelPerLap,
  }));

  return { ...result, strategyName: 'Standard', strategyMode: 'standard' };
};

// ==================== MIXED STRATEGY (FS/EFS) ====================

const simulateMixedStrategy = ({
  raceDurationSeconds,
  tankCapacity,
  reserveFuel,
  formationLapFuel,
  pitLaneDelta,
  stationaryService,
  fuelSavingLapTime,
  fuelSavingFuelPerLap,
  extraFuelSavingLapTime,
  extraFuelSavingFuelPerLap,
  stintModes, // Array of 'fs' or 'efs' for each stint
}) => {
  const stints = [];
  let currentTime = 0;
  let totalLapsCompleted = 0;
  let fuelInTank = tankCapacity - formationLapFuel;
  let fractionalLaps = -1;
  let raceEnded = false;

  let stintIndex = 0;
  let stintNumber = 1;
  let stintStartTime = 0;
  let stintStartLap = 1;
  let stintStartFuel = fuelInTank;
  let stintLaps = 0;

  while (!raceEnded) {
    const currentMode = stintModes[Math.min(stintIndex, stintModes.length - 1)];
    const lapTime = currentMode === 'efs' ? extraFuelSavingLapTime : fuelSavingLapTime;
    const fuelPerLap = currentMode === 'efs' ? extraFuelSavingFuelPerLap : fuelSavingFuelPerLap;

    const fuelNeeded = fuelPerLap + reserveFuel;

    if (fuelInTank < fuelNeeded && stintLaps > 0) {
      const stintMode = stintModes[Math.min(stintIndex, stintModes.length - 1)];
      stints.push({
        id: stintNumber,
        laps: stintLaps,
        startLap: stintStartLap,
        endLap: stintStartLap + stintLaps - 1,
        duration: currentTime - stintStartTime,
        fuelUsed: stintStartFuel - fuelInTank,
        fuelRemaining: fuelInTank,
        mode: stintMode === 'efs' ? 'extra-fuel-saving' : 'fuel-saving',
        fuelPerLapTarget: stintMode === 'efs' ? extraFuelSavingFuelPerLap : fuelSavingFuelPerLap,
        lapTime: stintMode === 'efs' ? extraFuelSavingLapTime : fuelSavingLapTime,
      });

      const fuelToAdd = tankCapacity - fuelInTank;
      const fuelingTime = (fuelToAdd / tankCapacity) * FULL_TANK_FUELING_TIME;
      const pitTime = pitLaneDelta + Math.max(fuelingTime, stationaryService);

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

    if (lapStartTime < raceDurationSeconds && currentTime >= raceDurationSeconds) {
      const timeIntoLap = raceDurationSeconds - lapStartTime;
      fractionalLaps = (totalLapsCompleted - 1) + timeIntoLap / lapTime;
      raceEnded = true;
    }
  }

  if (stintLaps > 0) {
    const stintMode = stintModes[Math.min(stintIndex, stintModes.length - 1)];
    stints.push({
      id: stintNumber,
      laps: stintLaps,
      startLap: stintStartLap,
      endLap: stintStartLap + stintLaps - 1,
      duration: currentTime - stintStartTime,
      fuelUsed: stintStartFuel - fuelInTank,
      fuelRemaining: fuelInTank,
      mode: stintMode === 'efs' ? 'extra-fuel-saving' : 'fuel-saving',
      fuelPerLapTarget: stintMode === 'efs' ? extraFuelSavingFuelPerLap : fuelSavingFuelPerLap,
      lapTime: stintMode === 'efs' ? extraFuelSavingLapTime : fuelSavingLapTime,
    });
  }

  if (fractionalLaps < 0) {
    fractionalLaps = totalLapsCompleted;
  }

  const completeLapsAtWhiteFlag = Math.floor(fractionalLaps);
  const whiteFlagLapCount = completeLapsAtWhiteFlag + 1;

  let totalPitTime = 0;
  for (let i = 0; i < stints.length - 1; i++) {
    const fuelToAdd = tankCapacity - stints[i].fuelRemaining;
    const fuelingTime = (fuelToAdd / tankCapacity) * FULL_TANK_FUELING_TIME;
    totalPitTime += pitLaneDelta + Math.max(fuelingTime, stationaryService);
  }

  return {
    totalLaps: whiteFlagLapCount,
    fractionalLaps,
    completeLapsAtWhiteFlag,
    stintCount: stints.length,
    pitStops: stints.length - 1,
    stints,
    totalPitTime,
    stintModes: stintModes.slice(0, stints.length),
  };
};

// ==================== OPTIMAL STRATEGY FINDER ====================

const findOptimalStrategy = (config) => {
  const fuelSavingLapTime = parseLapTime(config.fuelSavingLapTime);
  const fuelSavingFuelPerLap = safeNumber(config.fuelSavingFuelPerLap);
  const extraFuelSavingLapTime = parseLapTime(config.extraFuelSavingLapTime);
  const extraFuelSavingFuelPerLap = safeNumber(config.extraFuelSavingFuelPerLap);
  const tankCapacity = safeNumber(config.tankCapacity) || 106;
  const reserveFuel = safeNumber(config.fuelReserveLiters) || 0;
  const formationLapFuel = safeNumber(config.formationLapFuel) || 0;
  const pitLaneDelta = safeNumber(config.pitLaneDeltaSeconds) || 27;
  const stationaryService = safeNumber(config.stationaryServiceSeconds) || 0;
  const raceDurationSeconds = config.raceDurationMinutes * 60;

  if (!fuelSavingLapTime || !fuelSavingFuelPerLap || !extraFuelSavingLapTime || !extraFuelSavingFuelPerLap) {
    return { error: 'Invalid fuel-saving parameters' };
  }

  const candidates = [];

  const fsMaxLaps = Math.floor((tankCapacity - reserveFuel) / fuelSavingFuelPerLap);
  const estimatedLaps = raceDurationSeconds / fuelSavingLapTime;
  const maxStints = Math.min(Math.ceil(estimatedLaps / fsMaxLaps) + 2, 30);

  for (let numStints = 2; numStints <= maxStints; numStints++) {
    // All FS
    const allFs = Array(numStints).fill('fs');
    const allFsResult = simulateMixedStrategy({
      raceDurationSeconds,
      tankCapacity,
      reserveFuel,
      formationLapFuel,
      pitLaneDelta,
      stationaryService,
      fuelSavingLapTime,
      fuelSavingFuelPerLap,
      extraFuelSavingLapTime,
      extraFuelSavingFuelPerLap,
      stintModes: allFs,
    });

    if (allFsResult.fractionalLaps > 0) {
      allFsResult.candidateName = `${allFsResult.pitStops} pit${allFsResult.pitStops !== 1 ? 's' : ''}: ${allFsResult.stintModes.map(m => m.toUpperCase()).join('→')}`;
      candidates.push(allFsResult);
    }

    // Try switching last N stints to EFS
    for (let efsCount = 1; efsCount <= numStints; efsCount++) {
      const modes = Array(numStints).fill('fs');
      for (let i = numStints - efsCount; i < numStints; i++) {
        modes[i] = 'efs';
      }

      const result = simulateMixedStrategy({
        raceDurationSeconds,
        tankCapacity,
        reserveFuel,
        formationLapFuel,
        pitLaneDelta,
        stationaryService,
        fuelSavingLapTime,
        fuelSavingFuelPerLap,
        extraFuelSavingLapTime,
        extraFuelSavingFuelPerLap,
        stintModes: modes,
      });

      if (result.fractionalLaps > 0) {
        result.candidateName = `${result.pitStops} pit${result.pitStops !== 1 ? 's' : ''}: ${result.stintModes.map(m => m.toUpperCase()).join('→')}`;

        const isDuplicate = candidates.some(c =>
          c.candidateName === result.candidateName &&
          Math.abs(c.fractionalLaps - result.fractionalLaps) < 0.0001
        );

        if (!isDuplicate) {
          candidates.push(result);
        }
      }
    }
  }

  if (candidates.length === 0) {
    return { error: 'No viable fuel-saving strategy found' };
  }

  candidates.sort((a, b) => {
    if (Math.abs(a.fractionalLaps - b.fractionalLaps) > 0.001) {
      return b.fractionalLaps - a.fractionalLaps;
    }
    if (a.pitStops !== b.pitStops) {
      return a.pitStops - b.pitStops;
    }
    return a.totalPitTime - b.totalPitTime;
  });

  return {
    ...candidates[0],
    strategyName: 'Fuel-Saving',
    strategyMode: 'fuel-saving',
    allCandidates: candidates,
  };
};

// ==================== COMPUTE PLAN WRAPPER ====================
// Transforms the new API to match the existing component expectations

const computePlan = (form, strategyMode = 'standard') => {
  const errors = [];

  // Basic validation
  if (!form.raceDurationMinutes || form.raceDurationMinutes <= 0) {
    errors.push('Race duration must be greater than zero.');
  }
  if (!form.tankCapacity || safeNumber(form.tankCapacity) <= 0) {
    errors.push('Tank capacity must be greater than zero.');
  }
  if (!form.averageLapTime || parseLapTime(form.averageLapTime) <= 0) {
    errors.push('Provide a valid average lap time.');
  }
  if (!form.fuelPerLap || safeNumber(form.fuelPerLap) <= 0) {
    errors.push('Fuel usage per lap must be greater than zero.');
  }

  if (errors.length) {
    return { errors };
  }

  let result;
  if (strategyMode === 'fuel-saving') {
    result = findOptimalStrategy(form);
  } else {
    result = calculateStandardStrategy(form);
  }

  if (result.error) {
    return { errors: [result.error] };
  }

  // Transform stints to stintPlan format expected by components
  const stintPlan = result.stints.map((stint, idx) => {
    const isFirstStint = idx === 0;
    const isLastStint = idx === result.stints.length - 1;
    const tankCapacity = safeNumber(form.tankCapacity) || 106;
    const reserveLiters = safeNumber(form.fuelReserveLiters) || 0;
    const formationLapFuel = safeNumber(form.formationLapFuel) || 0;
    const pitLaneDelta = safeNumber(form.pitLaneDeltaSeconds) || 27;
    const stationaryService = safeNumber(form.stationaryServiceSeconds) || 0;

    // Calculate fuel at start
    const fuelAtStart = isFirstStint
      ? tankCapacity - formationLapFuel
      : tankCapacity;

    // Calculate fuel target
    const usableFuel = fuelAtStart - reserveLiters;
    const fuelTarget = stint.laps > 0 ? usableFuel / stint.laps : 0;

    // Calculate fuel to add at pit stop
    let fuelToAdd = 0;
    let fuelingTime = 0;
    let perStopLoss = 0;
    if (!isLastStint) {
      fuelToAdd = tankCapacity - stint.fuelRemaining;
      fuelingTime = (fuelToAdd / tankCapacity) * FULL_TANK_FUELING_TIME;
      perStopLoss = pitLaneDelta + Math.max(fuelingTime, stationaryService);
    }

    // Calculate stint duration (from duration field, or estimate from laps)
    const lapTimeSeconds = stint.lapTime || parseLapTime(
      strategyMode === 'fuel-saving' 
        ? (form.fuelSavingLapTime || form.averageLapTime)
        : form.averageLapTime
    );
    const stintDuration = stint.duration || (stint.laps * lapTimeSeconds);

    return {
      id: stint.id,
      laps: stint.laps,
      startLap: stint.startLap,
      endLap: stint.endLap,
      stintDuration: stintDuration,
      fuel: stint.fuelUsed,
      fuelLeft: stint.fuelRemaining,
      fuelTarget: fuelTarget,
      fuelToAdd: fuelToAdd,
      stintMode: stint.mode || (strategyMode === 'fuel-saving' ? 'fuel-saving' : 'standard'),
      strategyFuelPerLap: stint.fuelPerLapTarget || safeNumber(form.fuelPerLap),
      perStopLoss: perStopLoss,
    };
  });

  // Calculate total race time with stops
  const totalRaceTimeWithStops = stintPlan.reduce((sum, stint) => sum + stint.stintDuration, 0) + result.totalPitTime;

  // Calculate decimal laps (use fractionalLaps if available)
  const decimalLaps = result.fractionalLaps || result.totalLaps;

  // Calculate average per stop loss
  const avgPerStopLoss = result.pitStops > 0 ? result.totalPitTime / result.pitStops : 0;

  return {
    errors: [],
    lapSeconds: result.lapTimeSeconds || parseLapTime(
      strategyMode === 'fuel-saving' 
        ? (form.fuelSavingLapTime || form.averageLapTime)
        : form.averageLapTime
    ),
    totalLaps: result.totalLaps,
    decimalLaps: decimalLaps,
    raceDurationSeconds: (form.raceDurationMinutes || 0) * 60,
    maxRaceTimeSeconds: (form.raceDurationMinutes || 0) * 60 + (result.lapTimeSeconds || parseLapTime(form.averageLapTime)),
    totalFuelNeeded: result.totalLaps * (result.fuelPerLap || safeNumber(form.fuelPerLap)),
    totalFuelWithReserve: result.totalLaps * (result.fuelPerLap || safeNumber(form.fuelPerLap)) + 
      (safeNumber(form.fuelReserveLiters) || 0) * result.stintCount,
    lapsPerStint: result.maxLapsPerStint || Math.floor((safeNumber(form.tankCapacity) || 106) / (result.fuelPerLap || safeNumber(form.fuelPerLap))),
    stintCount: result.stintCount,
    pitStops: result.pitStops,
    stintPlan: stintPlan,
    totalPitTime: result.totalPitTime,
    totalRaceTimeWithStops: totalRaceTimeWithStops,
    perStopLoss: avgPerStopLoss,
    pitLaneDelta: safeNumber(form.pitLaneDeltaSeconds) || 27,
    stationaryService: safeNumber(form.stationaryServiceSeconds) || 0,
    fuelPerLap: result.fuelPerLap || safeNumber(form.fuelPerLap),
    strategyMode: strategyMode,
    candidateName: result.candidateName,
    usesExtraFuelSaving: result.stintModes?.some(m => m === 'efs') || false,
  };
};

