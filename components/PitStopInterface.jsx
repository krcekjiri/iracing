const PitStopInterface = ({ stint, nextStint, form, onPitStopChange, pitStopIndex, isUpdating = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fuelToAdd, setFuelToAdd] = useState(stint.fuelToAdd || 0);
  const [tireChange, setTireChange] = useState(stint.pitStop?.tireChange || {
    left: false,
    right: false,
    front: false,
    rear: false,
  });
  const [driverSwap, setDriverSwap] = useState(stint.pitStop?.driverSwap || false);
  const [pitWallSide, setPitWallSide] = useState(stint.pitStop?.pitWallSide || 'left');
  
  // Calculate pit stop times using EXACT same logic as Pit Stop Modelling
  const tankCapacity = safeNumber(form.tankCapacity) || 106;
  const pitWallIsRight = pitWallSide === 'right';
  const wallCorners = pitWallIsRight ? ['RF', 'RR'] : ['LF', 'LR'];
  const frontCorners = ['LF', 'RF'];
  const rearCorners = ['LR', 'RR'];
  
  // Convert tireChange object to corner format used in pit stop modelling
  const selectedCorners = {};
  if (tireChange.left) { selectedCorners['LF'] = true; selectedCorners['LR'] = true; }
  if (tireChange.right) { selectedCorners['RF'] = true; selectedCorners['RR'] = true; }
  if (tireChange.front) { selectedCorners['LF'] = true; selectedCorners['RF'] = true; }
  if (tireChange.rear) { selectedCorners['LR'] = true; selectedCorners['RR'] = true; }
  
  const selectedCornerKeys = Object.keys(selectedCorners);
  const selectedCount = selectedCornerKeys.length;
  
  // Calculate tire service time EXACTLY as in pit stop modelling
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
  
  // Calculate fueling time
  const fuelingTime = fuelToAdd > 0 ? (fuelToAdd / tankCapacity) * 41.1 : 0;
  const driverSwapTime = driverSwap ? 25 : 0;
  const serviceTime = Math.max(fuelingTime, tireServiceTime, driverSwapTime);
  const pitLaneDelta = safeNumber(form.pitLaneDeltaSeconds) || 27;
  const totalPitTime = serviceTime + pitLaneDelta;
  const bottleneck = serviceTime === fuelingTime ? 'fuel' : 
                     serviceTime === tireServiceTime ? 'tires' : 'driver';
  
  const handleChange = (updates) => {
    const newData = { fuelToAdd, tireChange, driverSwap, pitWallSide, ...updates };
    onPitStopChange(newData);
  };
  
  return (
    <div style={{
      margin: '8px 0',
      padding: '12px',
      background: 'rgba(56, 189, 248, 0.05)',
      borderRadius: '6px',
      border: '1px solid rgba(56, 189, 248, 0.15)',
    }}>
      {/* Compact Header - Always Visible */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          cursor: 'pointer',
          marginBottom: isExpanded ? '12px' : '0'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>
          Pit Stop {pitStopIndex}
          {isUpdating && (
            <span style={{ 
              marginLeft: '8px',
              fontSize: '0.7rem',
              color: 'var(--accent)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span style={{ 
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'pulse 1s ease-out infinite',
              }} />
              Updating...
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent)' }}>
            {roundTo(totalPitTime, 1)}s
          </div>
          <div style={{ 
            fontSize: '0.7rem',
            color: bottleneck === 'fuel' ? '#0ea5e9' : 
                   bottleneck === 'tires' ? '#f59e0b' : '#10b981',
            fontWeight: 600
          }}>
            {bottleneck === 'fuel' ? '⛽' : bottleneck === 'tires' ? '🛞' : '👤'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {isExpanded ? '▼' : '▶'}
          </div>
        </div>
      </div>
      
      {/* Expanded Configuration - Only when clicked */}
      {isExpanded && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(56, 189, 248, 0.1)'
        }}>
          {/* Left Column - Compact Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                Fuel (L)
              </label>
              <input
                type="number"
                defaultValue={fuelToAdd || ''}
                onBlur={(e) => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                  setFuelToAdd(val);
                  handleChange({ fuelToAdd: val });
                }}
                style={{ 
                  width: '100%', 
                  padding: '6px 8px', 
                  fontSize: '0.85rem',
                  background: 'var(--surface)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '4px' 
                }}
              />
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {roundTo(fuelingTime, 1)}s
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                Tires
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {['left', 'right', 'front', 'rear'].map(side => (
                  <label key={side} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    fontSize: '0.75rem'
                  }}>
                    <input
                      type="checkbox"
                      checked={tireChange[side]}
                      onChange={(e) => {
                        const newTireChange = { ...tireChange, [side]: e.target.checked };
                        setTireChange(newTireChange);
                        handleChange({ tireChange: newTireChange });
                      }}
                      style={{ width: '14px', height: '14px' }}
                    />
                    {side.charAt(0).toUpperCase() + side.slice(1)}
                  </label>
                ))}
              </div>
              <div style={{ marginTop: '6px' }}>
                <select
                  value={pitWallSide}
                  onChange={(e) => {
                    setPitWallSide(e.target.value);
                    handleChange({ pitWallSide: e.target.value });
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '4px 6px', 
                    fontSize: '0.75rem',
                    background: 'var(--surface)', 
                    border: '1px solid var(--border)', 
                    borderRadius: '4px' 
                  }}
                >
                  <option value="left">Pit Wall: Left</option>
                  <option value="right">Pit Wall: Right</option>
                </select>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {roundTo(tireServiceTime, 1)}s
              </div>
            </div>
            
            <div>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontSize: '0.75rem'
              }}>
                <input
                  type="checkbox"
                  checked={driverSwap}
                  onChange={(e) => {
                    setDriverSwap(e.target.checked);
                    handleChange({ driverSwap: e.target.checked });
                  }}
                  style={{ width: '14px', height: '14px' }}
                />
                Driver Swap
              </label>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {driverSwapTime > 0 ? '25s' : 'Not selected'}
              </div>
            </div>
          </div>
          
          {/* Right Column - Compact Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
            <div style={{ 
              padding: '8px',
              background: bottleneck === 'fuel' ? 'rgba(14, 165, 233, 0.1)' :
                         bottleneck === 'tires' ? 'rgba(245, 158, 11, 0.1)' :
                         'rgba(16, 185, 129, 0.1)',
              borderRadius: '4px',
              border: `1px solid ${bottleneck === 'fuel' ? 'rgba(14, 165, 233, 0.3)' :
                              bottleneck === 'tires' ? 'rgba(245, 158, 11, 0.3)' :
                              'rgba(16, 185, 129, 0.3)'}`
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                Service Time
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                {roundTo(serviceTime, 1)}s
              </div>
            </div>
            
            <div style={{ padding: '8px', background: 'var(--surface-muted)', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                Total Pit Stop
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent)' }}>
                {roundTo(totalPitTime, 1)}s
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Service + Lane ({pitLaneDelta}s)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
