const DetailedStintPlanner = ({
  plan,
  form,
  reservePerStint,
  formationLapFuel,
  totalLaps,
  strategyMode = 'standard',
}) => {
  if (!plan?.length) {
    return <div className="empty-state">Enter race details to generate a stint plan.</div>;
  }

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };

  const roundTo = (n, decimals) => Number(n.toFixed(decimals));

  const getModeStyle = (mode) => {
    switch (mode) {
      case 'fuel-saving':
        return { color: '#34d399', label: 'FUEL SAVE', bg: 'rgba(52, 211, 153, 0.08)', border: 'rgba(52, 211, 153, 0.25)', badgeBg: 'rgba(52, 211, 153, 0.15)' };
      case 'extra-fuel-saving':
        return { color: '#fbbf24', label: 'EXTRA FUEL SAVE', bg: 'rgba(251, 191, 36, 0.08)', border: 'rgba(251, 191, 36, 0.25)', badgeBg: 'rgba(251, 191, 36, 0.15)' };
      default:
        return { color: '#3b82f6', label: 'STANDARD', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.25)', badgeBg: 'rgba(59, 130, 246, 0.15)' };
    }
  };

  // Simple icon components (using SVG)
  const FlagIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );

  const ClockIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );

  const FuelIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
      <path d="M3 2v20h18V2z" />
      <path d="M7 6h10" />
      <path d="M7 10h10" />
      <path d="M7 14h10" />
    </svg>
  );

  const tankCapacity = Number(form.tankCapacity) || 100;

  return (
    <div>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '16px', color: '#e2e8f0' }}>
        Stint Plan
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {plan.map((stint, idx) => {
          const isLastStint = idx === plan.length - 1;
          // Calculate fuel at start: first stint uses tank - formation fuel, others use tank capacity
          const fuelStart = idx === 0 
            ? roundTo(tankCapacity - (formationLapFuel || 0), 2)
            : roundTo(tankCapacity, 2);
          
          const perLapDisplay = stint.laps > 0 ? (stint.fuel / stint.laps).toFixed(2) : '0.00';
          const modeStyle = getModeStyle(stint.stintMode);

          return (
            <div key={stint.id} style={{ position: 'relative' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  background: modeStyle.bg,
                  border: `1px solid ${modeStyle.border}`,
                  gap: '16px'
                }}
              >
                {/* Stint Badge */}
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    background: modeStyle.badgeBg,
                    color: modeStyle.color,
                    border: `1px solid ${modeStyle.border}`,
                    flexShrink: 0
                  }}
                >
                  {stint.id}
                </div>

                {/* Strategy Label */}
                <div style={{ width: '120px', flexShrink: 0 }}>
                  <span 
                    style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 600, 
                      letterSpacing: '0.05em',
                      color: modeStyle.color, 
                      whiteSpace: 'nowrap' 
                    }}
                  >
                    {modeStyle.label}
                  </span>
                </div>

                {/* Laps */}
                <div style={{ width: '70px', flexShrink: 0 }}>
                  <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Laps</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                    <FlagIcon />
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {stint.startLap}–{stint.endLap}
                    </span>
                  </div>
                </div>

                {/* Duration */}
                <div style={{ width: '80px', flexShrink: 0 }}>
                  <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Duration</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
                    <ClockIcon />
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {formatDuration(stint.stintDuration || 0)}
                    </span>
                  </div>
                </div>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Start */}
                <div style={{ width: '70px', textAlign: 'right' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Start</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#94a3b8' }}>
                    {fuelStart.toFixed(2)}<span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '3px' }}>L</span>
                  </div>
                </div>

                {/* End */}
                <div style={{ width: '70px', textAlign: 'right' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>End</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#94a3b8' }}>
                    {roundTo(stint.fuelLeft || 0, 2).toFixed(2)}<span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '3px' }}>L</span>
                  </div>
                </div>

                {/* Target */}
                <div style={{ width: '85px', textAlign: 'right' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Target</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: '#34d399' }}>
                    {perLapDisplay}<span style={{ fontSize: '9px', fontWeight: 400, opacity: 0.7, marginLeft: '3px' }}>L/lap</span>
                  </div>
                </div>
              </div>

              {/* Pit Stop */}
              {!isLastStint && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '6px 0', color: '#64748b' }}>
                  <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pit Stop {idx + 1}</span>
                  <FuelIcon />
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>+{roundTo(stint.fuelToAdd || 0, 1)}L</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
