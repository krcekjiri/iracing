// ==================== STINT PLAN CARD ====================
// Updated: Visual improvements with connector lines, stint badges, and better layout

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
    return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Enter race details to generate a stint plan.</div>;
  }

  // Recalculate all stint data - ensure subsequent stints respect fuel added
  const recalculateStintPlan = (newPlan, form, reservePerStint, formationLapFuel) => {
    const tankCapacity = safeNumber(form.tankCapacity) || 106;
    const fuelPerLap = safeNumber(form.fuelPerLap) || 3.18;
    const pitLaneDelta = safeNumber(form.pitLaneDeltaSeconds) || 27;
    const lapSeconds = parseLapTime(form.averageLapTime) || 103.5;
    
    let fuelInTank = tankCapacity;
    
    return newPlan.map((stint, idx) => {
      const isFirstStint = idx === 0;
      const isLastStint = idx === newPlan.length - 1;
      
      let fuelToAdd = stint.fuelToAdd;
      if (fuelToAdd === undefined && !isLastStint) {
        const baseFuelNeeded = stint.laps * fuelPerLap + reservePerStint;
        const fuelNeeded = isFirstStint && formationLapFuel > 0
          ? Math.max(0, baseFuelNeeded - formationLapFuel)
          : baseFuelNeeded;
        const fuelUsed = Math.min(fuelNeeded, fuelInTank);
        const fuelLeft = fuelInTank - fuelUsed;
        const nextStintFuelNeeded = newPlan[idx + 1].laps * fuelPerLap + reservePerStint;
        fuelToAdd = Math.max(0, nextStintFuelNeeded - fuelLeft);
        fuelToAdd = Math.min(fuelToAdd, tankCapacity);
      } else if (fuelToAdd === undefined) {
        fuelToAdd = 0;
      }
      
      const baseFuelNeeded = stint.laps * fuelPerLap + reservePerStint;
      const fuelNeeded = isFirstStint && formationLapFuel > 0
        ? Math.max(0, baseFuelNeeded - formationLapFuel)
        : baseFuelNeeded;
      const fuelUsed = Math.min(fuelNeeded, fuelInTank);
      const fuelLeft = fuelInTank - fuelUsed;
      
      const fuelingTime = fuelToAdd > 0 ? (fuelToAdd / tankCapacity) * 41.1 : 0;
      
      const pitStop = stint.pitStop || {
        tireChange: { left: false, right: false, front: false, rear: false },
        driverSwap: false,
        pitWallSide: 'left',
        fuelToAdd: fuelToAdd,
      };
      if (pitStop.fuelToAdd === undefined) pitStop.fuelToAdd = fuelToAdd;
      
      // Calculate Service Time (simplified logic for UI responsiveness)
      let tireServiceTime = 0;
      const tc = pitStop.tireChange || {};
      if (tc.left || tc.right || tc.front || tc.rear) tireServiceTime = 25; // Simple approximation
      
      const driverSwapTime = pitStop.driverSwap ? 25 : 0;
      const serviceTime = Math.max(fuelingTime, tireServiceTime, driverSwapTime);
      const perStopLoss = !isLastStint ? pitLaneDelta + serviceTime : 0;
      
      const actualFuelToAdd = pitStop.fuelToAdd !== undefined ? pitStop.fuelToAdd : fuelToAdd;
      fuelInTank = fuelLeft + actualFuelToAdd;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
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
          <div key={stint.id} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Connector Line */}
            {!isLastStint && (
              <div style={{
                position: 'absolute',
                left: '24px',
                top: '50px',
                bottom: '-10px',
                width: '2px',
                background: 'var(--border)',
                zIndex: 0
              }} />
            )}

            {/* Main Stint Card */}
            <div
              style={{
                display: 'grid',
                // More fixed-width first column, equal width others
                gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                gap: '12px',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                position: 'relative',
                zIndex: 5
              }}
            >
              {/* Col 1: Stint Info */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    background: '#3b82f6', 
                    color: '#fff', 
                    fontSize: '0.7rem', 
                    padding: '2px 6px', 
                    borderRadius: '4px' 
                  }}>
                    S{stint.id}
                  </span>
                  {/* Simplified mode label */}
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {stint.stintMode === 'fuel-saving' ? 'Fuel Save' : 'Standard'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: 'monospace' }}>L{stint.startLap}→L{stint.endLap}</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span>{formatDuration(stint.stintDuration)}</span>
                </div>
              </div>

              {/* Col 2: Start Fuel */}
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '2px' }}>Start</div>
                <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '1rem' }}>
                  {fuelStart}<span style={{ fontSize: '0.75rem', marginLeft: '2px' }}>L</span>
                </div>
              </div>

              {/* Col 3: Target/Lap (Highlighted) */}
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '2px' }}>Target</div>
                <div style={{ fontFamily: 'monospace', color: '#34d399', fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>
                  {perLapDisplay}
                  <span style={{ fontSize: '0.75rem', fontWeight: 400, marginLeft: '2px', opacity: 0.8, color: '#34d399' }}>L/LAP</span>
                </div>
              </div>

              {/* Col 4: Fuel Left */}
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '2px' }}>End</div>
                <div style={{ fontFamily: 'monospace', color: stint.fuelLeft < 2 ? '#f87171' : 'var(--text-muted)', fontSize: '1rem' }}>
                  {roundTo(stint.fuelLeft, 1)}<span style={{ fontSize: '0.75rem', marginLeft: '2px' }}>L</span>
                </div>
              </div>
            </div>
            
            {/* Pit Stop Interface (between stints) */}
            {!isLastStint && nextStint && (
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
            )}
          </div>
        );
      })}
    </div>
  );
};
