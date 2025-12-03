// ==================== STINT PLAN CARD ====================
// Updated: Compact Grid Layout, Aligned Columns, Crisper UI

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
      
      // Calculate tire service time if tires are changed
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
      
      // Update fuel in tank for next stint
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
    <div className="stint-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {reorderedPlan.map((stint, idx) => {
        const isFirstStint = idx === 0;
        const isLastStint = idx === reorderedPlan.length - 1;
        const nextStint = !isLastStint ? reorderedPlan[idx + 1] : null;
        const usableFuel = Math.max(stint.fuel - reservePerStint - (isFirstStint ? formationLapFuel : 0), 0);
        const fuelPerLapTarget = stint.laps ? usableFuel / stint.laps : 0;
        const perLapDisplay = fuelPerLapTarget.toFixed(2);
        
        // Calculate Fuel Start for display
        const fuelStart = idx === 0 
          ? roundTo(safeNumber(form.tankCapacity) || 106, 1) 
          : roundTo((reorderedPlan[idx - 1]?.fuelLeft || 0) + (reorderedPlan[idx - 1]?.fuelToAdd || 0), 1);

        return (
          <div key={stint.id} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Main Stint Card */}
            <div
              className="stint-item"
              style={{
                display: 'grid',
                // Grid: Info | Start | Target | Left
                gridTemplateColumns: 'minmax(140px, 2fr) 1fr 1fr 1fr',
                gap: '12px',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                position: 'relative'
              }}
            >
              {/* Col 1: Stint Info */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>
                  Stint {stint.id}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Laps {stint.startLap}–{stint.endLap} ({stint.laps})</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span>{formatDuration(stint.stintDuration)}</span>
                </div>
              </div>

              {/* Col 2: Start Fuel */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '2px' }}>Start</div>
                <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {fuelStart} L
                </div>
              </div>

              {/* Col 3: Target/Lap (Highlighted) */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '2px' }}>Target</div>
                <div style={{ fontFamily: 'monospace', color: '#34d399', fontSize: '1.1rem', fontWeight: 700 }}>
                  {perLapDisplay}
                  <span style={{ fontSize: '0.75rem', fontWeight: 400, marginLeft: '2px', opacity: 0.8 }}>L</span>
                </div>
              </div>

              {/* Col 4: Fuel Left */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '2px' }}>Left</div>
                <div style={{ fontFamily: 'monospace', color: stint.fuelLeft < 2 ? '#f87171' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {roundTo(stint.fuelLeft, 1)} L
                </div>
              </div>
            </div>
            
            {/* Pit Stop Interface (between stints) */}
            {!isLastStint && nextStint && (
              <div style={{ padding: '0 8px' }}>
                <PitStopInterface
                  stint={stint}
                  nextStint={nextStint}
                  form={form}
                  onPitStopChange={(pitStopData) => {
                    const updatedPlan = [...reorderedPlan];
                    updatedPlan[idx].pitStop = pitStopData;
                    const recalculated = recalculateStintPlan(updatedPlan, form, reservePerStint, formationLapFuel);
                    setReorderedPlan(recalculated);
                    if (onReorder) {
                      onReorder(recalculated);
                    }
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
