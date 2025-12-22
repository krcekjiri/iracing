const InputField = ({
  label,
  suffix,
  type = 'text',
  value,
  onChange,
  placeholder,
  step = 'any',
  helpText,
  min,
  max,
}) => {
  const handleBlur = (e) => {
    if (type === 'number' && (e.target.value === '' || isNaN(parseFloat(e.target.value)))) {
      // On blur, if empty or invalid, set to min value if provided
      if (min !== undefined) {
        const numValue = parseFloat(min) || 0;
        if (onChange) {
          // Create a synthetic event for consistency
          const syntheticEvent = {
            target: { value: String(numValue), type: 'number' }
          };
          onChange(syntheticEvent);
        }
      }
    } else if (type === 'number' && e.target.value !== '' && label === 'Tank Capacity') {
      // For Tank Capacity: validate range 10-150 on blur
      const numValue = parseFloat(e.target.value);
      if (!isNaN(numValue)) {
        const clamped = Math.max(10, Math.min(150, numValue));
        if (clamped !== numValue && onChange) {
          const syntheticEvent = {
            target: { value: String(clamped), type: 'number' }
          };
          onChange(syntheticEvent);
        }
      }
    }
  };

  return (
    <div className="input-group">
      <label className="field-label">
        <span>{label}</span>
        {helpText ? (
          <span className="help-badge" tabIndex={0}>
            <span className="help-icon">?</span>
            <span className="help-tooltip">{helpText}</span>
          </span>
        ) : null}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          onChange={onChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          step={step}
          min={min}
          max={max}
        />
        {suffix ? (
          <span
            style={{
              position: 'absolute',
              right: type === 'number' ? 32 : 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              pointerEvents: 'none',
            }}
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
};
