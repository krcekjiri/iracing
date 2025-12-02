// ==================== SIMULATION FUNCTION ====================
// Reusable function to simulate race lap-by-lap
const simulateRace = ({
  raceDurationSeconds,
  maxRaceTimeSeconds,
  lapSeconds,
  maxLapsPerStintWithFuel,
  outLapPenalties,
  estimatedPerStopLoss,
}) => {
  let simulatedTime = 0;
  let simulatedLaps = 0;
  let fractionalLapsAtZero = 0;
  let fullLapsForPlanning = 0;
  
  // Simulate lap by lap until timer hits zero
  while (simulatedTime < raceDurationSeconds) {
    const lapNumber = simulatedLaps + 1;
    let currentLapTime = lapSeconds;
    
    // Apply outlap penalties for first few laps
    if (lapNumber <= outLapPenalties.length && outLapPenalties[lapNumber - 1]) {
      currentLapTime += outLapPenalties[lapNumber - 1];
    }
    
    // Check if completing this lap would exceed race duration
    const timeAfterThisLap = simulatedTime + currentLapTime;
    
    if (timeAfterThisLap > raceDurationSeconds) {
      // Timer hits zero during this lap
      const timeIntoThisLap = raceDurationSeconds - simulatedTime;
      const fractionOfLapCompleted = timeIntoThisLap / currentLapTime;
      
      fractionalLapsAtZero = simulatedLaps + fractionOfLapCompleted;
      fullLapsForPlanning = simulatedLaps + 1;
      break;
    }
    
    // Complete the lap
    simulatedTime += currentLapTime;
    simulatedLaps += 1;
    
    // Check if we need a pit stop AFTER completing this lap
    if (simulatedLaps > 0 && simulatedLaps % maxLapsPerStintWithFuel === 0) {
      const timeAfterPitStop = simulatedTime + estimatedPerStopLoss;
      
      // Check if timer hits zero during pit stop
      if (timeAfterPitStop > raceDurationSeconds) {
        const timeRemainingAfterLap = maxRaceTimeSeconds - simulatedTime;
        
        if (timeRemainingAfterLap > estimatedPerStopLoss) {
          const timeRemainingAfterPit = maxRaceTimeSeconds - timeAfterPitStop;
          
          if (timeRemainingAfterPit > 0) {
            const fractionOfNextLap = timeRemainingAfterPit / lapSeconds;
            fractionalLapsAtZero = simulatedLaps + Math.min(fractionOfNextLap, 1);
          } else {
            fractionalLapsAtZero = simulatedLaps;
          }
        } else {
          fractionalLapsAtZero = simulatedLaps;
        }
        
        fullLapsForPlanning = simulatedLaps + 1;
        break;
      }
      
      // Check if we can start the next lap after pit stop
      if (timeAfterPitStop + lapSeconds > maxRaceTimeSeconds) {
        const timeRemainingAfterPit = maxRaceTimeSeconds - timeAfterPitStop;
        if (timeRemainingAfterPit > 0) {
          const fractionOfNextLap = timeRemainingAfterPit / lapSeconds;
          fractionalLapsAtZero = simulatedLaps + fractionOfNextLap;
        } else {
          fractionalLapsAtZero = simulatedLaps;
        }
        fullLapsForPlanning = simulatedLaps + 1;
        break;
      }
      
      // Pit stop is within time limit, continue
      simulatedTime = timeAfterPitStop;
    }
  }
  
  // If we didn't hit the limit in the loop, calculate from remaining time
  if (fractionalLapsAtZero === 0 && fullLapsForPlanning === 0) {
    if (simulatedTime < raceDurationSeconds) {
      const timeRemaining = raceDurationSeconds - simulatedTime;
      const additionalLaps = timeRemaining / lapSeconds;
      fractionalLapsAtZero = simulatedLaps + additionalLaps;
      fullLapsForPlanning = simulatedLaps + Math.ceil(additionalLaps);
      if (additionalLaps > 0 && additionalLaps < 1) {
        fullLapsForPlanning = simulatedLaps + 1;
      }
    } else {
      fractionalLapsAtZero = simulatedLaps;
      fullLapsForPlanning = simulatedLaps + 1;
    }
  }
  
  return {
    fractionalLapsAtZero,
    fullLapsForPlanning,
    simulatedLaps,
    simulatedTime,
  };
};

