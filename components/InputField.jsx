const InputField = ({
  label,
  suffix,
  type = 'text',
  value,
  onChange,
  placeholder,
  step = 'any',
  helpText,
}) => (
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
        placeholder={placeholder}
        step={step}
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
