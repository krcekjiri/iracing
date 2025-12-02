const ValidationMessage = ({ validation, onQuickFix }) => {
  if (!validation || (validation.errors.length === 0 && validation.warnings.length === 0)) {
    return null;
  }
  
  return (
    <div style={{ marginTop: '8px' }}>
      {validation.errors.map((error, idx) => (
        <div
          key={idx}
          style={{
            padding: '10px',
            background: error.level === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${error.level === 'critical' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '6px',
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '1rem' }}>
              {error.level === 'critical' ? '🚫' : '❌'}
            </span>
            <strong style={{ color: 'var(--text)' }}>{error.message}</strong>
          </div>
          
          {error.details && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              {error.type === 'insufficient_fuel' && (
                <div>
                  <div>Required: {roundTo(error.details.required, 1)} L</div>
                  <div>Available: {roundTo(error.details.available, 1)} L</div>
                  <div>Shortfall: {roundTo(error.details.shortfall, 1)} L</div>
                  <div>Maximum laps possible: {error.details.maxLapsPossible} laps</div>
                </div>
              )}
              {error.type === 'target_below_minimum' && (
                <div>
                  <div>Target: {roundTo(error.details.target, 2)} L/lap</div>
                  <div>Minimum: {roundTo(error.details.minimum, 2)} L/lap (90% of standard)</div>
                  <div>Shortfall: {roundTo(error.details.shortfallPerLap, 2)} L/lap</div>
                  <div>Total shortfall: {roundTo(error.details.totalShortfall, 1)} L</div>
                </div>
              )}
              {error.type === 'next_stint_insufficient' && (
                <div>
                  <div>Required: {roundTo(error.details.required, 1)} L</div>
                  <div>Available: {roundTo(error.details.available, 1)} L</div>
                  <div>Shortfall: {roundTo(error.details.shortfall, 1)} L</div>
                  <div>Maximum laps possible: {error.details.maxLapsPossible} laps</div>
                </div>
              )}
            </div>
          )}
          
          {error.quickFixes && error.quickFixes.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {error.quickFixes.map((fix, fixIdx) => (
                <button
                  key={fixIdx}
                  onClick={() => onQuickFix && onQuickFix(fix)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {fix.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      
      {validation.warnings.map((warning, idx) => (
        <div
          key={idx}
          style={{
            padding: '8px',
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '6px',
            marginBottom: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚠️</span>
            <span style={{ fontSize: '0.85rem' }}>{warning.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
