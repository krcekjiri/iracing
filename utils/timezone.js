// ==================== TIMEZONE UTILITIES ====================

// Get timezone acronym
const getTimezoneAcronym = (timezone) => {
  const acronyms = {
    'UTC': 'UTC',
    'Europe/London': 'GMT',
    'America/New_York': 'EST',
    'America/Los_Angeles': 'PST',
    'Europe/Paris': 'CET',
    'Europe/Berlin': 'CET',
    'Asia/Tokyo': 'JST',
    'Australia/Sydney': 'AEST',
  };
  return acronyms[timezone] || timezone.split('/').pop().substring(0, 3).toUpperCase();
};

// Timezone and time conversion utilities
const getTimezoneOffset = (timezone) => {
  try {
    const now = new Date();
    const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const local = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return (local.getTime() - utc.getTime()) / (1000 * 60 * 60); // hours
  } catch {
    return 0;
  }
};

const getCommonTimezones = () => [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'EST/EDT (Eastern Time)' },
  { value: 'America/Chicago', label: 'CST/CDT (Central Time)' },
  { value: 'America/Denver', label: 'MST/MDT (Mountain Time)' },
  { value: 'America/Los_Angeles', label: 'PST/PDT (Pacific Time)' },
  { value: 'Europe/London', label: 'GMT/BST (UK)' },
  { value: 'Europe/Paris', label: 'CET/CEST (Central Europe)' },
  { value: 'Europe/Berlin', label: 'CET/CEST (Germany)' },
  { value: 'Asia/Tokyo', label: 'JST (Japan)' },
  { value: 'Australia/Sydney', label: 'AEDT/AEST (Sydney)' },
];

