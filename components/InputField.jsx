const InputField = ({
  label,
  suffix,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  step = 'any',
  helpText,
  min,
  max,
}) => {
  const handleBlurInternal = (e) => {
    // Call custom onBlur if provided
    if (onBlur) {
      onBlur(e);
    }
    
    // Also handle default behavior for number fields
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
    // Tank Capacity: removed clamping - allow any value, validation will show error if out of bounds
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
          onBlur={handleBlurInternal}
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
