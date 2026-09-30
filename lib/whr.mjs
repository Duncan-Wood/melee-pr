const ELO_PER_NATURAL = 400 / Math.LN10;
const MILLISECONDS_PER_DAY = 86400000;
const CONVERGENCE = 1e-4;
const MAXIMUM_STEP = 1;

export const dayNumber = (isoDate) => Math.round(Date.parse(`${isoDate}T00:00:00Z`) / MILLISECONDS_PER_DAY);

export function createWholeHistoryRating({ driftEloPerSqrtDay, priorGames, timeless = false }) {
  const driftPerDay = (driftEloPerSqrtDay / ELO_PER_NATURAL) ** 2;
  const players = new Map();

  function dayOf(playerId, day) {
    if (!players.has(playerId)) players.set(playerId, []);
    const days = players.get(playerId);
    const key = timeless ? 0 : day;
    let entry = days.find((candidate) => candidate.day === key);
    if (!entry) {
      entry = { day: key, rating: days.length ? days.at(-1).rating : 0, games: [] };
      days.push(entry);
      days.sort((a, b) => a.day - b.day);
    }
    return entry;
  }

  function addEvent(day, results) {
    for (const [winnerId, loserId] of results) {
      const winnerDay = dayOf(winnerId, day);
      const loserDay = dayOf(loserId, day);
      winnerDay.games.push({ opponent: loserDay, won: 1 });
      loserDay.games.push({ opponent: winnerDay, won: 0 });
    }
  }

  function hessianAndGradient(days) {
    const size = days.length;
    const diagonal = new Array(size).fill(0);
    const offDiagonal = new Array(Math.max(size - 1, 0)).fill(0);
    const gradient = new Array(size).fill(0);
    days.forEach((entry, index) => {
      const gamma = Math.exp(entry.rating);
      for (const { opponent, won } of entry.games) {
        const opponentGamma = Math.exp(opponent.rating);
        const total = gamma + opponentGamma;
        gradient[index] += won - gamma / total;
        diagonal[index] -= (gamma * opponentGamma) / total ** 2;
      }
      if (index === 0) {
        gradient[index] += priorGames * (1 - (2 * gamma) / (gamma + 1));
        diagonal[index] -= (2 * priorGames * gamma) / (gamma + 1) ** 2;
      }
    });
    for (let index = 0; index < size - 1; index++) {
      const variance = driftPerDay * Math.max(days[index + 1].day - days[index].day, 1);
      const pull = (days[index + 1].rating - days[index].rating) / variance;
      gradient[index] += pull;
      gradient[index + 1] -= pull;
      diagonal[index] -= 1 / variance;
      diagonal[index + 1] -= 1 / variance;
      offDiagonal[index] = 1 / variance;
    }
    return { diagonal, offDiagonal, gradient };
  }

  function solveTridiagonal(diagonal, offDiagonal, rightHandSide) {
    const size = diagonal.length;
    const upper = new Array(size).fill(0);
    const solution = new Array(size).fill(0);
    let pivot = diagonal[0];
    solution[0] = rightHandSide[0] / pivot;
    for (let index = 1; index < size; index++) {
      upper[index - 1] = offDiagonal[index - 1] / pivot;
      pivot = diagonal[index] - offDiagonal[index - 1] * upper[index - 1];
      solution[index] = (rightHandSide[index] - offDiagonal[index - 1] * solution[index - 1]) / pivot;
    }
    for (let index = size - 2; index >= 0; index--) solution[index] -= upper[index] * solution[index + 1];
    return solution;
  }

  function fit(maximumSweeps = 2000) {
    for (let sweep = 0; sweep < maximumSweeps; sweep++) {
      let largestStep = 0;
      for (const days of players.values()) {
        const { diagonal, offDiagonal, gradient } = hessianAndGradient(days);
        const step = solveTridiagonal(diagonal, offDiagonal, gradient);
        days.forEach((entry, index) => {
          const clampedStep = Math.max(-MAXIMUM_STEP, Math.min(MAXIMUM_STEP, step[index]));
          entry.rating -= clampedStep;
          largestStep = Math.max(largestStep, Math.abs(clampedStep));
        });
      }
      if (!Number.isFinite(largestStep)) throw new Error('Whole-History Rating fit produced a non-finite rating');
      if (largestStep < CONVERGENCE) return;
    }
    throw new Error(`Whole-History Rating fit did not converge in ${maximumSweeps} sweeps`);
  }

  function varianceOf(playerId, index) {
    const days = players.get(playerId);
    const { diagonal, offDiagonal } = hessianAndGradient(days);
    const unit = days.map((_, position) => (position === index ? 1 : 0));
    return -solveTridiagonal(diagonal, offDiagonal, unit)[index];
  }

  const priorOnlyDeviation = Math.sqrt(2 / priorGames) * ELO_PER_NATURAL;

  return {
    addEvent,
    fit,
    has: (playerId) => players.has(playerId),
    rating: (playerId) => (players.has(playerId) ? 1500 + players.get(playerId).at(-1).rating * ELO_PER_NATURAL : 1500),
    deviation: (playerId) =>
      players.has(playerId) ? Math.sqrt(varianceOf(playerId, players.get(playerId).length - 1)) * ELO_PER_NATURAL : priorOnlyDeviation,
    history: (playerId) =>
      (players.get(playerId) ?? []).map((entry, index) => ({
        day: entry.day,
        rating: 1500 + entry.rating * ELO_PER_NATURAL,
        deviation: Math.sqrt(varianceOf(playerId, index)) * ELO_PER_NATURAL,
      })),
  };
}
