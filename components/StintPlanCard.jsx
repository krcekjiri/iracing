const StintPlanCard = ({
  plan,
  reservePerStint = 0,
  formationLapFuel = 0,
  form,
  onReorder,
}) => {
  const [reorderedPlan, setReorderedPlan] = useState(plan);
  
  useEffect(() => {
    setReorderedPlan(plan);
  }, [plan]);
  
  if (!plan?.length) {
    return <div className="empty-state">Enter race details to generate a stint plan.</div>;
  }

  // Drag and drop removed - stints are no longer reorderable

  // Recalculate all stint data - ensure subsequent stints respect fuel added
  const recalculateStintPlan = (newPlan, form, reservePerStint, formationLapFuel) => {
    const tankCapacity = safeNumber(form.tankCapacity) || 106;
    const fuelPerLap = safeNumber(form.fuelPerLap) || 3.18;
    const pitLaneDelta = safeNumber(form.pitLaneDeltaSeconds) || 27;
    const lapSeconds = parseLapTime(form.averageLapTime) || 103.5;
    
    let fuelInTank = tankCapacity; // Start with full tank
    
    return newPlan.map((stint, idx) => {
      const isFirstStint = idx === 0;
      const isLastStint = idx === newPlan.length - 1;
      
      // Use fuelToAdd from pit stop configuration if it exists, otherwise calculate
      let fuelToAdd = stint.fuelToAdd;
      if (fuelToAdd === undefined && !isLastStint) {
        // Calculate fuel needed for this stint
        const baseFuelNeeded = stint.laps * fuelPerLap + reservePerStint;
        const fuelNeeded = isFirstStint && formationLapFuel > 0
          ? Math.max(0, baseFuelNeeded - formationLapFuel)
          : baseFuelNeeded;
        const fuelUsed = Math.min(fuelNeeded, fuelInTank);
        const fuelLeft = fuelInTank - fuelUsed;
        
        // Calculate fuel to add at next pit stop
        const nextStintFuelNeeded = newPlan[idx + 1].laps * fuelPerLap + reservePerStint;
        fuelToAdd = Math.max(0, nextStintFuelNeeded - fuelLeft);
        fuelToAdd = Math.min(fuelToAdd, tankCapacity);
      } else if (fuelToAdd === undefined) {
        fuelToAdd = 0;
      }
      
      // Calculate fuel needed for this stint
      const baseFuelNeeded = stint.laps * fuelPerLap + reservePerStint;
      const fuelNeeded = isFirstStint && formationLapFuel > 0
        ? Math.max(0, baseFuelNeeded - formationLapFuel)
        : baseFuelNeeded;
      const fuelUsed = Math.min(fuelNeeded, fuelInTank);
      const fuelLeft = fuelInTank - fuelUsed;
      
      // Calculate fueling time
      const fuelingTime = fuelToAdd > 0 ? (fuelToAdd / tankCapacity) * 41.1 : 0;
      
      // Get pit stop configuration if exists
      const pitStop = stint.pitStop || {
        tireChange: { left: false, right: false, front: false, rear: false },
        driverSwap: false,
        pitWallSide: 'left',
        fuelToAdd: fuelToAdd,
      };
      
      // Ensure fuelToAdd is in pit stop config
      if (pitStop.fuelToAdd === undefined) {
        pitStop.fuelToAdd = fuelToAdd;
      }
      
      // Calculate tire service time if tires are changed (using exact pit stop modelling logic)
      const pitWallIsRight = pitStop.pitWallSide === 'left' ? false : true;
      const wallCorners = pitWallIsRight ? ['RF', 'RR'] : ['LF', 'LR'];
      const frontCorners = ['LF', 'RF'];
      const rearCorners = ['LR', 'RR'];
      
      const selectedCorners = {};
      if (pitStop.tireChange.left) { selectedCorners['LF'] = true; selectedCorners['LR'] = true; }
      if (pitStop.tireChange.right) { selectedCorners['RF'] = true; selectedCorners['RR'] = true; }
      if (pitStop.tireChange.front) { selectedCorners['LF'] = true; selectedCorners['RF'] = true; }
      if (pitStop.tireChange.rear) { selectedCorners['LR'] = true; selectedCorners['RR'] = true; }
      
      const selectedCornerKeys = Object.keys(selectedCorners);
      const selectedCount = selectedCornerKeys.length;
      
      let tireServiceTime = 0;
      if (selectedCount > 0) {
        const frontsSelectedOnly = frontCorners.every((corner) => selectedCorners[corner]) && !rearCorners.some((corner) => selectedCorners[corner]);
        const rearsSelectedOnly = rearCorners.every((corner) => selectedCorners[corner]) && !frontCorners.some((corner) => selectedCorners[corner]);
        if (frontsSelectedOnly) {
          tireServiceTime = 10.5;
        } else if (rearsSelectedOnly) {
          tireServiceTime = 12;
        } else {
          tireServiceTime = selectedCornerKeys.reduce((total, corner) => {
            const wallCorner = wallCorners.includes(corner);
            return total + (wallCorner ? 5.5 : 7);
          }, 0);
        }
      }
      
      const driverSwapTime = pitStop.driverSwap ? 25 : 0;
      const serviceTime = Math.max(fuelingTime, tireServiceTime, driverSwapTime);
      const perStopLoss = !isLastStint ? pitLaneDelta + serviceTime : 0;
      
      // Update fuel in tank for next stint - CRITICAL: use fuelToAdd from pit stop config
      const actualFuelToAdd = pitStop.fuelToAdd !== undefined ? pitStop.fuelToAdd : fuelToAdd;
      fuelInTank = fuelLeft + actualFuelToAdd;
      
      // Calculate stint duration
      const stintSeconds = stint.laps * lapSeconds;
      
      return {
        ...stint,
        fuel: fuelUsed,
        fuelLeft: fuelLeft,
        fuelToAdd: actualFuelToAdd,
        fuelingTime: fuelingTime,
        perStopLoss: perStopLoss,
        stintDuration: stintSeconds,
        pitStop: pitStop,
      };
    });
  };

  return (
    <div className="stint-list">
      {reorderedPlan.map((stint, idx) => {
        const isFirstStint = idx === 0;
        const isLastStint = idx === reorderedPlan.length - 1;
        const nextStint = !isLastStint ? reorderedPlan[idx + 1] : null;
        const usableFuel = Math.max(stint.fuel - reservePerStint - (isFirstStint ? formationLapFuel : 0), 0);
        const fuelPerLapTarget = stint.laps ? usableFuel / stint.laps : 0;
        const perLapDisplay = fuelPerLapTarget.toFixed(2);

        return (
          <div key={stint.id} style={{ display: 'contents' }}>
            <div
              className="stint-item"
            >
              <div>
                <strong>Stint {stint.id}</strong>
                {/* Add fuel tank at start */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '4px' }}>
                  Fuel at Start: {idx === 0 ? roundTo(safeNumber(form.tankCapacity) || 106, 1) : roundTo((reorderedPlan[idx - 1]?.fuelLeft || 0) + (reorderedPlan[idx - 1]?.fuelToAdd || 0), 1)} L
                </div>
                <div className="stint-meta">
                  <span>
                    Laps {stint.startLap}–{stint.endLap} ({stint.laps} lap
                    {stint.laps > 1 ? 's' : ''})
                  </span>
                  <span>{formatDuration(stint.stintDuration)}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="stat-label">Fuel Target / Lap</span>
                <div className="stat-value" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  {perLapDisplay} L
                  {/* Move tooltip here and explain formation lap */}
                  <span className="help-badge" tabIndex={0}>
                    <span className="help-icon" style={{ fontSize: '0.7rem' }}>ℹ</span>
                    <span className="help-tooltip">
                      Target fuel consumption per lap. {isFirstStint && formationLapFuel > 0 ? `Formation lap fuel (${roundTo(formationLapFuel, 1)} L) is already accounted for in this calculation.` : 'Based on usable fuel and number of laps.'}
                    </span>
                  </span>
                </div>
                {stint.fuelLeft !== undefined && (
                  <div className="stat-label" style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                    Fuel Left: {roundTo(stint.fuelLeft, 1)} L
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
                onPitStopChange={(pitStopData) => {
                  // Update pit stop data and recalculate
                  const updatedPlan = [...reorderedPlan];
                  updatedPlan[idx].pitStop = pitStopData;
                  const recalculated = recalculateStintPlan(updatedPlan, form, reservePerStint, formationLapFuel);
                  setReorderedPlan(recalculated);
                  if (onReorder) {
                    onReorder(recalculated);
                  }
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
