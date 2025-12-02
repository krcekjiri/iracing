const DetailedStintPlanner = ({
  plan,
  form,
  reservePerStint,
  formationLapFuel,
  totalLaps,
  strategyMode = 'standard',
}) => {
  const [stintPlan, setStintPlan] = useState(plan);
  const [expandedStints, setExpandedStints] = useState(new Set());
  const [cascadeUpdating, setCascadeUpdating] = useState(new Set());
  const [cascadeHistory, setCascadeHistory] = useState(new Map());
  
  useEffect(() => {
    setStintPlan(plan);
  }, [plan]);

  if (!stintPlan?.length) {
    return <div className="empty-state">Enter race details to generate a stint plan.</div>;
  }

  // Get strategy-specific fuel consumption
  const getStrategyFuelPerLap = () => {
    if (strategyMode === 'fuel-saving') {
      return safeNumber(form.fuelSavingFuelPerLap) || safeNumber(form.fuelPerLap) || 3.07;
    } else if (strategyMode === 'extra-fuel-saving') {
      return safeNumber(form.extraFuelSavingFuelPerLap) || safeNumber(form.fuelPerLap) || 2.98;
    }
    return safeNumber(form.fuelPerLap) || 3.18;
  };

  const getStandardFuelPerLap = () => {
    return safeNumber(form.fuelPerLap) || 3.18;
  };

  // Enhanced recalculation with cascade tracking
  const recalculateStintPlan = (updatedPlan, changedStintId = null) => {
    const tankCapacity = safeNumber(form.tankCapacity) || 106;
    const fuelPerLap = getStrategyFuelPerLap();
    const standardFuelPerLap = getStandardFuelPerLap();
    const pitLaneDelta = safeNumber(form.pitLaneDeltaSeconds) || 27;
    const lapSeconds = parseLapTime(
      strategyMode === 'fuel-saving' 
        ? (form.fuelSavingLapTime || form.averageLapTime)
        : strategyMode === 'extra-fuel-saving'
          ? (form.extraFuelSavingLapTime || form.averageLapTime)
          : form.averageLapTime
    ) || 103.5;
    
    // Track which stints are being recalculated
    const updatingStints = new Set();
    const changeHistory = new Map();
    
    // Find the index of the changed stint
    let cascadeStartIndex = 0;
    if (changedStintId !== null) {
      const changedIndex = updatedPlan.findIndex(s => s.id === changedStintId);
      if (changedIndex !== -1) {
        cascadeStartIndex = changedIndex;
      }
    }
    
    // First pass: Adjust last stint to match total laps
    let completedLaps = 0;
    const planWithAdjustedLast = updatedPlan.map((stint, idx) => {
      const isLastStint = idx === updatedPlan.length - 1;
      if (isLastStint && totalLaps) {
        const remainingLaps = Math.max(1, totalLaps - completedLaps);
        if (stint.laps !== remainingLaps) {
          updatingStints.add(stint.id);
          changeHistory.set(stint.id, {
            type: 'laps',
            old: stint.laps,
            new: remainingLaps,
          });
        }
        return { ...stint, laps: remainingLaps };
      }
      completedLaps += stint.laps;
      return stint;
    });
    
    // Second pass: Calculate fuel and validate
    let fuelInTank = tankCapacity;
    const recalculated = planWithAdjustedLast.map((stint, idx) => {
      const isFirstStint = idx === 0;
      const isLastStint = idx === planWithAdjustedLast.length - 1;
      const nextStint = !isLastStint ? planWithAdjustedLast[idx + 1] : null;
      
      // Mark this stint as updating if it's downstream from the change
      if (idx >= cascadeStartIndex) {
        updatingStints.add(stint.id);
      }
      
      // Get pit stop config
      const pitStop = stint.pitStop || {
        tireChange: { left: false, right: false, front: false, rear: false },
        driverSwap: false,
        pitWallSide: 'right',
        fuelToAdd: undefined,
      };
      
      // Store old values for comparison
      const oldFuelLeft = stint.fuelLeft;
      const oldFuelToAdd = stint.fuelToAdd;
      const oldFuelTarget = stint.fuelTarget;
      
      // Calculate fuel needed for this stint
      const baseFuelNeeded = stint.laps * fuelPerLap + reservePerStint;
      const fuelNeeded = isFirstStint && formationLapFuel > 0
        ? Math.max(0, baseFuelNeeded - formationLapFuel)
        : baseFuelNeeded;
      const fuelUsed = Math.min(fuelNeeded, fuelInTank);
      const fuelLeft = fuelInTank - fuelUsed;
      
      // Calculate fuel to add at pit stop
      let fuelToAdd = pitStop.fuelToAdd;
      if (fuelToAdd === undefined) {
        if (isLastStint) {
          fuelToAdd = 0;
        } else if (idx === planWithAdjustedLast.length - 2) {
          // Second-to-last stint - splash-and-dash for final stint
          const finalStintFuelNeeded = nextStint.laps * fuelPerLap + reservePerStint;
          fuelToAdd = Math.max(0, finalStintFuelNeeded - fuelLeft);
          fuelToAdd = Math.min(fuelToAdd, tankCapacity - fuelLeft);
        } else {
          // Regular pit stop - fill to full
          fuelToAdd = tankCapacity - fuelLeft;
        }
      }
      
      // Cap fuel to add at maximum possible
      fuelToAdd = Math.min(fuelToAdd, tankCapacity - fuelLeft);
      
      // Calculate fuel available for next stint
      const fuelAtStartOfNext = fuelLeft + fuelToAdd;
      
      // Validate this stint
      const fuelValidation = validateFuelTarget(
        fuelInTank,
        stint.laps,
        reservePerStint,
        formationLapFuel,
        isFirstStint,
        standardFuelPerLap
      );
      
      // Validate sufficiency for this stint
      const sufficiencyValidation = validateFuelSufficiency(
        fuelInTank,
        fuelUsed,
        stint.laps,
        fuelPerLap,
        reservePerStint
      );
      
      // Validate next stint if exists
      let nextStintValidation = null;
      if (nextStint) {
        const nextStintFuelNeeded = nextStint.laps * fuelPerLap + reservePerStint;
        const nextSufficiency = validateFuelSufficiency(
          fuelAtStartOfNext,
          nextStintFuelNeeded,
          nextStint.laps,
          fuelPerLap,
          reservePerStint
        );
        nextStintValidation = nextSufficiency;
      }
      
      // Generate validation messages
      const validation = generateValidationMessages(
        fuelValidation,
        sufficiencyValidation,
        stint.laps
      );
      
      // Add next stint validation if insufficient
      if (nextStintValidation && !nextStintValidation.isSufficient) {
        validation.errors.push({
          level: 'error',
          type: 'next_stint_insufficient',
          message: `Insufficient fuel for next stint (${nextStint.laps} laps)`,
          details: {
            required: nextStintValidation.required,
            available: nextStintValidation.available,
            shortfall: nextStintValidation.shortfall,
            maxLapsPossible: nextStintValidation.maxLapsPossible,
          },
          quickFixes: [
            { type: 'add_fuel', amount: nextStintValidation.shortfall, label: `Add ${roundTo(nextStintValidation.shortfall, 1)} L at this pit stop` },
            { type: 'reduce_next_laps', laps: nextStintValidation.maxLapsPossible, label: `Reduce next stint to ${nextStintValidation.maxLapsPossible} laps` },
          ],
        });
      }
      
      // Track changes for cascade indicator
      if (idx >= cascadeStartIndex && idx > 0) {
        const changes = [];
        if (Math.abs(fuelLeft - (oldFuelLeft || 0)) > 0.01) {
          changes.push({ type: 'fuelLeft', old: oldFuelLeft || 0, new: fuelLeft });
        }
        if (Math.abs(fuelToAdd - (oldFuelToAdd || 0)) > 0.01) {
          changes.push({ type: 'fuelToAdd', old: oldFuelToAdd || 0, new: fuelToAdd });
        }
        if (Math.abs(fuelValidation.targetPerLap - (oldFuelTarget || 0)) > 0.01) {
          changes.push({ type: 'fuelTarget', old: oldFuelTarget || 0, new: fuelValidation.targetPerLap });
        }
        if (changes.length > 0) {
          changeHistory.set(stint.id, changes);
        }
      }
      
      // Calculate pit stop times
      const fuelingTime = fuelToAdd > 0 ? (fuelToAdd / tankCapacity) * 41.1 : 0;
      const tireServiceTime = calculateTireServiceTime(pitStop.tireChange, pitStop.pitWallSide);
      const driverSwapTime = pitStop.driverSwap ? 25 : 0;
      const serviceTime = Math.max(fuelingTime, tireServiceTime, driverSwapTime);
      const perStopLoss = !isLastStint ? pitLaneDelta + serviceTime : 0;
      
      // Update fuel in tank for next stint
      fuelInTank = fuelAtStartOfNext;
      
      // Calculate stint duration
      const stintSeconds = stint.laps * lapSeconds;
      
      return {
        ...stint,
        fuel: fuelUsed,
        fuelLeft: fuelLeft,
        fuelToAdd: fuelToAdd,
        fuelingTime: fuelingTime,
        perStopLoss: perStopLoss,
        stintDuration: stintSeconds,
        pitStop: pitStop,
        fuelTarget: fuelValidation.targetPerLap,
        validation: validation,
        fuelAtStart: fuelInTank - fuelToAdd,
      };
    });
    
    // Trigger cascade visual indicator
    if (updatingStints.size > 0) {
      setCascadeUpdating(updatingStints);
      setCascadeHistory(changeHistory);
      
      // Clear the indicator after animation completes
      setTimeout(() => {
        setCascadeUpdating(new Set());
        setCascadeHistory(new Map());
      }, 1500);
    }
    
    return recalculated;
  };

  const handleStintLapsChange = (stintId, newLaps) => {
    const updatedPlan = stintPlan.map(stint => {
      if (stint.id === stintId) {
        const isLastStint = stint.id === stintPlan[stintPlan.length - 1].id;
        if (isLastStint) return stint;
        
        const validLaps = Math.max(1, Math.min(parseInt(newLaps) || 1, 200));
        return { ...stint, laps: validLaps };
      }
      return stint;
    });
    
    const recalculated = recalculateStintPlan(updatedPlan, stintId);
    setStintPlan(recalculated);
  };

  const handlePitStopChange = (stintId, pitStopData) => {
    const updatedPlan = stintPlan.map(stint => {
      if (stint.id === stintId) {
        return { ...stint, pitStop: pitStopData };
      }
      return stint;
    });
    
    const recalculated = recalculateStintPlan(updatedPlan, stintId);
    setStintPlan(recalculated);
  };

  const handleQuickFix = (stintId, fix) => {
    if (fix.type === 'add_fuel') {
      // Find the pit stop before this stint
      const stintIndex = stintPlan.findIndex(s => s.id === stintId);
      if (stintIndex > 0) {
        const prevStint = stintPlan[stintIndex - 1];
        const currentFuelToAdd = prevStint.pitStop?.fuelToAdd !== undefined ? prevStint.pitStop.fuelToAdd : (prevStint.fuelToAdd || 0);
        const newFuelToAdd = currentFuelToAdd + fix.amount;
        
        handlePitStopChange(prevStint.id, {
          ...prevStint.pitStop,
          fuelToAdd: newFuelToAdd,
        });
      }
    } else if (fix.type === 'reduce_laps') {
      handleStintLapsChange(stintId, fix.laps);
    } else if (fix.type === 'reduce_next_laps') {
      const stintIndex = stintPlan.findIndex(s => s.id === stintId);
      if (stintIndex < stintPlan.length - 1) {
        handleStintLapsChange(stintPlan[stintIndex + 1].id, fix.laps);
      }
    }
  };

  const toggleStintExpansion = (stintId) => {
    const newExpanded = new Set(expandedStints);
    if (newExpanded.has(stintId)) {
      newExpanded.delete(stintId);
    } else {
      newExpanded.clear();
      newExpanded.add(stintId);
    }
    setExpandedStints(newExpanded);
  };

  return (
    <div className="stint-list">
      {/* Add CSS for cascade animation */}
      <style>{`
        @keyframes cascadePulse {
          0% {
            background-color: rgba(56, 189, 248, 0);
            box-shadow: 0 0 0 0 rgba(56, 189, 248, 0);
          }
          50% {
            background-color: rgba(56, 189, 248, 0.15);
            box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.2);
          }
          100% {
            background-color: rgba(56, 189, 248, 0);
            box-shadow: 0 0 0 0 rgba(56, 189, 248, 0);
          }
        }
        
        @keyframes valueChange {
          0% {
            transform: scale(1);
            color: inherit;
          }
          50% {
            transform: scale(1.05);
            color: var(--accent);
          }
          100% {
            transform: scale(1);
            color: inherit;
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        .cascade-updating {
          animation: cascadePulse 1.5s ease-out;
        }
        
        .value-changed {
          animation: valueChange 0.6s ease-out;
        }
      `}</style>
      
      {stintPlan.map((stint, idx) => {
        const isFirstStint = idx === 0;
        const isLastStint = idx === stintPlan.length - 1;
        const nextStint = !isLastStint ? stintPlan[idx + 1] : null;
        const isUpdating = cascadeUpdating.has(stint.id);
        const changes = cascadeHistory.get(stint.id);
        const isExpanded = expandedStints.has(stint.id);
        
        const usableFuel = Math.max(stint.fuel - reservePerStint - (isFirstStint ? formationLapFuel : 0), 0);
        const fuelPerLapTarget = stint.fuelTarget || (stint.laps ? usableFuel / stint.laps : 0);
        const fuelAtStart = idx === 0 
          ? roundTo(safeNumber(form.tankCapacity) || 106, 1)
          : roundTo((stintPlan[idx - 1]?.fuelLeft || 0) + (stintPlan[idx - 1]?.fuelToAdd || 0), 1);

        return (
          <div key={stint.id} style={{ display: 'contents' }}>
            <div 
              className={`stint-item ${isUpdating ? 'cascade-updating' : ''}`}
              style={{
                position: 'relative',
                opacity: stint.validation?.errors.some(e => e.level === 'critical') ? 0.7 : 1,
                border: stint.validation?.errors.length > 0 
                  ? `2px solid ${stint.validation.errors.some(e => e.level === 'critical') ? '#ef4444' : '#ef4444'}`
                  : stint.validation?.warnings.length > 0
                  ? '2px solid #eab308'
                  : '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px',
                transition: 'all 0.3s ease',
              }}
            >
              {/* Cascade indicator badge */}
              {isUpdating && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(56, 189, 248, 0.9)',
                  color: '#fff',
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  zIndex: 10,
                  animation: 'pulse 1.5s ease-out infinite',
                }}>
                  Updating...
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong>Stint {stint.id}</strong>
                    {stint.stintMode === 'extra-fuel-saving' && (
                      <span style={{
                        fontSize: '0.7rem',
                        color: '#f59e0b',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        ⚡ Extra Fuel-Saving
                      </span>
                    )}
                    {isUpdating && (
                      <span style={{ 
                        fontSize: '0.7rem', 
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        <span style={{ 
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          animation: 'pulse 1s ease-out infinite',
                        }} />
                        Recalculating...
                      </span>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Fuel at Start: <span className={changes?.some(c => c.type === 'fuelAtStart') ? 'value-changed' : ''}>
                      {fuelAtStart} L
                    </span>
                  </div>
                  
                  <div className="stint-meta">
                    <span>
                      Laps {stint.startLap}–{stint.endLap} ({stint.laps} lap{stint.laps > 1 ? 's' : ''})
                      {stint.stintMode === 'extra-fuel-saving' && (
                        <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: '#f59e0b' }}>
                          (Extra Fuel-Saving ⚡)
                        </span>
                      )}
                    </span>
                    <span>{formatDuration(stint.stintDuration)}</span>
                  </div>
                  
                  {!isLastStint && (
                    <div style={{ marginTop: 8 }}>
                      <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: 2, display: 'block' }}>
                        Laps
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={stint.laps}
                        onChange={(e) => handleStintLapsChange(stint.id, e.target.value)}
                        style={{ 
                          width: '60px', 
                          padding: '4px 6px', 
                          fontSize: '0.75rem',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          color: 'var(--text)',
                        }}
                      />
                    </div>
                  )}
                  
                  {isLastStint && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      (Auto-adjusted to complete race)
                    </div>
                  )}
                </div>
                
                <FuelTargetDisplay
                  target={fuelPerLapTarget}
                  validation={stint.validation}
                  isFirstStint={isFirstStint}
                  formationLapFuel={formationLapFuel}
                  isUpdating={isUpdating}
                  changes={changes}
                />
              </div>
              
              {/* Show change indicators */}
              {isUpdating && changes && changes.length > 0 && (
                <div style={{
                  marginTop: '8px',
                  padding: '6px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}>
                  {Array.isArray(changes) ? (
                    changes.map((change, cIdx) => (
                      <div key={cIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: 'var(--accent)' }}>→</span>
                        <span>
                          {change.type === 'fuelLeft' && `Fuel left: ${roundTo(change.old, 1)} → ${roundTo(change.new, 1)} L`}
                          {change.type === 'fuelToAdd' && `Fuel to add: ${roundTo(change.old, 1)} → ${roundTo(change.new, 1)} L`}
                          {change.type === 'fuelTarget' && `Target: ${roundTo(change.old, 2)} → ${roundTo(change.new, 2)} L/lap`}
                          {change.type === 'laps' && `Laps: ${change.old} → ${change.new}`}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--accent)' }}>→</span>
                      <span>
                        {changes.type === 'laps' && `Laps: ${changes.old} → ${changes.new}`}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Validation messages */}
              {stint.validation && (
                <ValidationMessage
                  validation={stint.validation}
                  onQuickFix={(fix) => handleQuickFix(stint.id, fix)}
                />
              )}
              
              {/* Expandable details */}
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={() => toggleStintExpansion(stint.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    padding: '4px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide' : 'Show'} details
                </button>
                
                {isExpanded && (
                  <div style={{
                    marginTop: '8px',
                    padding: '12px',
                    background: 'var(--surface-muted)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                  }}>
                    {stint.stintMode && (
                      <div style={{ 
                        marginBottom: '12px', 
                        padding: '6px 8px', 
                        background: stint.stintMode === 'extra-fuel-saving' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                        borderRadius: '4px',
                        border: `1px solid ${stint.stintMode === 'extra-fuel-saving' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                      }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '2px' }}>Mode:</div>
                        <div style={{ 
                          fontWeight: 600,
                          color: stint.stintMode === 'extra-fuel-saving' ? '#f59e0b' : 'var(--accent)',
                        }}>
                          {stint.stintMode === 'extra-fuel-saving' ? '⚡ Extra Fuel-Saving' : 
                           stint.stintMode === 'fuel-saving' ? 'Fuel-Saving' : 
                           'Standard'}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Fuel Used:</div>
                        <div>{roundTo(stint.fuel, 1)} L</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Fuel Left:</div>
                        <div>{roundTo(stint.fuelLeft, 1)} L</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Reserve:</div>
                        <div>{roundTo(reservePerStint, 1)} L</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Usable Fuel:</div>
                        <div>{roundTo(usableFuel, 1)} L</div>
                      </div>
                    </div>
                    
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>
                        Calculation:
                      </div>
                      <div style={{ fontSize: '0.75rem', lineHeight: '1.6' }}>
                        <div>Usable = {roundTo(stint.fuel, 1)} - {roundTo(reservePerStint, 1)} - {isFirstStint && formationLapFuel > 0 ? `${roundTo(formationLapFuel, 1)}` : '0'} = {roundTo(usableFuel, 1)} L</div>
                        <div>Target = {roundTo(usableFuel, 1)} ÷ {stint.laps} = {roundTo(fuelPerLapTarget, 2)} L/lap</div>
                        <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
                          Minimum: {roundTo(getStandardFuelPerLap() * 0.90, 2)} L/lap (90% of {roundTo(getStandardFuelPerLap(), 2)} L/lap)
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Pit Stop Interface (between stints) */}
            {!isLastStint && nextStint && (
              <PitStopInterface
                stint={stint}
                nextStint={nextStint}
                form={form}
                onPitStopChange={(pitStopData) => handlePitStopChange(stint.id, pitStopData)}
                pitStopIndex={stint.id}
                isUpdating={cascadeUpdating.has(stint.id) || cascadeUpdating.has(nextStint.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
