// ==================== STRATEGY COMPARISON TABLE ====================
// Updated: Top 5 Limit, Sorted, Simplified Names, Fractional Laps, Full Columns, Hover Effects

const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return '-';
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
    std: { bg: 'rgba(59, 130, 246, 0.2)', col: '#3b82f6', bord: 'rgba(59, 130, 246, 0.3)' },
    fs: { bg: 'rgba(234, 179, 8, 0.2)', col: '#eab308', bord: 'rgba(234, 179, 8, 0.3)' },
    efs: { bg: 'rgba(245, 158, 11, 0.2)', col: '#f59e0b', bord: 'rgba(245, 158, 11, 0.3)' },
  };
  
  const style = modeStyles[mode?.toLowerCase()] || modeStyles.std;
  
  return (
    <span style={{
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontFamily: 'monospace',
      border: `1px solid ${style.bord}`,
      background: style.bg,
      color: style.col,
      whiteSpace: 'nowrap',
      display: 'inline-block',
      marginRight: '4px'
    }}>
      {count > 1 ? `${count}×` : ''}{mode?.toUpperCase()}
    </span>
  );
};

const condenseSequence = (modes) => {
  if (!modes || modes.length === 0) return [];
  const condensed = [];
  let current = { mode: modes[0], count: 1 };
  for (let i = 1; i < modes.length; i++) {
    if (modes[i] === current.mode) current.count++;
    else {
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

const StrategyComparisonTable = ({ 
  strategies = [], 
  selectedIndex = 0,
  onSelectStrategy = null,
  bestFuelSavingIndex = null,
}) => {
  const { useMemo, useState } = React;
  const [hoverIndex, setHoverIndex] = useState(null);
  
  // Logic to Filter, Sort and Limit strategies
  const displayStrategies = useMemo(() => {
    if (!strategies || strategies.length === 0) return [];
    
    // 1. Preserve Original Index
    const withIndex = strategies.map((s, i) => ({ ...s, originalIndex: i }));
    const standard = withIndex[0];
    
    // 2. Identify Best Fuel Save
    let fsIndex = bestFuelSavingIndex;
    if (fsIndex === null || fsIndex <= 0) {
       fsIndex = withIndex.findIndex((s, i) => i > 0 && (s.fsCount > 0 || s.efsCount > 0));
    }
    const fuelSaver = (fsIndex > 0 && fsIndex < withIndex.length) ? withIndex[fsIndex] : null;

    // 3. Filter Others
    const others = withIndex.filter(s => 
      s.originalIndex !== 0 && 
      (!fuelSaver || s.originalIndex !== fuelSaver.originalIndex)
    );
    
    // 4. Sort by Net Delta (High to Low = Fastest)
    others.sort((a, b) => (b.netTimeDelta || 0) - (a.netTimeDelta || 0));

    // 5. Construct List (Max 5)
    const result = [standard];
    if (fuelSaver) result.push(fuelSaver);
    
    const limit = 5;
    const slotsLeft = limit - result.length;
    if (slotsLeft > 0) result.push(...others.slice(0, slotsLeft));

    return result;
  }, [strategies, bestFuelSavingIndex]);

  const handleRowClick = (originalIndex) => {
    if (onSelectStrategy) onSelectStrategy(originalIndex);
  };

  if (!displayStrategies.length) {
    return (
      <div style={{ padding: '24px', color: 'var(--text-muted)', textAlign: 'center' }}>
        No strategies to compare
      </div>
    );
  }

  const standardStrategy = strategies[0];
  const standardPitStops = standardStrategy?.pitStops || 0;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#fff', margin: 0, marginBottom: '4px' }}>
          Strategy Comparison
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          Top 5 Recommended Strategies
        </p>
      </div>

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
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, minWidth: '180px' }}>Strategy</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500, minWidth: '80px' }}>Pits</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500, minWidth: '100px' }}>Laps</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, minWidth: '200px' }}>Stint Sequence</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, minWidth: '120px' }}>Track Time Lost</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, minWidth: '120px' }}>Pit Time Saved</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, minWidth: '100px' }}>Net Δ</th>
            </tr>
          </thead>
          <tbody>
            {displayStrategies.map((strategy, idx) => {
              const originalIndex = strategy.originalIndex;
              const isStandard = originalIndex === 0;
              const isBestFuelSaveRow = !isStandard && idx === 1;
              const isSelected = originalIndex === selectedIndex;
              const isHovered = hoverIndex === originalIndex;
              const isPositiveNet = (strategy.netTimeDelta || 0) > 0;
              
              // --- FIX 1: Laps Calculation ---
              // Previously: strategy.totalLaps + strategy.fractionalLaps (which doubled the count).
              // Now: Priority to decimal/fractional, fallback to total integer.
              const rawLaps = strategy.decimalLaps ?? strategy.fractionalLaps ?? strategy.totalLaps;
              const displayLaps = rawLaps ? rawLaps.toFixed(2) : '-';
              
              // --- FIX 2: Track Time Lost Property Name ---
              // Logic file uses 'lapTimeCost', but UI was looking for 'lapTimeLoss'.
              // Added fallback check.
              const trackTimeLost = strategy.lapTimeLoss || strategy.lapTimeCost || 0;

              let strategyName = `Option ${idx + 1}`;
              if (isStandard) strategyName = 'Standard';
              else if (isBestFuelSaveRow) strategyName = 'Best Fuel Save';

              // Dynamic Background for Selection & Hover
              let bg = 'transparent';
              if (isSelected) bg = 'rgba(255, 255, 255, 0.1)';
              else if (isHovered) {
                  if (isStandard) bg = 'rgba(59, 130, 246, 0.1)';
                  else if (isBestFuelSaveRow) bg = 'rgba(52, 211, 153, 0.1)';
                  else bg = 'rgba(255, 255, 255, 0.05)';
              } else {
                  if (isStandard) bg = 'rgba(59, 130, 246, 0.02)';
                  else if (isBestFuelSaveRow) bg = 'rgba(52, 211, 153, 0.02)';
              }

              const rowStyle = {
                cursor: onSelectStrategy ? 'pointer' : 'default',
                borderBottom: '1px solid var(--border)',
                background: bg,
                transition: 'background 0.2s ease',
                borderLeft: isStandard 
                  ? '3px solid #3b82f6' 
                  : (isBestFuelSaveRow ? '3px solid #34d399' : '3px solid transparent')
              };

              return (
                <tr 
                  key={strategy.originalIndex}
                  style={rowStyle}
                  onClick={() => handleRowClick(originalIndex)}
                  onMouseEnter={() => setHoverIndex(originalIndex)}
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: '#fff', minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{strategyName}</span>
                      {isSelected && (
                        <span style={{ 
                          marginLeft: '8px', 
                          fontSize: '0.7rem', 
                          background: 'rgba(255,255,255,0.2)', 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}>
                          Selected
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {strategy.pitStops}
                      </span>
                      {!isStandard && strategy.pitStops < standardPitStops && (
                        <span style={{ color: '#34d399', fontSize: '0.75rem', marginTop: '2px' }}>
                          (-{standardPitStops - strategy.pitStops})
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'center', minWidth: '100px' }}>
                    <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {displayLaps}
                    </span>
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'left', minWidth: '200px' }}>
                    <StintSequence modes={strategy.stintModes || []} />
                  </td>

                  {/* Track Time Lost Column - Corrected */}
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.875rem', minWidth: '120px' }}>
                    {isStandard ? (
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                    ) : (
                      <span style={{ color: '#f87171' }}>
                        {trackTimeLost > 0 ? `-${trackTimeLost.toFixed(1)}s` : '-'}
                      </span>
                    )}
                  </td>

                  {/* Pit Time Saved Column */}
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.875rem', minWidth: '120px' }}>
                    {isStandard ? (
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                    ) : (
                      <span style={{ color: '#34d399' }}>
                        {strategy.pitTimeSaved > 0 ? `+${strategy.pitTimeSaved.toFixed(1)}s` : '-'}
                      </span>
                    )}
                  </td>

                  <td style={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    fontFamily: 'monospace', 
                    fontWeight: 700, 
                    fontSize: '0.875rem',
                    minWidth: '100px',
                    color: isStandard 
                      ? 'var(--text-muted)' 
                      : (isPositiveNet ? '#34d399' : '#f87171'),
                  }}>
                    {isStandard ? 'baseline' : formatTime(strategy.netTimeDelta || 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
