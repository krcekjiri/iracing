// ==================== VALIDATION UTILITIES ====================
// Note: roundTo is defined in formatters.js, loaded before this file

// Validation helper: Calculate fuel target and validate
const validateFuelTarget = (availableFuel, laps, reserveFuel, formationLapFuel, isFirstStint, strategyFuelPerLap) => {
  const usableFuel = availableFuel - reserveFuel - (isFirstStint ? formationLapFuel : 0);
  const targetPerLap = laps > 0 ? usableFuel / laps : 0;
  const minAllowed = strategyFuelPerLap * 0.90;
  
  const validation = {
    targetPerLap,
    minAllowed,
    usableFuel,
    isValid: targetPerLap >= minAllowed,
    isAggressive: targetPerLap >= minAllowed && targetPerLap < (strategyFuelPerLap * 0.95),
    shortfallPerLap: Math.max(0, minAllowed - targetPerLap),
    totalShortfall: Math.max(0, (minAllowed - targetPerLap) * laps),
  };
  
  return validation;
};

// Validation helper: Check if fuel is sufficient for stint
const validateFuelSufficiency = (availableFuel, requiredFuel, laps, fuelPerLap, reserveFuel) => {
  const required = (laps * fuelPerLap) + reserveFuel;
  const shortfall = Math.max(0, required - availableFuel);
  const maxLapsPossible = availableFuel > reserveFuel 
    ? Math.floor((availableFuel - reserveFuel) / fuelPerLap)
    : 0;
  
  return {
    required,
    available: availableFuel,
    shortfall,
    isSufficient: availableFuel >= required,
    maxLapsPossible,
  };
};

// Validation helper: Generate error/warning messages
const generateValidationMessages = (fuelValidation, sufficiencyValidation, laps) => {
  const errors = [];
  const warnings = [];
  
  // Check fuel sufficiency first (most critical)
  if (!sufficiencyValidation.isSufficient) {
    errors.push({
      level: 'error',
      type: 'insufficient_fuel',
      message: `Insufficient fuel for ${laps} laps`,
      details: {
        required: sufficiencyValidation.required,
        available: sufficiencyValidation.available,
        shortfall: sufficiencyValidation.shortfall,
        maxLapsPossible: sufficiencyValidation.maxLapsPossible,
      },
      quickFixes: [
        { type: 'add_fuel', amount: sufficiencyValidation.shortfall, label: `Add ${roundTo(sufficiencyValidation.shortfall, 1)} L at pit stop` },
        { type: 'reduce_laps', laps: sufficiencyValidation.maxLapsPossible, label: `Reduce to ${sufficiencyValidation.maxLapsPossible} laps` },
      ],
    });
  }
  
  // Check fuel target validity
  if (!fuelValidation.isValid) {
    errors.push({
      level: 'critical',
      type: 'target_below_minimum',
      message: `Target fuel consumption below 90% minimum`,
      details: {
        target: fuelValidation.targetPerLap,
        minimum: fuelValidation.minAllowed,
        shortfallPerLap: fuelValidation.shortfallPerLap,
        totalShortfall: fuelValidation.totalShortfall,
      },
      quickFixes: [
        { type: 'add_fuel', amount: fuelValidation.totalShortfall, label: `Add ${roundTo(fuelValidation.totalShortfall, 1)} L at pit stop` },
        { type: 'reduce_laps', laps: Math.floor(fuelValidation.usableFuel / fuelValidation.minAllowed), label: `Reduce to ${Math.floor(fuelValidation.usableFuel / fuelValidation.minAllowed)} laps` },
      ],
    });
  } else if (fuelValidation.isAggressive) {
    warnings.push({
      level: 'warning',
      type: 'aggressive_target',
      message: `Aggressive fuel saving required`,
      details: {
        target: fuelValidation.targetPerLap,
        standard: fuelValidation.minAllowed / 0.90,
        percentageBelow: ((fuelValidation.minAllowed / 0.90 - fuelValidation.targetPerLap) / (fuelValidation.minAllowed / 0.90)) * 100,
      },
    });
  }
  
  return { errors, warnings };
};

