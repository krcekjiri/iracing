// ==================== PARSING UTILITIES ====================

const parseNumber = (value) => (value === '' ? '' : Number(value));

const parseLapTime = (value) => {
  if (!value) return null;
  const clean = value.trim();
  if (!clean) return null;
  const parts = clean.split(':');
  let multiplier = 1;
  let seconds = 0;

  while (parts.length) {
    const part = parts.pop();
    const num = Number(part);
    if (Number.isNaN(num)) return null;
    seconds += num * multiplier;
    multiplier *= 60;
  }

  return seconds;
};

const safeNumber = (value) =>
  value === '' || Number.isNaN(Number(value)) ? null : Number(value);

const parseTimeOnly = (timeStr) => {
  if (!timeStr) return null;
  try {
    const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
    // Use today's date in UTC
    const today = new Date();
    const date = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
      hours,
      minutes,
      seconds
    ));
    return date;
  } catch {
    return null;
  }
};

const addSeconds = (date, seconds) => {
  if (!date) return null;
  return new Date(date.getTime() + seconds * 1000);
};

