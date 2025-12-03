// ==================== STRATEGY COMPARISON TABLE ====================
// Updated with selection support

const formatTime = (seconds) => {
  if (seconds === 0) return '-';
  const sign = seconds >= 0 ? '+' : '-';
  const abs = Math.abs(seconds);
  if (abs >= 60) {
    const mins = Math.floor(abs / 60);
    const secs = (abs % 60).toFixed(1);
    return `${sign}${mins}m ${secs}s`;
  }
  return `${sign}${abs.toFixed(1)}s`;
};

const ModeTag = ({ mode, count }) => {
  const modeStyles = {
    std: {
      background: 'rgba(59, 130, 246, 0.2)',
      color: '#3b82f6',
      borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    fs: {
      background: 'rgba(234, 179, 8, 0.2)',
      color: '#eab308',
      borderColor: 'rgba(234, 179, 8, 0.3)',
    },
    efs: {
      background: 'rgba(245, 158, 11, 0.2)',
      color: '#f59e0b',
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
  };
  
  const style = modeStyles[mode] || modeStyles.std;
  
  return (
    <span style={{
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontFamily: 'monospace',
      border: `1px solid ${style.borderColor}`,
      background: style.background,
      color: style.color,
    }}>
      {count > 1 ? `${count}×` : ''}{mode.toUpperCase()}
    </span>
  );
};

const condenseSequence = (modes) => {
  if (!modes || modes.length === 0) return [];
  
  const condensed = [];
  let current = { mode: modes[0], count: 1 };
  
  for (let i = 1; i < modes.length; i++) {
    if (modes[i] === current.mode) {
      current.count++;
    } else {
      condensed.push(current);
      current = { mode: modes[i], count: 1 };
    }
  }
  condensed.push(current);
  
  return condensed;
};

const StintSequence = ({ modes }) => {
  const condensed = condenseSequence(modes);
  
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
      {condensed.map((item, idx) => (
        <React.Fragment key={idx}>
          <ModeTag mode={item.mode} count={item.count} />
          {idx < condensed.length - 1 && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * StrategyComparisonTable Component
 * 
 * Props:
 *   - strategies: Array of strategy objects from computePlan().allCandidates
 *   - capacities: Object with { std, fs, efs } max laps per stint
 *   - selectedIndex: Currently selected strategy index (default: 0)
 *   - onSelectStrategy: Callback when a strategy row is clicked (receives index)
 *   - bestFuelSavingIndex: Index of best fuel-saving strategy (passed from parent)
 */
const StrategyComparisonTable = ({ 
  strategies = [], 
  capacities = { std: 0, fs: 0, efs: 0 },
  selectedIndex = 0,
  onSelectStrategy = null,
  bestFuelSavingIndex = null,
}) => {
  if (!strategies || strategies.length === 0) {
    return (
      <div style={{
        background: 'var(--surface)',
        borderRadius: '8px',
        padding: '24px',
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        No strategies to compare
      </div>
    );
  }

  const standardStrategy = strategies[0];
  const standardPitStops = standardStrategy?.pitStops || 0;
  const standardLaps = standardStrategy?.totalLaps || 0;

  // Use passed bestFuelSavingIndex (single source of truth from parent)
  const bestFuelSavingIdx = bestFuelSavingIndex !== null && bestFuelSavingIndex > 0
    ? bestFuelSavingIndex
    : strategies.findIndex((s, idx) => 
        idx > 0 && (s.fsCount > 0 || s.efsCount > 0)
      );

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '24px',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#fff',
          margin: 0,
          marginBottom: '4px',
        }}>
          Strategy Comparison
        </h3>
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-muted)',
          margin: 0,
        }}>
          Max laps per stint: STD {capacities.std} • FS {capacities.fs} • EFS {capacities.efs}
        </p>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          fontSize: '0.875rem', 
          borderCollapse: 'collapse',
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <thead>
            <tr style={{
              background: 'var(--surface-muted)',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>Strategy</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500 }}>Pits</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500 }}>Laps</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>Stint Sequence</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>Track Time Lost</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>Pit Time Saved</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>Net Δ</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((strategy, idx) => {
              const isStandard = idx === 0;
              const isBestFuelSaving = idx === bestFuelSavingIdx && bestFuelSavingIdx > 0;
              const isSelected = idx === selectedIndex;
              const isPositiveNet = (strategy.netTimeDelta || 0) > 0;
              const lapsDelta = strategy.totalLaps - standardLaps;
              
              // Build row style - separate border from background
              let rowStyle = {
                transition: 'background-color 0.2s',
                cursor: onSelectStrategy ? 'pointer' : 'default',
                borderBottom: '1px solid var(--border)',
              };
              
              // LEFT BORDER: Always based on strategy type (matches card colors)
              if (isStandard) {
                rowStyle.borderLeft = '3px solid #3b82f6';  // Blue - matches Standard card
              } else if (isBestFuelSaving) {
                rowStyle.borderLeft = '3px solid #34d399';  // Green - matches Fuel-Saving card
              } else {
                rowStyle.borderLeft = '3px solid transparent';
              }
              
              // BACKGROUND: Based on selection state
              if (isSelected) {
                rowStyle.background = 'rgba(255, 255, 255, 0.1)';  // Neutral selection highlight
              } else if (isStandard) {
                rowStyle.background = 'rgba(59, 130, 246, 0.05)';  // Subtle blue
              } else if (isBestFuelSaving) {
                rowStyle.background = 'rgba(52, 211, 153, 0.05)';  // Subtle green
              } else {
                rowStyle.background = 'transparent';
              }

              return (
                <tr 
                  key={idx} 
                  style={rowStyle}
                  onClick={() => onSelectStrategy && onSelectStrategy(idx)}
                  onMouseEnter={(e) => {
                    if (!isSelected && onSelectStrategy) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      if (isStandard) {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
                      } else if (isBestFuelSaving) {
                        e.currentTarget.style.background = 'rgba(52, 211, 153, 0.05)';
                      } else {
                        e.currentTarget.style.background = 'transparent';
                      }
                    } else {
                      // Keep selection highlight on hover leave
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                >
                  {/* Strategy Name */}
                  <td style={{ padding: '12px 16px', minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '24px' }}>
                      <span style={{ color: '#fff', fontWeight: 500, fontSize: '0.875rem' }}>
                        {isStandard ? 'Standard' : (isBestFuelSaving && bestFuelSavingIdx > 0 ? 'Fuel-Saving' : `Option ${idx + 1}`)}
                      </span>
                      <div style={{ minWidth: '80px', display: 'flex', alignItems: 'center' }}>
                        {isSelected && (
                          <span style={{
                            padding: '2px 6px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            color: '#fff',
                            fontSize: '0.75rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}>
                            Selected
                          </span>
                        )}
                        {!isSelected && isBestFuelSaving && isPositiveNet && (
                          <span style={{
                            padding: '2px 6px',
                            background: 'rgba(52, 211, 153, 0.2)',
                            color: '#34d399',
                            fontSize: '0.75rem',
                            borderRadius: '4px',
                          }}>
                            Recommended
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Pits */}
                  <td style={{ padding: '12px 16px', textAlign: 'center', minWidth: '80px' }}>
                    <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: '1rem' }}>
                      {strategy.pitStops}
                    </span>
                    {!isStandard && strategy.pitStops < standardPitStops && (
                      <span style={{ marginLeft: '4px', color: '#34d399', fontSize: '0.75rem' }}>
                        (-{standardPitStops - strategy.pitStops})
                      </span>
                    )}
                  </td>

                  {/* Laps */}
                  <td style={{ padding: '12px 16px', textAlign: 'center', minWidth: '100px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                          {strategy.totalLaps}
                        </span>
                        {!isStandard && lapsDelta !== 0 && (
                          <span style={{
                            marginLeft: '4px',
                            fontSize: '0.75rem',
                            color: lapsDelta > 0 ? '#34d399' : '#f87171',
                          }}>
                            ({lapsDelta > 0 ? '+' : ''}{lapsDelta})
                          </span>
                        )}
                      </div>
                      <span style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                      }}>
                        {strategy.fractionalLaps?.toFixed(2)}
                      </span>
                    </div>
                  </td>

                  {/* Stint Sequence */}
                  <td style={{ padding: '12px 16px', textAlign: 'left', minWidth: '200px' }}>
                    <StintSequence modes={strategy.stintModes || []} />
                  </td>

                  {/* Track Time Lost */}
                  <td style={{ padding: '12px 16px', textAlign: 'right', minWidth: '120px', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {isStandard ? (
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                    ) : (
                      <span style={{ color: '#f87171' }}>
                        {strategy.lapTimeLoss > 0 ? `-${strategy.lapTimeLoss.toFixed(1)}s` : '-'}
                      </span>
                    )}
                  </td>

                  {/* Pit Time Saved */}
                  <td style={{ padding: '12px 16px', textAlign: 'right', minWidth: '120px', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {isStandard ? (
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                    ) : (
                      <span style={{ color: '#34d399' }}>
                        {strategy.pitTimeSaved > 0 ? `+${strategy.pitTimeSaved.toFixed(1)}s` : '-'}
                      </span>
                    )}
                  </td>

                  {/* Net Delta */}
                  <td style={{ padding: '12px 16px', textAlign: 'right', minWidth: '100px' }}>
                    {isStandard ? (
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.875rem' }}>baseline</span>
                    ) : (
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        color: isPositiveNet ? '#34d399' : '#f87171',
                      }}>
                        {formatTime(strategy.netTimeDelta || 0)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-muted)',
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ModeTag mode="std" count={1} />
            <span>Standard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ModeTag mode="fs" count={1} />
            <span>Fuel saving</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ModeTag mode="efs" count={1} />
            <span>Extra fuel saving</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span><span style={{ color: '#34d399' }}>Green</span> = faster</span>
            <span><span style={{ color: '#f87171' }}>Red</span> = slower</span>
          </div>
        </div>
      </div>
    </div>
  );
};
