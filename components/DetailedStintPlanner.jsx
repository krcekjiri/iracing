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

  // Derive pit stops from stint plan
  const pitStops = plan
    .slice(0, -1) // All stints except the last one
    .map((stint, idx) => ({
      afterStint: stint.id,
      fuelAdded: stint.fuelToAdd || 0,
      totalTime: stint.perStopLoss || 0,
      isSplash: stint.isSplash || false,
    }));

  const totalLapsCount = plan.reduce((sum, s) => sum + s.laps, 0);

  return (
    <div className="enhanced-stint-planner">
      {/* Header */}
      <div className="stint-planner-header">
        <h2 className="stint-planner-title">Stint Plan</h2>
        <div className="stint-planner-subtitle">
          {plan.length} stints · {totalLapsCount} laps
        </div>
      </div>

      {/* Stint List */}
      <div className="stint-list-container">
        {plan.map((stint, idx) => (
          <div key={stint.id}>
            <StintCard stint={stint} isLast={idx === plan.length - 1} />
            {idx < plan.length - 1 && pitStops[idx] && (
              <PitStopConnector pitStop={pitStops[idx]} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const StintCard = ({ stint, isLast }) => {
  const config = stintModeConfig[stint.stintMode] || stintModeConfig.standard;
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className="stint-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: config.gradient,
        borderColor: config.borderColor,
        '--accent-color': config.accentColor,
        '--badge-bg': config.badgeBg,
        transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
        boxShadow: isHovered
          ? `0 8px 24px ${config.accentColor}15`
          : '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      {/* Mode Badge */}
      <div className="stint-mode-badge" style={{ borderColor: config.borderColor }}>
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </div>

      {/* Stint Number */}
      <div className="stint-number">{stint.id}</div>

      {/* Main Content */}
      <div className="stint-card-content">
        {/* Lap Info */}
        <div className="stint-lap-info">
          <div className="stint-lap-range">
            Laps {stint.startLap} – {stint.endLap}
          </div>
          <div className="stint-lap-details">
            {stint.laps} laps · {formatDuration(stint.stintDuration)}
          </div>
        </div>

        {/* Fuel Stats - Start, End, Target */}
        <div className="stint-fuel-stats">
          <div className="fuel-stat">
            <div className="fuel-stat-label">Start</div>
            <div className="fuel-stat-value">
              {roundTo(stint.fuelAtStart || 0, 1)}
              <span className="fuel-stat-unit">L</span>
            </div>
          </div>

          <div className="fuel-stat">
            <div className="fuel-stat-label">End</div>
            <div className="fuel-stat-value">
              {roundTo(stint.fuelLeft || 0, 2)}
              <span className="fuel-stat-unit">L</span>
            </div>
          </div>

          <div className="fuel-stat">
            <div className="fuel-stat-label">Target</div>
            <div className="fuel-stat-value fuel-stat-target" style={{ color: config.accentColor }}>
              {roundTo(stint.fuelTarget || 0, 2)}
              <span className="fuel-stat-unit"> L/lap</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PitStopConnector = ({ pitStop }) => (
  <div className="pit-stop-connector">
    {/* Vertical line */}
    <div className="pit-stop-line" />

    {/* Pit info */}
    <div className="pit-stop-info">
      <span className="pit-stop-fuel">+{roundTo(pitStop.fuelAdded || 0, 1)}L</span>
      {pitStop.isSplash && (
        <span className="pit-stop-splash">Splash</span>
      )}
      <span className="pit-stop-time">{Math.round(pitStop.totalTime || 0)}s</span>
    </div>
  </div>
);

// Stint mode configuration
const stintModeConfig = {
  standard: {
    label: 'Standard',
    icon: '🏎️',
    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.04) 100%)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    accentColor: '#3b82f6',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
  },
  'fuel-saving': {
    label: 'Fuel Saving',
    icon: '🌿',
    gradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(22, 163, 74, 0.04) 100%)',
    borderColor: 'rgba(34, 197, 94, 0.35)',
    accentColor: '#22c55e',
    badgeBg: 'rgba(34, 197, 94, 0.15)',
  },
  'extra-fuel-saving': {
    label: 'Extra Fuel Saving',
    icon: '⚡',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.04) 100%)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    accentColor: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
  },
};
