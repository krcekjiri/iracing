const Stat = ({ label, value, detail, helpText }) => (
  <div className="stat-highlight">
    <div className="field-label" style={{ marginBottom: 2 }}>
      <span className="stat-label" style={{ fontSize: '0.85rem' }}>
        {label}
      </span>
      {helpText ? (
        <span className="help-badge" tabIndex={0}>
          <span className="help-icon">?</span>
          <span className="help-tooltip">{helpText}</span>
        </span>
      ) : null}
    </div>
    <span className="stat-value">{value}</span>
    {detail ? <span className="stat-label">{detail}</span> : null}
  </div>
);
