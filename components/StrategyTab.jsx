const StrategyTab = ({
  form,
  standardResult,
  fuelSavingResult,
  strategyConfigs,
  selectedStrategy,
  setSelectedStrategy,
  strategyRecommendation,
  reservePerStint,
}) => {
  // Local state for comparison table selection
  const [selectedStrategyIndex, setSelectedStrategyIndex] = useState(null);
  
  // Get all strategies from standard result
  const allStrategies = standardResult?.allCandidates || [];
  const capacities = standardResult?.capacities || { std: 0, fs: 0, efs: 0 };
  
  // Find best fuel-saving index (first one with FS/EFS, regardless of netTimeDelta)
  const bestFuelSavingIndex = allStrategies.length > 1 
    ? allStrategies.findIndex((s, idx) => 
        idx > 0 && (s.fsCount > 0 || s.efsCount > 0)
      )
    : -1;
  
  // Map card selection to index
  const standardIndex = 0;
  const fuelSavingIndex = bestFuelSavingIndex > 0 ? bestFuelSavingIndex : -1;
  
  // Helper function to transform strategy stints to stintPlan format
  const transformStrategyToStintPlan = (strategy, tankCapacity, reserveFuel, formationLapFuel) => {
    if (!strategy || !strategy.stints || strategy.stints.length === 0) {
      return [];
    }
    
    const modeMap = {
      'std': 'standard',
      'fs': 'fuel-saving',
      'efs': 'extra-fuel-saving',
    };
    
    return strategy.stints.map((stint, idx) => {
      const isFirstStint = idx === 0;
      const stintMode = modeMap[stint.mode] || 'standard';
      
      const fuelAtStart = isFirstStint
        ? tankCapacity - formationLapFuel
        : tankCapacity;
      
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
  };
  
  // Derive strategy mode from stint modes
  const deriveStrategyMode = (strategy) => {
    if (!strategy || !strategy.stintModes) return 'standard';
    const hasEfs = strategy.stintModes.some(m => m === 'efs');
    const hasFs = strategy.stintModes.some(m => m === 'fs');
    if (hasEfs || hasFs) return 'fuel-saving';
    return 'standard';
  };
  
  // Helper to create a result-like object from a strategy (for card display)
  const createResultFromStrategy = (strategy, tankCapacity, reserveFuel, formationLapFuel) => {
    const stintPlan = transformStrategyToStintPlan(strategy, tankCapacity, reserveFuel, formationLapFuel);
    const totalRaceTimeWithStops = stintPlan.reduce((sum, stint) => sum + stint.stintDuration, 0) 
      + (strategy.totalPitTime || 0);
    const avgPerStopLoss = strategy.pitStops > 0 
      ? (strategy.totalPitTime || 0) / strategy.pitStops 
      : 0;
    const totalFuelWithReserve = (strategy.totalFuelUsed || 0) + reserveFuel * (strategy.stintCount || 0);
    
    return {
      ...strategy,
      stintPlan: stintPlan,
      totalLaps: strategy.totalLaps,
      decimalLaps: strategy.fractionalLaps,
      stintCount: strategy.stintCount,
      pitStops: strategy.pitStops,
      totalPitTime: strategy.totalPitTime,
      totalRaceTimeWithStops: totalRaceTimeWithStops,
      perStopLoss: avgPerStopLoss,
      totalFuelNeeded: strategy.totalFuelUsed || 0,
      totalFuelWithReserve: totalFuelWithReserve,
      lapsPerStint: strategy.maxLapsPerStint,
      errors: [],
    };
  };
  
  // Create transformed fuel-saving result once (if it exists) - more efficient
  let fuelSavingCardResult = null;
  if (bestFuelSavingIndex > 0 && allStrategies[bestFuelSavingIndex]) {
    const baseTankCapacity = safeNumber(form.tankCapacity) || 106;
    const fuelBoP = safeNumber(form.fuelBoP) || 0;
    const tankCapacity = baseTankCapacity * (1 - fuelBoP / 100);
    const reserveFuel = safeNumber(form.fuelReserveLiters) || 0;
    const formationLapFuel = safeNumber(form.formationLapFuel) || 0;
    
    fuelSavingCardResult = createResultFromStrategy(
      allStrategies[bestFuelSavingIndex],
      tankCapacity,
      reserveFuel,
      formationLapFuel
    );
  }
  
  // Determine which index is selected (comparison table takes priority)
  const activeIndex = selectedStrategyIndex !== null 
    ? selectedStrategyIndex 
    : (selectedStrategy === 'standard' ? standardIndex : fuelSavingIndex);
  
  // Get active result - either from comparison table selection or card selection
  let activeResult;
  let activeStintPlan;
  let activeStrategyMode;
  
  if (selectedStrategyIndex !== null && allStrategies[selectedStrategyIndex]) {
    // Strategy selected from comparison table
    const selectedStrategyObj = allStrategies[selectedStrategyIndex];
    const baseTankCapacity = safeNumber(form.tankCapacity) || 106;
    const fuelBoP = safeNumber(form.fuelBoP) || 0;
    const tankCapacity = baseTankCapacity * (1 - fuelBoP / 100);
    const reserveFuel = safeNumber(form.fuelReserveLiters) || 0;
    const formationLapFuel = safeNumber(form.formationLapFuel) || 0;
    
    activeStintPlan = transformStrategyToStintPlan(
      selectedStrategyObj,
      tankCapacity,
      reserveFuel,
      formationLapFuel
    );
    activeStrategyMode = deriveStrategyMode(selectedStrategyObj);
    
    // Create a result-like object for compatibility
    activeResult = {
      ...selectedStrategyObj,
      stintPlan: activeStintPlan,
      totalLaps: selectedStrategyObj.totalLaps,
      decimalLaps: selectedStrategyObj.fractionalLaps,
      errors: [],
    };
  } else {
    // Fall back to card-based selection - use allCandidates consistently
    if (selectedStrategy === 'standard') {
      activeResult = standardResult;
      activeStintPlan = standardResult?.stintPlan || [];
      activeStrategyMode = 'standard';
    } else if (selectedStrategy === 'fuel-saving' && bestFuelSavingIndex > 0) {
      // Use allCandidates instead of fuelSavingResult
      const selectedStrategyObj = allStrategies[bestFuelSavingIndex];
      const baseTankCapacity = safeNumber(form.tankCapacity) || 106;
      const fuelBoP = safeNumber(form.fuelBoP) || 0;
      const tankCapacity = baseTankCapacity * (1 - fuelBoP / 100);
      const reserveFuel = safeNumber(form.fuelReserveLiters) || 0;
      const formationLapFuel = safeNumber(form.formationLapFuel) || 0;
      
      activeStintPlan = transformStrategyToStintPlan(
        selectedStrategyObj,
        tankCapacity,
        reserveFuel,
        formationLapFuel
      );
      activeStrategyMode = deriveStrategyMode(selectedStrategyObj);
      activeResult = {
        ...selectedStrategyObj,
        stintPlan: activeStintPlan,
        totalLaps: selectedStrategyObj.totalLaps,
        decimalLaps: selectedStrategyObj.fractionalLaps,
        errors: [],
      };
    } else {
      // No valid fuel-saving strategy - fall back to standard
      activeResult = standardResult;
      activeStintPlan = standardResult?.stintPlan || [];
      activeStrategyMode = 'standard';
    }
  }
  
  // Handle card click - map to index
  const handleCardClick = (strategyKey) => {
    setSelectedStrategy(strategyKey);
    // Map to index
    if (strategyKey === 'standard') {
      setSelectedStrategyIndex(standardIndex);
    } else if (strategyKey === 'fuel-saving' && fuelSavingIndex > 0) {
      setSelectedStrategyIndex(fuelSavingIndex);
    }
  };
  
  // Handle comparison table selection
  const handleStrategySelect = (index) => {
    setSelectedStrategyIndex(index);
  };
  
  // Calculate average lap times for display
  const calculateAvgLaps = (result) => {
    if (!result || result.errors?.length || !result.totalLaps) {
      return { withoutPits: 0, withPits: 0 };
    }
    // Calculate time on track by summing all stint durations (pure driving time, excluding pit stops)
    const timeOnTrack = result.stintPlan && result.stintPlan.length > 0
      ? result.stintPlan.reduce((sum, stint) => sum + (stint.stintDuration || 0), 0)
      : result.totalRaceTimeWithStops - result.totalPitTime; // Fallback if stintPlan not available
    const avgLapWithoutPits = result.totalLaps > 0 && timeOnTrack > 0
      ? timeOnTrack / result.totalLaps
      : 0;
    const totalTimeWithPits = result.totalRaceTimeWithStops + result.totalPitTime;
    const avgLapWithPits = result.totalLaps > 0 && totalTimeWithPits > 0
      ? totalTimeWithPits / result.totalLaps
      : 0;
    return { withoutPits: avgLapWithoutPits, withPits: avgLapWithPits };
  };

  // Format pit stop times - displays exactly what's calculated in strategy.js
  const formatPitStopTimes = (result) => {
    if (!result?.stintPlan?.length) return 'No stops';
    // Get perStopLoss directly from each stint (calculated in strategy.js)
    const stopTimes = result.stintPlan
      .filter((stint, idx) => idx < result.stintPlan.length - 1)
      .map(stint => stint.perStopLoss || 0)
      .filter(time => time > 0); // Filter out any zero/undefined values
    if (stopTimes.length === 0) return 'No stops';
    
    // If too many stops, show summary instead
    if (stopTimes.length > 3) {
      const avgTime = stopTimes.reduce((a, b) => a + b, 0) / stopTimes.length;
      return `${stopTimes.length} stops • ~${Math.round(avgTime)}s avg`;
    }
    
    // Show individual times for 1-3 stops
    if (stopTimes.length === 1) {
      return `${Math.round(stopTimes[0])}s`;
    }
    return stopTimes.map((time) => `${Math.round(time)}s`).join(' + ');
  };

  return (
    <div className="tab-content">
      <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Compare strategy options and select one to view detailed stint plan. Click strategy cards or rows in the comparison table to see detailed breakdown.
        </p>
      </div>

      {/* Strategy Comparison Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 24 }}>
        {strategyConfigs && strategyConfigs.length > 0 ? (
          strategyConfigs
            .filter(strategy => strategy && strategy.result)
            .map((strategy) => {
              // Override fuel-saving card to use allCandidates data
              let cardResult = strategy.result;
              if (strategy.key === 'fuel-saving' && fuelSavingCardResult) {
                cardResult = fuelSavingCardResult;
              }
              
              // Check if fuel-saving strategy is not available
              const hasNoFuelSavingStrategy = strategy.key === 'fuel-saving' && bestFuelSavingIndex <= 0;
              
              const isOptimal = strategyRecommendation(strategy.key);
              const preciseLapsValue = Number(cardResult.decimalLaps || cardResult.totalLaps || 0);
              const avgLaps = calculateAvgLaps(cardResult);
              
              // Determine if this card is selected based on index
              const cardIndex = strategy.key === 'standard' ? standardIndex : fuelSavingIndex;
              const isSelected = activeIndex === cardIndex && selectedStrategyIndex !== null;
              const isCardSelected = selectedStrategy === strategy.key && selectedStrategyIndex === null;
              
              return (
                <div 
                  key={strategy.name} 
                  className="card" 
                  style={{ 
                    borderTop: `4px solid ${strategy.color}`,
                    border: (isSelected || isCardSelected) ? `2px solid ${strategy.color}` : `1px solid var(--border)`,
                    cursor: hasNoFuelSavingStrategy ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                    transform: (isSelected || isCardSelected) ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: (isSelected || isCardSelected) ? `0 8px 24px rgba(${strategy.color === '#1ea7ff' ? '30, 167, 255' : '16, 185, 129'}, 0.3)` : 'none',
                    position: 'relative',
                    opacity: hasNoFuelSavingStrategy ? 0.7 : 1,
                  }}
                  onClick={hasNoFuelSavingStrategy ? undefined : () => handleCardClick(strategy.key)}
                >
                  {(isSelected || isCardSelected) && !hasNoFuelSavingStrategy && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      padding: '2px 8px',
                      background: `rgba(${strategy.color === '#1ea7ff' ? '30, 167, 255' : '16, 185, 129'}, 0.3)`,
                      color: strategy.color,
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}>
                      Selected
                    </div>
                  )}
                  <h3 style={{ marginBottom: 16, color: strategy.color, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {strategy.name} Strategy
                    {!hasNoFuelSavingStrategy && !strategy.result.errors?.length && isOptimal && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: strategy.color,
                          color: '#071321',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                        title="Optimal Strategy"
                      >
                        ★
                      </span>
                    )}
                  </h3>
                  
                  {hasNoFuelSavingStrategy ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '200px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.95rem',
                      padding: '20px',
                    }}>
                      No fuel-saving strategy needed. You can push like an animal!
                    </div>
                  ) : cardResult.errors?.length ? (
                    <div className="callout">
                      {cardResult.errors.map((err) => (
                        <div key={err}>{err}</div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <Stat
                        label="Total Laps"
                        value={`${Math.ceil(preciseLapsValue)} laps`}
                        detail={`${preciseLapsValue.toFixed(2)} laps exact`}
                      />
                      <Stat
                        label="Total Stints"
                        value={`${cardResult.stintCount} stints`}
                        detail={
                          cardResult.stintPlan && cardResult.stintPlan.length > 0
                            ? (() => {
                                const minLaps = Math.min(...cardResult.stintPlan.map(s => s.laps));
                                const maxLaps = Math.max(...cardResult.stintPlan.map(s => s.laps));
                                const lapsDisplay = minLaps === maxLaps
                                  ? `~${minLaps} laps/stint`
                                  : `${minLaps}-${maxLaps} laps/stint`;
                                return `${cardResult.pitStops} stops • ${lapsDisplay}`;
                              })()
                            : `${cardResult.pitStops} stops • ~${cardResult.lapsPerStint} laps/stint`
                        }
                      />
                      <Stat
                        label="Total Pit Time"
                        value={`${roundTo(cardResult.totalPitTime, 1)} s`}
                        detail={formatPitStopTimes(cardResult)}
                      />
                      <Stat
                        label="Total Fuel Required"
                        value={`${roundTo(cardResult.totalFuelWithReserve, 1)} L`}
                        detail={`${roundTo(cardResult.totalFuelNeeded, 1)} L base + ${((cardResult.stintCount || 0) * reservePerStint).toFixed(1)} L reserve`}
                      />
                      <Stat
                        label="Average Lap (no pits)"
                        value={avgLaps.withoutPits > 0 ? formatLapTime(avgLaps.withoutPits) : '--'}
                      />
                      <Stat
                        label="Average Lap (with pits)"
                        value={avgLaps.withPits > 0 ? formatLapTime(avgLaps.withPits) : '--'}
                      />
                    </>
                  )}
                </div>
              );
            })
        ) : (
          <div style={{ padding: '20px', color: 'var(--text-muted)' }}>
            No strategy data available. Please check your setup parameters.
          </div>
        )}
      </div>

      {/* Strategy Comparison Table */}
      {allStrategies.length > 1 && (
        <StrategyComparisonTable 
          strategies={allStrategies}
          capacities={capacities}
          selectedIndex={activeIndex}
          onSelectStrategy={handleStrategySelect}
          bestFuelSavingIndex={bestFuelSavingIndex > 0 ? bestFuelSavingIndex : null}
        />
      )}

      {/* Detailed Stint Planner */}
      {!activeResult.errors?.length && activeStintPlan?.length > 0 ? (
        <div className="card" style={{ padding: 24 }}>
          {activeResult.minLapsWarning && (
            <div className="callout" style={{ marginBottom: 16 }}>
              Fuel window currently allows ~{activeResult.lapsPerStint} laps per stint, below your minimum target of{' '}
              {form.minLapsPerStint || 0} laps.
            </div>
          )}
          
          <DetailedStintPlanner
            plan={activeStintPlan}
            form={form}
            reservePerStint={reservePerStint}
            formationLapFuel={Number(form.formationLapFuel) || 0}
            totalLaps={activeResult.totalLaps}
            strategyMode={activeStrategyMode}
          />
        </div>
      ) : activeResult.errors?.length ? (
        <div className="card" style={{ padding: 24 }}>
          <div className="callout">
            {activeResult.errors.map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
