const FuelTargetDisplay = ({ target, validation, isFirstStint, formationLapFuel, isUpdating, changes }) => {
  const hasError = validation?.errors.some(e => e.type === 'target_below_minimum' || e.type === 'insufficient_fuel');
  const hasWarning = validation?.warnings.some(w => w.type === 'aggressive_target');
  const targetChanged = changes?.some(c => c.type === 'fuelTarget');
  
  let color = 'var(--text)';
  let icon = null;
  
  if (hasError) {
    color = '#ef4444';
    icon = '❌';
  } else if (hasWarning) {
    color = '#eab308';
    icon = '⚠️';
  }
  
  return (
    <div style={{ textAlign: 'right' }}>
      <span className="stat-label">Fuel Target / Lap</span>
      <div 
        className={`stat-value ${targetChanged ? 'value-changed' : ''}`}
        style={{ 
          fontSize: '1.2rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-end', 
          gap: '4px',
          color: color,
        }}
      >
        {target.toFixed(2)} L {icon}
        {isUpdating && (
          <span style={{ 
            fontSize: '0.7rem',
            color: 'var(--accent)',
            marginLeft: '4px',
          }}>
            ⚡
          </span>
        )}
        <span className="help-badge" tabIndex={0}>
          <span className="help-icon" style={{ fontSize: '0.7rem' }}>ℹ</span>
          <span className="help-tooltip">
            Target fuel consumption per lap. {isFirstStint && formationLapFuel > 0 ? `Formation lap fuel (${roundTo(formationLapFuel, 1)} L) is already accounted for.` : 'Based on usable fuel and number of laps.'}
          </span>
        </span>
      </div>
      {hasError && (
        <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '2px' }}>
          Below minimum
        </div>
      )}
      {hasWarning && (
        <div style={{ fontSize: '0.7rem', color: '#eab308', marginTop: '2px' }}>
          Aggressive
        </div>
      )}
      {targetChanged && (
        <div style={{ fontSize: '0.65rem', color: 'var(--accent)', marginTop: '2px' }}>
          Updated
        </div>
      )}
    </div>
  );
};
