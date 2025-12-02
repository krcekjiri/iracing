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
  // Get active result based on selected strategy
  const activeResult = selectedStrategy === 'standard' ? standardResult : fuelSavingResult;
  
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

  // Format pit stop times
  const formatPitStopTimes = (result) => {
    if (!result?.stintPlan?.length) return 'No stops';
    const stopTimes = result.stintPlan
      .filter((stint, idx) => idx < result.stintPlan.length - 1)
      .map(stint => stint.perStopLoss);
    if (stopTimes.length === 0) return 'No stops';
    const allSame = stopTimes.every(time => Math.abs(time - stopTimes[0]) < 0.1);
    if (allSame) {
      return `${roundTo(stopTimes[0], 1)}s × ${result.pitStops || 0} stops`;
    }
    return stopTimes.map((time) => `${roundTo(time, 1)}s`).join(' + ');
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
              const isSelected = selectedStrategy === strategy.key;
              
              return (
                <div 
                  key={strategy.name} 
                  className="card" 
                  style={{ 
                    borderTop: `4px solid ${strategy.color}`,
                    border: isSelected ? `2px solid ${strategy.color}` : `1px solid var(--border)`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: isSelected ? `0 8px 24px rgba(${strategy.color === '#1ea7ff' ? '30, 167, 255' : '16, 185, 129'}, 0.3)` : 'none',
                  }}
                  onClick={() => setSelectedStrategy(strategy.key)}
                >
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
                        label="Stints & Stops"
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
                        helpText={
                          strategy.result.stintPlan && strategy.result.stintPlan.length > 0
                            ? strategy.result.stintPlan.map((s) => {
                                const modeLabel = s.stintMode === 'extra-fuel-saving' 
                                  ? 'Extra Fuel-Saving ⚡' 
                                  : s.stintMode === 'fuel-saving' 
                                    ? 'Fuel-Saving' 
                                    : 'Standard';
                                const lapRange = s.startLap === s.endLap 
                                  ? `Lap ${s.startLap}` 
                                  : `Laps ${s.startLap}-${s.endLap}`;
                                const fuelTarget = s.fuelTarget !== undefined 
                                  ? `${s.fuelTarget.toFixed(2)} L/lap` 
                                  : s.strategyFuelPerLap !== undefined 
                                    ? `${s.strategyFuelPerLap.toFixed(2)} L/lap` 
                                    : '';
                                return `Stint ${s.id}: ${s.laps} lap${s.laps > 1 ? 's' : ''} (${lapRange}) - ${modeLabel}${fuelTarget ? ` - ${fuelTarget}` : ''}`;
                              }).join('\n')
                            : undefined
                        }
                      />
                      <Stat
                        label="Total Pit Time"
                        value={`${roundTo(strategy.result.totalPitTime, 1)} s`}
                        detail={formatPitStopTimes(strategy.result)}
                      />
                      <Stat
                        label="Total Fuel Consumed"
                        value={`${roundTo(strategy.result.totalFuelWithReserve, 1)} L`}
                        detail={`${roundTo(strategy.result.totalFuelNeeded, 1)} L base + ${((strategy.result.stintCount || 0) * reservePerStint).toFixed(1)} L reserve`}
                      />
                      <Stat
                        label="Avg Lap (no pits)"
                        value={avgLaps.withoutPits > 0 ? formatLapTime(avgLaps.withoutPits) : '--'}
                        detail="Average lap time excluding pit stops"
                      />
                      <Stat
                        label="Avg Lap (with pits)"
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

      {/* Detailed Stint Planner */}
      {!activeResult.errors?.length && activeResult.stintPlan?.length > 0 ? (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Detailed Stint Planner - {selectedStrategy === 'standard' ? 'Standard' : 'Fuel-Saving'} Strategy</h3>
            <span className="stat-label">
              Fuel target capped at tank capacity ({form.tankCapacity || 0} L)
            </span>
          </div>
          
          {activeResult.minLapsWarning && (
            <div className="callout" style={{ marginBottom: 16 }}>
              Fuel window currently allows ~{activeResult.lapsPerStint} laps per stint, below your minimum target of{' '}
              {form.minLapsPerStint || 0} laps.
            </div>
          )}
          
          <DetailedStintPlanner
            plan={activeResult.stintPlan}
            form={form}
            reservePerStint={reservePerStint}
            formationLapFuel={Number(form.formationLapFuel) || 0}
            totalLaps={activeResult.totalLaps}
            strategyMode={selectedStrategy}
          />
          
          <StrategyGraph plan={activeResult.stintPlan} perStopLoss={activeResult.perStopLoss} />
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
