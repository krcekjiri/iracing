const DetailedStintPlanner = ({
  plan,
  form,
  reservePerStint,
  formationLapFuel,
  totalLaps,
  strategyMode = 'standard',
}) => {
  if (!plan?.length) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Enter race details to generate a stint plan.
      </div>
    );
  }

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };

  const roundTo = (n, decimals) => Number(n.toFixed(decimals));

  const safeNumber = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const getModeStyle = (mode) => {
    switch (mode) {
      case 'fuel-saving':
        return { color: '#34d399', label: 'FUEL SAVE', bg: 'rgba(52, 211, 153, 0.08)', border: 'rgba(52, 211, 153, 0.25)', badgeBg: 'rgba(52, 211, 153, 0.15)' };
      case 'extra-fuel-saving':
        return { color: '#a855f7', label: 'EXTRA FUEL SAVE', bg: 'rgba(168, 85, 247, 0.08)', border: 'rgba(168, 85, 247, 0.25)', badgeBg: 'rgba(168, 85, 247, 0.15)' };
      default:
        return { color: '#3b82f6', label: 'STANDARD', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.25)', badgeBg: 'rgba(59, 130, 246, 0.15)' };
    }
  };

  // Icon components (using SVG)
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

  const tankCapacity = safeNumber(form.tankCapacity) || 106;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: '8px', color: '#e2e8f0', fontFamily: 'inherit' }}>
        Stint Plan
      </h2>

      {plan.map((stint, idx) => {
        const isLastStint = idx === plan.length - 1;
        const fuelStart = idx === 0
          ? roundTo(safeNumber(form.tankCapacity) || 106, 2)
          : roundTo((plan[idx - 1]?.fuelLeft || 0) + (plan[idx - 1]?.fuelToAdd || 0), 2);
        
        const usableFuel = Math.max(stint.fuel - reservePerStint - (idx === 0 ? formationLapFuel : 0), 0);
        const perLapDisplay = stint.laps ? (usableFuel / stint.laps).toFixed(2) : '0.00';
        const modeStyle = getModeStyle(stint.stintMode);

        // Pit stop duration calculation
        const fuelToAdd = stint.fuelToAdd || 0;
        const pitLaneDelta = safeNumber(form.pitLaneDeltaSeconds) || 27;
        const fuelingTime = fuelToAdd > 0 ? (fuelToAdd / tankCapacity) * 41.1 : 0;
        const pitStopDuration = Math.round(fuelingTime + pitLaneDelta);

        return (
          <div key={stint.id}>
            {/* Stint Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                background: modeStyle.bg,
                border: `1px solid ${modeStyle.border}`,
                borderRadius: '8px',
                gap: '16px'
              }}
            >
              {/* Stint Badge */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: modeStyle.badgeBg,
                  color: modeStyle.color,
                  border: `1px solid ${modeStyle.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 'var(--font-sm)',
                  flexShrink: 0
                }}
              >
                {stint.id}
              </div>

              {/* Strategy Label */}
              <div style={{ width: '120px', flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 'var(--font-xs)',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    color: modeStyle.color,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {modeStyle.label}
                </span>
              </div>

              {/* Lap Range */}
              <div style={{ width: '70px', flexShrink: 0 }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', fontFamily: 'inherit' }}>
                  Range
                </div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontSize: 'var(--font-sm)', color: '#94a3b8' }}>
                  {stint.startLap}–{stint.endLap}
                </div>
              </div>

              {/* Stint Length */}
              <div style={{ width: '50px', flexShrink: 0 }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', fontFamily: 'inherit' }}>
                  Laps
                </div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontSize: 'var(--font-sm)', color: '#94a3b8' }}>
                  {stint.laps}
                </div>
              </div>

              {/* Duration */}
              <div style={{ width: '80px', flexShrink: 0 }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', fontFamily: 'inherit' }}>
                  Duration
                </div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontSize: 'var(--font-sm)', color: '#94a3b8' }}>
                  {formatDuration(stint.stintDuration || 0)}
                </div>
              </div>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Start Fuel */}
              <div style={{ width: '70px', textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', fontFamily: 'inherit' }}>
                  Start
                </div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontSize: 'var(--font-sm)', color: '#94a3b8' }}>
                  {fuelStart.toFixed(2)}<span style={{ fontSize: '0.65rem', opacity: 0.6, marginLeft: '3px', fontFamily: 'inherit' }}>L</span>
                </div>
              </div>

              {/* End Fuel */}
              <div style={{ width: '70px', textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', fontFamily: 'inherit' }}>
                  End
                </div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontSize: 'var(--font-sm)', color: '#94a3b8' }}>
                  {roundTo(stint.fuelLeft || 0, 2).toFixed(2)}<span style={{ fontSize: '0.65rem', opacity: 0.6, marginLeft: '3px', fontFamily: 'inherit' }}>L</span>
                </div>
              </div>

              {/* Target */}
              <div style={{ width: '85px', textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', fontFamily: 'inherit' }}>
                  Target
                </div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontSize: 'var(--font-sm)', fontWeight: 600, color: '#94a3b8' }}>
                  {perLapDisplay}<span style={{ fontSize: '0.65rem', fontWeight: 400, opacity: 0.7, marginLeft: '3px', fontFamily: 'inherit' }}>L/lap</span>
                </div>
              </div>
            </div>

            {/* Pit Stop */}
            {!isLastStint && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '6px 0',
                  color: '#64748b'
                }}
              >
                <span style={{ fontSize: 'var(--font-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'inherit' }}>
                  Pit Stop {idx + 1}
                </span>
                <FuelIcon />
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontSize: 'var(--font-xs)', color: '#94a3b8' }}>
                  +{roundTo(fuelToAdd, 1)}L
                </span>
                <ClockIcon />
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontSize: 'var(--font-xs)', color: '#94a3b8' }}>
                  {pitStopDuration}s
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
