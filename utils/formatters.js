// ==================== FORMATTING UTILITIES ====================

const roundTo = (value, decimals = 1) =>
  Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);

const formatDuration = (seconds, showMs = false) => {
  if (!Number.isFinite(seconds)) return '--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const secString = showMs
    ? secs.toFixed(3).padStart(6, '0')
    : secs.toFixed(0).padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${secString}`;
  }

  return `${mins}:${secString}`;
};

const formatLapTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs.toFixed(3)).padStart(6, '0')}`;
};

const formatLapTimeRounded = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs.toFixed(0)).padStart(2, '0')}.000`;
};

const formatDateTime = (date, timezone = 'UTC') => {
  if (!date) return '--';
  try {
    return new Date(date).toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '--';
  }
};

