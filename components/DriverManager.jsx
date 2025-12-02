const DriverManager = ({ drivers, onDriversChange }) => {
  const timezones = getCommonTimezones();

  const addDriver = () => {
    // Find first available color
    const usedColors = drivers.map(d => d.color).filter(Boolean);
    const availableColor = DRIVER_COLORS.find(c => !usedColors.includes(c.value));
    const newColor = availableColor ? availableColor.value : DRIVER_COLORS[drivers.length % DRIVER_COLORS.length].value;
    
    onDriversChange([
      ...drivers,
      { id: Date.now(), name: '', timezone: 'UTC', color: newColor },
    ]);
  };

  const updateDriver = (id, field, value) => {
    onDriversChange(
      drivers.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  const removeDriver = (id) => {
    onDriversChange(drivers.filter((d) => d.id !== id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0 }}>Drivers</h4>
        <button
          onClick={addDriver}
          style={{
            padding: '8px 16px',
            background: 'var(--accent)',
            color: '#071321',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.9rem',
          }}
        >
          + Add Driver
        </button>
      </div>
      {drivers.length === 0 ? (
        <div className="empty-state" style={{ padding: '20px' }}>
          No drivers added. Click "Add Driver" to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {drivers.map((driver) => (
            <div
              key={driver.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: 12,
                background: 'var(--surface-muted)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: 2, display: 'block' }}>
                  Name
                </label>
                <input
                  type="text"
                  value={driver.name}
                  onChange={(e) => updateDriver(driver.id, 'name', e.target.value)}
                  placeholder="Driver name"
                  style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: 2, display: 'block' }}>
                  Timezone
                </label>
                <select
                  value={driver.timezone}
                  onChange={(e) => updateDriver(driver.id, 'timezone', e.target.value)}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem' }}
                >
                  {timezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: '4px', 
                  background: driver.color || DRIVER_COLORS[0].value,
                  border: '2px solid var(--border)',
                  flexShrink: 0,
                }} />
                <div style={{ minWidth: 120 }}>
                  <label className="field-label" style={{ fontSize: '0.75rem', marginBottom: 2, display: 'block' }}>
                    Color
                  </label>
                  <select
                    value={driver.color || DRIVER_COLORS[0].value}
                    onChange={(e) => updateDriver(driver.id, 'color', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      fontSize: '0.75rem',
                      background: 'var(--surface)',
                      color: '#f4f6fb',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                    }}
                  >
                    {DRIVER_COLORS.map((color) => (
                      <option key={color.value} value={color.value}>
                        {color.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => removeDriver(driver.id)}
                style={{
                  padding: '4px 8px',
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  alignSelf: 'flex-end',
                  fontSize: '0.75rem',
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
