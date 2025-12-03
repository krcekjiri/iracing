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
  
  // Find best fuel-saving index (first one with positive net delta)
  const bestFuelSavingIndex = allStrategies.length > 1 
    ? allStrategies.findIndex(s => 
        (s.fsCount > 0 || s.efsCount > 0) && s.netTimeDelta > 0
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
    // Fall back to card-based selection
    activeResult = selectedStrategy === 'standard' ? standardResult : fuelSavingResult;
    activeStintPlan = activeResult?.stintPlan || [];
    activeStrategyMode = selectedStrategy;
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
    // Always show individual times to see splash-and-dash optimization (rounded to whole numbers)
    if (stopTimes.length === 1) {
      return `${Math.round(stopTimes[0])}s`;
    }
    return stopTimes.map((time) => `${Math.round(time)}s`).join(' + ');
  };

  return (
    <div className="tab-content">
      <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          View calculated strategy plans for Standard and Fuel-Saving modes. Compare total laps, pit stops, and race times. Use the detailed stint planner to refine individual stints.
        </p>
      </div>

      {/* Strategy Comparison Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 24 }}>
        {strategyConfigs && strategyConfigs.length > 0 ? (
          strategyConfigs
            .filter(strategy => strategy && strategy.result)
            .map((strategy) => {
              const isOptimal = strategyRecommendation(strategy.key);
              const preciseLapsValue = Number(strategy.result.decimalLaps || strategy.result.totalLaps || 0);
              const avgLaps = calculateAvgLaps(strategy.result);
              
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
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    transform: (isSelected || isCardSelected) ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: (isSelected || isCardSelected) ? `0 8px 24px rgba(${strategy.color === '#1ea7ff' ? '30, 167, 255' : '16, 185, 129'}, 0.3)` : 'none',
                    position: 'relative',
                  }}
                  onClick={() => handleCardClick(strategy.key)}
                >
                  {(isSelected || isCardSelected) && (
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
                    {!strategy.result.errors?.length && isOptimal && (
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
                  
                  {strategy.result.errors?.length ? (
                    <div className="callout">
                      {strategy.result.errors.map((err) => (
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
                        value={`${strategy.result.stintCount} stints`}
                        detail={
                          strategy.result.stintPlan && strategy.result.stintPlan.length > 0
                            ? (() => {
                                const minLaps = Math.min(...strategy.result.stintPlan.map(s => s.laps));
                                const maxLaps = Math.max(...strategy.result.stintPlan.map(s => s.laps));
                                const lapsDisplay = minLaps === maxLaps
                                  ? `~${minLaps} laps/stint`
                                  : `${minLaps}-${maxLaps} laps/stint`;
                                return `${strategy.result.pitStops} stops • ${lapsDisplay}`;
                              })()
                            : `${strategy.result.pitStops} stops • ~${strategy.result.lapsPerStint} laps/stint`
                        }
                      />
                      <Stat
                        label="Total Pit Time"
                        value={`${roundTo(strategy.result.totalPitTime, 1)} s`}
                        detail={formatPitStopTimes(strategy.result)}
                      />
                      <Stat
                        label="Total Fuel Required"
                        value={`${roundTo(strategy.result.totalFuelWithReserve, 1)} L`}
                        detail={`${roundTo(strategy.result.totalFuelNeeded, 1)} L base + ${((strategy.result.stintCount || 0) * reservePerStint).toFixed(1)} L reserve`}
                      />
                      <Stat
                        label="Average Lap (no pits)"
                        value={avgLaps.withoutPits > 0 ? formatLapTime(avgLaps.withoutPits) : '--'}
                        detail="Average lap time excluding pit stops"
                      />
                      <Stat
                        label="Average Lap (with pits)"
                        value={avgLaps.withPits > 0 ? formatLapTime(avgLaps.withPits) : '--'}
                        detail="Average lap time including pit stop time"
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
