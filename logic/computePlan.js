const computePlan = (form, strategyMode = 'standard') => {
  // ========== STEP 1: Select strategy parameters ==========
  let lapTime, fuelPerLap;
  const standardFuelPerLap = safeNumber(form.fuelPerLap) || 3.18; // For 90% minimum validation
  
  if (strategyMode === 'fuel-saving') {
    lapTime = form.fuelSavingLapTime || form.averageLapTime;
    fuelPerLap = safeNumber(form.fuelSavingFuelPerLap) || safeNumber(form.fuelPerLap) || 3.07;
  } else {
    lapTime = form.averageLapTime;
    fuelPerLap = safeNumber(form.fuelPerLap) || 3.18;
  }
  
  const lapSeconds = parseLapTime(lapTime);
  const tankCapacity = safeNumber(form.tankCapacity);
  const reserveLiters = safeNumber(form.fuelReserveLiters ?? 0) ?? 0;
  const pitLaneDelta = safeNumber(form.pitLaneDeltaSeconds) || 0;
  const stationaryService = safeNumber(form.stationaryServiceSeconds) || 0;
  const formationLapFuel = safeNumber(form.formationLapFuel) || 0;
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

  // ========== STEP 2: Calculate Maximum Race Time (White Flag Rule) ==========
  const raceDurationSeconds = Number(form.raceDurationMinutes || 0) * 60;
  const maxRaceTimeSeconds = raceDurationSeconds + lapSeconds; // White flag: can complete current + 1 more

  // ========== STEP 3: Calculate Fuel-Based Maximum Laps Per Stint ==========
  const maxLapsPerStintWithFuel = Math.floor(tankCapacity / fuelPerLap);
  
  // DEBUG: Log strategy-specific values
  console.log('=== Strategy Calculation Debug ===');
  console.log('Strategy Mode:', strategyMode);
  console.log('Lap Time:', lapTime, '→', lapSeconds, 'seconds');
  console.log('Fuel Per Lap:', fuelPerLap, 'L');
  console.log('Max Laps Per Stint (Fuel):', maxLapsPerStintWithFuel);
  console.log('Race Duration:', raceDurationSeconds, 'seconds');
  console.log('Max Race Time (with white flag):', maxRaceTimeSeconds, 'seconds');
  
  // Apply user constraint if set
  const effectiveMaxLapsPerStint = maxLapsPerStint && maxLapsPerStint > 0
    ? Math.min(maxLapsPerStintWithFuel, Math.floor(maxLapsPerStint))
    : maxLapsPerStintWithFuel;

  // ========== STEP 4: Simulate Entire Race Lap-by-Lap ==========
  // Estimate pit time per stop
  const estimatedFuelingTime = 41.1; // Full tank
  const estimatedPerStopLoss = pitLaneDelta + estimatedFuelingTime;
  
  console.log('Starting simulation...');
  console.log('Estimated pit stop time:', estimatedPerStopLoss, 'seconds');
  console.log('Pit stops will occur after laps:', maxLapsPerStintWithFuel, maxLapsPerStintWithFuel * 2, maxLapsPerStintWithFuel * 3);
  
  // Simulate Candidate A (Pure Strategy)
  const candidateA = simulateRace({
    raceDurationSeconds,
    maxRaceTimeSeconds,
    lapSeconds,
    maxLapsPerStintWithFuel,
    outLapPenalties,
    estimatedPerStopLoss,
  });
  
  let fractionalLapsAtZero = candidateA.fractionalLapsAtZero;
  let fullLapsForPlanning = candidateA.fullLapsForPlanning;
  let simulatedLaps = candidateA.simulatedLaps;
  let simulatedTime = candidateA.simulatedTime;
  
  console.log('=== Candidate A (Pure Strategy) Results ===');
  console.log('Completed laps:', simulatedLaps);
  console.log('Simulated time:', simulatedTime.toFixed(1), 'seconds');
  console.log('Fractional laps at zero:', fractionalLapsAtZero.toFixed(3));
  console.log('Full laps for planning:', fullLapsForPlanning);

  // ========== STEP 5: Optimize Stint Count to Minimize Pit Stops ==========
  const totalLaps = fullLapsForPlanning > 0 ? fullLapsForPlanning : Math.ceil(fractionalLapsAtZero);
  
  console.log('=== STINT COUNT OPTIMIZATION DEBUG ===');
  console.log('Total laps for planning:', totalLaps);
  console.log('Effective max laps per stint:', effectiveMaxLapsPerStint);
  console.log('Max laps per stint (fuel-based):', maxLapsPerStintWithFuel);
  console.log('Strategy mode:', strategyMode);
  console.log('Fuel per lap:', fuelPerLap, 'L');
  
  // Start with minimum possible stints
  let stintCount = Math.ceil(totalLaps / effectiveMaxLapsPerStint);
  
  console.log('Initial stint count (ceiling):', stintCount);
  console.log('Calculation: Math.ceil(', totalLaps, '/', effectiveMaxLapsPerStint, ') =', stintCount);
  
  // Check if we can actually fit all laps with this stint count
  const avgLapsPerStint = totalLaps / stintCount;
  console.log('Average laps per stint with', stintCount, 'stints:', avgLapsPerStint.toFixed(2));
  
  if (avgLapsPerStint > effectiveMaxLapsPerStint) {
    // Can't fit - need more stints
    stintCount = Math.ceil(totalLaps / effectiveMaxLapsPerStint);
    console.log('❌ Cannot fit - avg (', avgLapsPerStint.toFixed(2), ') > max (', effectiveMaxLapsPerStint, ')');
    console.log('Increased to:', stintCount);
  } else {
    console.log('✅ Can fit - avg (', avgLapsPerStint.toFixed(2), ') <= max (', effectiveMaxLapsPerStint, ')');
    // We can fit - but check if we can use even fewer stints by redistributing
    let testStintCount = stintCount - 1;
    console.log('Testing if we can use fewer stints...');
    while (testStintCount > 0) {
      const testAvgLaps = totalLaps / testStintCount;
      console.log(`  Testing ${testStintCount} stints: avg = ${testAvgLaps.toFixed(2)} laps/stint`);
      if (testAvgLaps <= effectiveMaxLapsPerStint) {
        // Can fit with fewer stints - use this
        console.log(`  ✅ Can fit with ${testStintCount} stints! (avg: ${testAvgLaps.toFixed(2)} <= max: ${effectiveMaxLapsPerStint})`);
        stintCount = testStintCount;
        console.log('  Updated stint count to:', stintCount);
        testStintCount--; // Try even fewer
      } else {
        // Can't fit with fewer - stop
        console.log(`  ❌ Cannot fit with ${testStintCount} stints (avg: ${testAvgLaps.toFixed(2)} > max: ${effectiveMaxLapsPerStint})`);
        break;
      }
    }
  }
  
  stintCount = Math.max(1, stintCount);
  let pitStops = Math.max(0, stintCount - 1);
  
  console.log('=== FINAL STINT COUNT DECISION ===');
  console.log('Final stint count:', stintCount);
  console.log('Pit stops:', pitStops);
  console.log('Distribution will be:', Math.floor(totalLaps / stintCount), 'base +', totalLaps % stintCount, 'extra');
  console.log('===================================');

  // ========== STEP 6: Distribute Laps Evenly Across Stints ==========
  let baseLapsPerStint = Math.floor(totalLaps / stintCount);
  let extraLaps = totalLaps % stintCount;
  
  // ========== SMART STINT DISTRIBUTION: Avoid very short final stints ==========
  // Check if last stint would be too short (less than minimum threshold)
  const minLapsThreshold = minLapsPerStint && minLapsPerStint > 0 
    ? minLapsPerStint 
    : 5; // Default to 5 if not specified
  
  // Calculate what the last stint would be with current distribution
  // Note: Extra laps go to FIRST stints, so last stint is just baseLapsPerStint
  let lastStintLaps = baseLapsPerStint;
  
  // If last stint is too short, try reducing stint count and redistributing
  if (lastStintLaps < minLapsThreshold && lastStintLaps > 0 && stintCount > 1) {
    const originalStintCount = stintCount;
    let adjustedStintCount = stintCount - 1;
    let adjustedBaseLaps = Math.floor(totalLaps / adjustedStintCount);
    let adjustedLastStintLaps = adjustedBaseLaps;
    
    // Check if we can fit all laps with fewer stints
    const testAvgLaps = totalLaps / adjustedStintCount;
    
    if (testAvgLaps <= effectiveMaxLapsPerStint && adjustedLastStintLaps >= minLapsThreshold) {
      // Can fit with fewer stints and last stint is acceptable - use this
      stintCount = adjustedStintCount;
      pitStops = Math.max(0, stintCount - 1);
      baseLapsPerStint = adjustedBaseLaps;
      extraLaps = totalLaps % stintCount;
      
      console.log(`Adjusted stint count from ${originalStintCount} to ${stintCount} to avoid short final stint (< ${minLapsThreshold} laps)`);
      console.log(`New distribution: base=${baseLapsPerStint}, extra=${extraLaps}, last stint=${baseLapsPerStint} laps`);
    } else {
      // Can't reduce stints (would exceed max or still too short) - keep current
      console.log(`Cannot reduce stints: avg would be ${testAvgLaps.toFixed(1)} (max: ${effectiveMaxLapsPerStint}), last would be ${adjustedLastStintLaps} (min: ${minLapsThreshold})`);
    }
  }

  // ========== DISTRIBUTION PREVIEW ==========
  console.log('=== DISTRIBUTION PREVIEW ===');
  console.log('Base laps per stint:', baseLapsPerStint);
  console.log('Extra laps to distribute:', extraLaps);
  const previewDistribution = [];
  for (let i = 0; i < stintCount; i++) {
    const laps = baseLapsPerStint + (i < extraLaps ? 1 : 0);
    previewDistribution.push(laps);
  }
  console.log('Preview distribution:', previewDistribution.join(' + '), '=', previewDistribution.reduce((a, b) => a + b, 0), 'laps');
  console.log('Last stint would be:', baseLapsPerStint, 'laps');
  console.log('=============================');

  // ========== TWO-CANDIDATE COMPARISON: Pure vs Mixed Strategy ==========
  // Candidate A: Pure strategy (all stints use same mode)
  const candidateADistribution = {
    stintCount,
    baseLapsPerStint,
    extraLaps,
    fractionalLaps: fractionalLapsAtZero,
    fullLaps: fullLapsForPlanning,
  };
  
  // Calculate last stint laps for Candidate A
  const candidateALastStintLaps = baseLapsPerStint; // Last stint doesn't get extra laps
  
  // ========== CANDIDATE COMPARISON: Show Both Candidates ==========
  console.log('=== CANDIDATE A (Pure Strategy) ===');
  const candidateADistributionPreview = [];
  for (let i = 0; i < stintCount; i++) {
    const laps = baseLapsPerStint + (i < extraLaps ? 1 : 0);
    candidateADistributionPreview.push(laps);
  }
  console.log('Distribution:', candidateADistributionPreview.join(' + '), '=', totalLaps, 'laps');
  console.log('Stint count:', stintCount, '(', pitStops, 'stops)');
  console.log('Last stint:', candidateALastStintLaps, 'laps');
  console.log('Fractional laps:', candidateA.fractionalLapsAtZero.toFixed(3));
  console.log('All stints use:', strategyMode === 'fuel-saving' ? 'Fuel-Saving' : 'Standard', 'mode');
  
  // ========== MULTI-CANDIDATE EVALUATION: Find Optimal Stint Count ==========
  // For fuel-saving strategy, evaluate multiple stint counts (N-2, N-1, N, N+1)
  // to find the optimal balance between pit stops and lap completion
  const extraFuelSavingLapTime = form.extraFuelSavingLapTime;
  const extraFuelSavingFuelPerLap = safeNumber(form.extraFuelSavingFuelPerLap);
  const shouldEvaluateMultipleCandidates = 
    strategyMode === 'fuel-saving' &&  // Only for fuel-saving strategy
    stintCount > 1 &&                   // Need multiple stints to optimize
    extraFuelSavingLapTime && 
    extraFuelSavingFuelPerLap > 0;
  
  // Candidate A: Pure strategy (already calculated)
  const candidateAObj = {
    stintCount,
    baseLapsPerStint,
    extraLaps,
    distribution: candidateADistributionPreview,
    fractionalLaps: candidateA.fractionalLapsAtZero,
    pitStops,
    pitTime: pitStops * estimatedPerStopLoss,
    useExtraFuelSaving: false,
    name: 'A (Pure Strategy)',
  };
  
  let finalDistribution = candidateADistribution;
  let useExtraFuelSavingForLastStint = false;
  const allCandidates = [candidateAObj];
  
  if (shouldEvaluateMultipleCandidates) {
    console.log('\n=== EVALUATING MULTIPLE CANDIDATES ===');
    console.log('Base stint count (Candidate A):', stintCount);
    
    // Generate candidate stint counts: [N-2, N-1, N, N+1]
    const candidateStintCounts = [];
    for (let offset = -2; offset <= 1; offset++) {
      const candidateCount = stintCount + offset;
      if (candidateCount >= 1 && candidateCount <= 50) { // Reasonable max
        candidateStintCounts.push(candidateCount);
      }
    }
    
    console.log('Evaluating stint counts:', candidateStintCounts.join(', '));
    
    // Calculate max laps for extra-fuel-saving (accounting for reserve)
    const extraFuelSavingMaxLaps = Math.floor((tankCapacity - reserveLiters) / extraFuelSavingFuelPerLap);
    const extraFuelSavingLapSeconds = parseLapTime(extraFuelSavingLapTime);
    const minAllowedFuelPerLap = standardFuelPerLap * 0.90;
    
    // Evaluate each candidate
    for (const candidateStintCount of candidateStintCounts) {
      if (candidateStintCount === stintCount) {
        // Already have Candidate A, skip
        continue;
      }
      
      console.log(`\n--- Evaluating ${candidateStintCount} stints ---`);
      
      // Calculate distribution: base laps for early stints, extra laps go to last stint
      const candidateBaseLaps = Math.floor(totalLaps / candidateStintCount);
      const candidateExtraLaps = totalLaps % candidateStintCount;
      
      // Early stints get base laps (capped at strategy max)
      const earlyStintsCount = candidateStintCount - 1;
      const earlyStintsLaps = [];
      for (let i = 0; i < earlyStintsCount; i++) {
        const laps = Math.min(candidateBaseLaps, effectiveMaxLapsPerStint);
        earlyStintsLaps.push(laps);
      }
      
      // Calculate how many laps early stints can actually take
      const earlyStintsTotalLaps = earlyStintsLaps.reduce((sum, laps) => sum + laps, 0);
      
      // Last stint gets all remaining laps (can exceed strategy max if using extra-fuel-saving)
      const candidateLastStintLaps = totalLaps - earlyStintsTotalLaps;
      
      // Build distribution preview
      const candidateDistribution = [...earlyStintsLaps, candidateLastStintLaps];
      
      console.log(`  Distribution: ${candidateDistribution.join(' + ')} = ${totalLaps} laps`);
      console.log(`  Early stints: ${earlyStintsLaps.join(', ')} (max: ${effectiveMaxLapsPerStint})`);
      console.log(`  Last stint: ${candidateLastStintLaps} laps (using Extra Fuel-Saving)`);
      
      // Viability checks
      const maxEarlyStintLaps = Math.max(...earlyStintsLaps);
      const earlyStintsFit = maxEarlyStintLaps <= effectiveMaxLapsPerStint;
      
      // Check if last stint fits with extra-fuel-saving
      const lastStintFuelNeeded = candidateLastStintLaps * extraFuelSavingFuelPerLap + reserveLiters;
      const lastStintFits = lastStintFuelNeeded <= tankCapacity;
      
      if (!earlyStintsFit) {
        console.log(`  ❌ Rejected: Early stints exceed max (${maxEarlyStintLaps} > ${effectiveMaxLapsPerStint})`);
        continue;
      }
      
      if (!lastStintFits) {
        console.log(`  ❌ Rejected: Last stint fuel exceeds capacity (${lastStintFuelNeeded.toFixed(2)}L > ${tankCapacity}L)`);
        continue;
      }
      
      // Fuel feasibility check
      const requiredFuelPerLap = (tankCapacity - reserveLiters - (candidateStintCount === 1 ? formationLapFuel : 0)) / candidateLastStintLaps;
      const isFuelFeasible = 
        requiredFuelPerLap >= extraFuelSavingFuelPerLap && 
        requiredFuelPerLap >= minAllowedFuelPerLap &&
        lastStintFuelNeeded <= tankCapacity;
      
      if (!isFuelFeasible) {
        console.log(`  ❌ Rejected: Fuel not feasible (required: ${requiredFuelPerLap.toFixed(2)}L/lap, available: ${extraFuelSavingFuelPerLap.toFixed(2)}L/lap)`);
        continue;
      }
      
      console.log(`  ✅ Viable - simulating...`);
      
      // Simulate this candidate
      let candidateTime = 0;
      let candidateLaps = 0;
      let candidateFractionalLaps = 0;
      
      // Simulate early stints (use strategy lap time)
      for (let i = 0; i < earlyStintsCount; i++) {
        const laps = earlyStintsLaps[i];
        
        for (let lap = 0; lap < laps; lap++) {
          const lapNumber = candidateLaps + 1;
          let currentLapTime = lapSeconds;
          
          if (lapNumber <= outLapPenalties.length && outLapPenalties[lapNumber - 1]) {
            currentLapTime += outLapPenalties[lapNumber - 1];
          }
          
          const timeAfterThisLap = candidateTime + currentLapTime;
          
          if (timeAfterThisLap > maxRaceTimeSeconds) {
            if (candidateTime < raceDurationSeconds) {
              const timeIntoThisLap = raceDurationSeconds - candidateTime;
              const fractionOfLapCompleted = timeIntoThisLap / currentLapTime;
              candidateFractionalLaps = candidateLaps + fractionOfLapCompleted;
            } else {
              candidateFractionalLaps = candidateLaps;
            }
            candidateTime = raceDurationSeconds;
            break;
          }
          
          candidateTime += currentLapTime;
          candidateLaps += 1;
        }
        
        // Add pit stop after this stint (except before last stint)
        if (i < earlyStintsCount - 1 && candidateTime < maxRaceTimeSeconds) {
          const timeAfterPitStop = candidateTime + estimatedPerStopLoss;
          
          if (timeAfterPitStop > maxRaceTimeSeconds) {
            if (candidateTime < raceDurationSeconds) {
              const timeRemainingAfterLap = maxRaceTimeSeconds - candidateTime;
              if (timeRemainingAfterLap > estimatedPerStopLoss) {
                const timeRemainingAfterPit = maxRaceTimeSeconds - timeAfterPitStop;
                if (timeRemainingAfterPit > 0) {
                  const fractionOfNextLap = timeRemainingAfterPit / extraFuelSavingLapSeconds;
                  candidateFractionalLaps = candidateLaps + Math.min(fractionOfNextLap, 1);
                } else {
                  candidateFractionalLaps = candidateLaps;
                }
              } else {
                candidateFractionalLaps = candidateLaps;
              }
            } else {
              candidateFractionalLaps = candidateLaps;
            }
            candidateTime = raceDurationSeconds;
            break;
          }
          
          if (timeAfterPitStop + lapSeconds > maxRaceTimeSeconds) {
            const timeRemainingAfterPit = maxRaceTimeSeconds - timeAfterPitStop;
            if (timeRemainingAfterPit > 0) {
              const fractionOfNextLap = timeRemainingAfterPit / extraFuelSavingLapSeconds;
              candidateFractionalLaps = candidateLaps + fractionOfNextLap;
            } else {
              candidateFractionalLaps = candidateLaps;
            }
            candidateTime = raceDurationSeconds;
            break;
          }
          
          candidateTime = timeAfterPitStop;
        }
        
        if (candidateTime >= maxRaceTimeSeconds) break;
      }
      
      // Add pit stop before last stint (if multiple stints)
      if (candidateStintCount > 1 && candidateTime < maxRaceTimeSeconds) {
        const timeAfterPitStop = candidateTime + estimatedPerStopLoss;
        
        if (timeAfterPitStop > maxRaceTimeSeconds) {
          if (candidateTime < raceDurationSeconds) {
            const timeRemainingAfterLap = maxRaceTimeSeconds - candidateTime;
            if (timeRemainingAfterLap > estimatedPerStopLoss) {
              const timeRemainingAfterPit = maxRaceTimeSeconds - timeAfterPitStop;
              if (timeRemainingAfterPit > 0) {
                const fractionOfNextLap = timeRemainingAfterPit / extraFuelSavingLapSeconds;
                candidateFractionalLaps = candidateLaps + Math.min(fractionOfNextLap, 1);
              } else {
                candidateFractionalLaps = candidateLaps;
              }
            } else {
              candidateFractionalLaps = candidateLaps;
            }
          } else {
            candidateFractionalLaps = candidateLaps;
          }
          candidateTime = raceDurationSeconds;
        } else {
          candidateTime = timeAfterPitStop;
        }
      }
      
      // Simulate last stint with extra-fuel-saving lap time
      if (candidateTime < maxRaceTimeSeconds) {
        for (let lap = 0; lap < candidateLastStintLaps; lap++) {
          const lapNumber = candidateLaps + 1;
          let currentLapTime = extraFuelSavingLapSeconds;
          
          if (lapNumber <= outLapPenalties.length && outLapPenalties[lapNumber - 1]) {
            currentLapTime += outLapPenalties[lapNumber - 1];
          }
          
          const timeAfterThisLap = candidateTime + currentLapTime;
          
          if (timeAfterThisLap > maxRaceTimeSeconds) {
            if (candidateTime < raceDurationSeconds) {
              const timeIntoThisLap = raceDurationSeconds - candidateTime;
              const fractionOfLapCompleted = timeIntoThisLap / currentLapTime;
              candidateFractionalLaps = candidateLaps + fractionOfLapCompleted;
            } else {
              candidateFractionalLaps = candidateLaps;
            }
            candidateTime = raceDurationSeconds;
            break;
          }
          
          candidateTime += currentLapTime;
          candidateLaps += 1;
        }
        
        // If we completed all laps within time, fractional = full laps
        // Check if we actually completed all planned laps
        const totalPlannedLaps = earlyStintsLaps.reduce((sum, laps) => sum + laps, 0) + candidateLastStintLaps;
        if (candidateFractionalLaps === 0) {
          // Fractional laps wasn't set (didn't hit timer mid-lap)
          if (candidateLaps >= totalPlannedLaps && candidateTime <= maxRaceTimeSeconds) {
            // Completed all planned laps within race time
            candidateFractionalLaps = candidateLaps;
          } else {
            // Completed what we could (fallback)
            candidateFractionalLaps = candidateLaps;
          }
        }
      }
      
      const candidatePitStops = candidateStintCount - 1;
      const candidatePitTime = candidatePitStops * estimatedPerStopLoss;
      
      const candidate = {
        stintCount: candidateStintCount,
        baseLapsPerStint: candidateBaseLaps,
        extraLaps: candidateExtraLaps,
        distribution: candidateDistribution,
        fractionalLaps: candidateFractionalLaps,
        pitStops: candidatePitStops,
        pitTime: candidatePitTime,
        useExtraFuelSaving: true,
        name: `${candidateStintCount} stints (Mixed)`,
      };
      
      allCandidates.push(candidate);
      
      console.log(`  ✅ Simulated: ${candidateFractionalLaps.toFixed(3)} fractional laps, ${candidatePitStops} pit stops, ${candidatePitTime.toFixed(1)}s pit time`);
    }
  } else {
    console.log('\n=== MULTI-CANDIDATE EVALUATION SKIPPED ===');
    if (strategyMode !== 'fuel-saving') {
      console.log('Reason: Only evaluates multiple candidates for fuel-saving strategy');
    } else if (!extraFuelSavingLapTime || !extraFuelSavingFuelPerLap) {
      console.log('Reason: Extra-fuel-saving inputs not provided');
    } else if (stintCount <= 1) {
      console.log('Reason: Only 1 stint (cannot optimize further)');
    }
  }
  
  // Sort candidates: fractional laps (desc), pit stops (asc), pit time (asc)
  allCandidates.sort((a, b) => {
    if (Math.abs(a.fractionalLaps - b.fractionalLaps) > 0.01) {
      return b.fractionalLaps - a.fractionalLaps; // More laps is better
    }
    if (a.pitStops !== b.pitStops) {
      return a.pitStops - b.pitStops; // Fewer stops is better
    }
    return a.pitTime - b.pitTime; // Less pit time is better
  });
  
  // Log all candidates
  console.log('\n=== ALL CANDIDATES COMPARISON ===');
  allCandidates.forEach((candidate, idx) => {
    const marker = idx === 0 ? '🏆' : '  ';
    console.log(`${marker} Candidate ${candidate.name}:`);
    console.log(`     Distribution: ${candidate.distribution.join(' + ')} = ${totalLaps} laps`);
    console.log(`     Fractional laps: ${candidate.fractionalLaps.toFixed(3)}`);
    console.log(`     Pit stops: ${candidate.pitStops} (${candidate.pitTime.toFixed(1)}s)`);
    console.log(`     Mode: ${candidate.useExtraFuelSaving ? 'Mixed (Extra Fuel-Saving on last)' : 'Pure Strategy'}`);
  });
  
  // Use winner
  const winner = allCandidates[0];
  finalDistribution = {
    stintCount: winner.stintCount,
    baseLapsPerStint: winner.baseLapsPerStint,
    extraLaps: winner.extraLaps,
    fractionalLaps: winner.fractionalLaps,
    fullLaps: totalLaps,
  };
  useExtraFuelSavingForLastStint = winner.useExtraFuelSaving;
  fractionalLapsAtZero = winner.fractionalLaps;
  fullLapsForPlanning = totalLaps;
  
  console.log(`\n✅ WINNER: Candidate ${winner.name}`);
  console.log(`Reason: Best combination of fractional laps (${winner.fractionalLaps.toFixed(3)}) and pit stops (${winner.pitStops})`);
  if (winner.useExtraFuelSaving) {
    console.log(`Strategy: Using Extra Fuel-Saving for last stint to optimize pit stops`);
  }
  
  // Update distribution with final choice
  stintCount = finalDistribution.stintCount;
  baseLapsPerStint = finalDistribution.baseLapsPerStint;
  extraLaps = finalDistribution.extraLaps;
  pitStops = Math.max(0, stintCount - 1);

  // ========== STEP 7: Build Stint Plan with Fuel Calculations ==========
  const stintPlan = [];
  let totalOutLapPenaltySeconds = 0;
  completedLaps = 0;
  let completedSeconds = 0;
  let totalPitTime = 0;
  let fuelInTank = tankCapacity; // Start with full tank

  for (let idx = 0; idx < stintCount; idx += 1) {
    // Distribute laps evenly, with remainder going to first stints
    let lapsThisStint = baseLapsPerStint + (idx < extraLaps ? 1 : 0);
    
    // Ensure we don't exceed fuel capacity or user constraint
    lapsThisStint = Math.min(lapsThisStint, effectiveMaxLapsPerStint);
    
    // Ensure we don't exceed remaining laps
    lapsThisStint = Math.min(lapsThisStint, totalLaps - completedLaps);
    
    const isFirstStint = idx === 0;
    const isLastStint = idx === stintCount - 1;
    
    // Determine stint mode
    let stintMode = strategyMode; // Default to current strategy mode
    if (isLastStint && useExtraFuelSavingForLastStint) {
      stintMode = 'extra-fuel-saving';
    }
    
    // Use appropriate fuel consumption for this stint
    const stintFuelPerLap = stintMode === 'extra-fuel-saving' 
      ? extraFuelSavingFuelPerLap 
      : fuelPerLap;
    
    // Use appropriate lap time for this stint
    const stintLapSeconds = stintMode === 'extra-fuel-saving' && extraFuelSavingLapTime
      ? parseLapTime(extraFuelSavingLapTime)
      : lapSeconds;
    
    // Calculate outlap penalties for this stint
    const penaltiesForStint = outLapPenalties
      .slice(0, Math.min(outLapPenalties.length, lapsThisStint))
      .filter(Boolean);
    const penaltySeconds = penaltiesForStint.reduce((acc, val) => acc + val, 0);
    const stintSeconds = lapsThisStint * stintLapSeconds + penaltySeconds;
    
    // ========== Calculate Fuel Requirements ==========
    const baseStintFuel = lapsThisStint * stintFuelPerLap + reserveLiters;
    const stintFuelNeeded = isFirstStint && formationLapFuel > 0
      ? Math.max(0, baseStintFuel - formationLapFuel)
      : baseStintFuel;
    const fuelUsed = Math.min(stintFuelNeeded, fuelInTank);
    const fuelLeft = fuelInTank - fuelUsed;
    
    // ========== Calculate Fuel To Add at Pit Stop ==========
    let fuelToAdd = 0;
    let fuelingTime = 0;
    if (idx < stintCount - 1) {
      if (idx === stintCount - 2) {
        // Last pit stop before final stint - splash-and-dash
        const nextStint = stintPlan.length === stintCount - 2 ? null : null; // Will be last stint
        const lastStintLaps = totalLaps - completedLaps - lapsThisStint;
        // Use extra-fuel-saving fuel consumption if last stint uses it
        const lastStintFuelPerLap = useExtraFuelSavingForLastStint 
          ? extraFuelSavingFuelPerLap 
          : fuelPerLap;
        const lastStintFuelNeeded = lastStintLaps * lastStintFuelPerLap + reserveLiters;
        fuelToAdd = Math.max(0, lastStintFuelNeeded - fuelLeft);
        fuelToAdd = Math.min(fuelToAdd, tankCapacity - fuelLeft);
      } else {
        // Regular pit stop - fill to full
        fuelToAdd = tankCapacity - fuelLeft;
      }
      fuelingTime = (fuelToAdd / tankCapacity) * 41.1;
    }
    
    // ========== Validate Fuel Target ==========
    const fuelValidation = validateFuelTarget(
      fuelInTank,
      lapsThisStint,
      reserveLiters,
      formationLapFuel,
      isFirstStint,
      standardFuelPerLap // Use STANDARD for 90% minimum, not strategy-specific
    );
    
    const sufficiencyValidation = validateFuelSufficiency(
      fuelInTank,
      fuelUsed,
      lapsThisStint,
      stintFuelPerLap, // Use stint-specific fuel per lap
      reserveLiters
    );
    
    const validation = generateValidationMessages(
      fuelValidation,
      sufficiencyValidation,
      lapsThisStint
    );
    
    const perStopLoss = idx < stintCount - 1 ? pitLaneDelta + fuelingTime : 0;
    
    if (idx < stintCount - 1) {
      totalPitTime += perStopLoss;
    }

    stintPlan.push({
      id: idx + 1,
      laps: lapsThisStint,
      fuel: fuelUsed,
      fuelLeft: fuelLeft,
      fuelToAdd: fuelToAdd,
      fuelingTime: fuelingTime,
      startLap: completedLaps + 1,
      endLap: completedLaps + lapsThisStint,
      stintDuration: stintSeconds,
      penaltySeconds,
      startTime: completedSeconds,
      endTime: completedSeconds + stintSeconds,
      perStopLoss: perStopLoss,
      fuelTarget: fuelValidation.targetPerLap,
      validation: validation,
      strategyFuelPerLap: stintFuelPerLap,
      stintMode: stintMode, // Add mode indicator
    });

    completedLaps += lapsThisStint;
    completedSeconds += stintSeconds;
    totalOutLapPenaltySeconds += penaltySeconds;
    
    // Update fuel in tank for next stint
    fuelInTank = fuelLeft + fuelToAdd;
  }

  const minLapsWarning = minLapsPerStint && effectiveMaxLapsPerStint < minLapsPerStint ? true : false;
  const avgPerStopLoss = pitStops > 0 ? totalPitTime / pitStops : 0;
  const totalRaceTimeWithStops = Math.min(completedSeconds + totalPitTime, maxRaceTimeSeconds);
  const finalStintDuration = stintPlan.at(-1)?.stintDuration ?? 0;
  
  // ========== Calculate Decimal Laps ==========
  const decimalLaps = fractionalLapsAtZero > 0 
    ? fractionalLapsAtZero 
    : (simulatedLaps > 0 && simulatedTime < raceDurationSeconds
        ? simulatedLaps + ((raceDurationSeconds - simulatedTime) / lapSeconds)
        : raceDurationSeconds / lapSeconds);

  console.log('=== Final Results ===');
  console.log('Decimal Laps:', decimalLaps.toFixed(3));
  console.log('Total Laps:', totalLaps);
  console.log('Stint Count:', stintCount);
  console.log('Pit Stops:', pitStops);
  console.log('Total Pit Time:', totalPitTime.toFixed(1), 'seconds');
  console.log('========================');

  return {
    errors,
    lapSeconds,
    totalLaps,
    decimalLaps,
    raceDurationSeconds,
    maxRaceTimeSeconds,
    totalFuelNeeded: totalLaps * fuelPerLap,
    totalFuelWithReserve: (totalLaps * fuelPerLap) + reserveLiters * stintCount,
    lapsPerStint: effectiveMaxLapsPerStint,
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
  };
};
