// ==================== PARSING UTILITIES ====================

const parseNumber = (value) => (value === '' ? '' : Number(value));

const parseLapTime = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(timeStr);
};

const safeNumber = (value) => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

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

