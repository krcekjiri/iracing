// Calculate tire service time based on tire changes and pit wall side
const calculateTireServiceTime = (tireChange, pitWallSide) => {
  if (!tireChange) return 0;
  
  const { left, right, front, rear } = tireChange;
  const changes = [left, right, front, rear].filter(Boolean).length;
  
  if (changes === 0) return 0;
  
  // Base time per tire change
  const baseTimePerTire = 7; // seconds
  const wallCornerTime = 5.5; // seconds (faster for wall corner)
  
  // If pit wall side is specified, use faster time for that side
  if (pitWallSide === 'left' && (left || front)) {
    return [left, right, front, rear].reduce((total, change, idx) => {
      if (!change) return total;
      const isWallCorner = (pitWallSide === 'left' && (idx === 0 || idx === 2));
      return total + (isWallCorner ? wallCornerTime : baseTimePerTire);
    }, 0);
  } else if (pitWallSide === 'right' && (right || rear)) {
    return [left, right, front, rear].reduce((total, change, idx) => {
      if (!change) return total;
      const isWallCorner = (pitWallSide === 'right' && (idx === 1 || idx === 3));
      return total + (isWallCorner ? wallCornerTime : baseTimePerTire);
    }, 0);
  }
  
  // Default: all tires take base time
  return changes * baseTimePerTire;
};

