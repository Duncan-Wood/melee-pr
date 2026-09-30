import { readFile, readdir } from 'node:fs/promises';
import glicko2 from 'glicko2';
import { createWholeHistoryRating, dayNumber } from '../lib/whr.mjs';

const seriesFiles = async (directory) => (await readdir(directory)).filter((file) => file.endsWith('.json')).map((file) => file.replace(/\.json$/, ''));
const SERIES_NAMES = [...(await seriesFiles('series')), ...(await seriesFiles('series/eval')).map((name) => `eval/${name}`)];
const CHOSEN = 'WHR drift=5 prior=0.25';
const REFERENCE = 'Glicko-2 (current)';
const HIGHLIGHTED = [CHOSEN, 'WHR drift=5 prior=0.5', 'Bradley–Terry prior=0.25', `${CHOSEN} + h2h 0.5`, REFERENCE, 'Elo K=64'];
const ELO_PER_NATURAL = 400 / Math.LN10;
const logistic = (value) => 1 / (1 + Math.exp(-value));
const logit = (probability) => Math.log(probability / (1 - probability));

function glickoModel(tau) {
  const ranking = new glicko2.Glicko2({ tau, rating: 1500, rd: 350, vol: 0.06 });
  const players = new Map();
  const playerFor = (id) => players.get(id) ?? players.set(id, ranking.makePlayer()).get(id);
  return {
    predict: (first, second) => players.get(first).predict(players.get(second)),
    update: (_event, results) => ranking.updateRatings(results.map(([winner, loser]) => [playerFor(winner), playerFor(loser), 1])),
  };
}

function eloModel(kFactor) {
  const ratings = new Map();
  const expected = (first, second) => 1 / (1 + 10 ** ((ratings.get(second) - ratings.get(first)) / 400));
  return {
    predict: expected,
    update: (_event, results) => {
      for (const [winner, loser] of results) {
        for (const id of [winner, loser]) if (!ratings.has(id)) ratings.set(id, 1500);
        const change = kFactor * (1 - expected(winner, loser));
        ratings.set(winner, ratings.get(winner) + change);
        ratings.set(loser, ratings.get(loser) - change);
      }
    },
  };
}

function wholeHistoryModel({ driftEloPerSqrtDay = 0, priorGames, timeless = false, useUncertainty }) {
  const model = createWholeHistoryRating({ driftEloPerSqrtDay, priorGames, timeless });
  const lastDay = new Map();
  return {
    predict: (first, second, event) => {
      const difference = (model.rating(first) - model.rating(second)) / ELO_PER_NATURAL;
      if (!useUncertainty) return logistic(difference);
      const today = dayNumber(event.date);
      const drift = (id) => (timeless ? 0 : (driftEloPerSqrtDay ** 2) * (today - lastDay.get(id)));
      const variance = (model.deviation(first) ** 2 + drift(first) + model.deviation(second) ** 2 + drift(second)) / ELO_PER_NATURAL ** 2;
      return logistic(difference / Math.sqrt(1 + (Math.PI * variance) / 8));
    },
    update: (event, results) => {
      model.addEvent(dayNumber(event.date), results);
      for (const [winner, loser] of results) for (const id of [winner, loser]) lastDay.set(id, dayNumber(event.date));
      model.fit();
    },
  };
}

function withHeadToHead(baseModel, weight) {
  const records = new Map();
  const key = (first, second) => `${first}:${second}`;
  return {
    predict: (first, second, event) => {
      const probability = baseModel.predict(first, second, event);
      const wins = records.get(key(first, second)) ?? 0;
      const losses = records.get(key(second, first)) ?? 0;
      return logistic(logit(probability) + (weight * (wins - losses)) / (wins + losses + 2));
    },
    update: (event, results) => {
      baseModel.update(event, results);
      for (const [winner, loser] of results) records.set(key(winner, loser), (records.get(key(winner, loser)) ?? 0) + 1);
    },
  };
}

const PRIORS = [0.1, 0.25, 0.5, 1];
const CANDIDATES = [
  { name: 'Glicko-2 (current)', make: () => glickoModel(0.5) },
  ...[32, 48, 64].map((kFactor) => ({ name: `Elo K=${kFactor}`, make: () => eloModel(kFactor) })),
  ...[true, false].flatMap((useUncertainty) =>
    PRIORS.flatMap((priorGames) => [
      {
        name: `Bradley–Terry prior=${priorGames}${useUncertainty ? '' : ' sharp'}`,
        make: () => wholeHistoryModel({ priorGames, timeless: true, useUncertainty }),
      },
      ...[2, 5, 10].map((driftEloPerSqrtDay) => ({
        name: `WHR drift=${driftEloPerSqrtDay} prior=${priorGames}${useUncertainty ? '' : ' sharp'}`,
        make: () => wholeHistoryModel({ driftEloPerSqrtDay, priorGames, useUncertainty }),
      })),
    ]),
  ),
  ...[0.5, 1, 2].map((weight) => ({
    name: `WHR drift=5 prior=0.25 + h2h ${weight}`,
    make: () => withHeadToHead(wholeHistoryModel({ driftEloPerSqrtDay: 5, priorGames: 0.25, useUncertainty: true }), weight),
  })),
];

function backtest(data, candidate) {
  const model = candidate.make();
  const seen = new Set();
  const score = { sets: 0, logLoss: 0, brier: 0, correct: 0, skipped: 0, losses: [] };
  for (const event of data.events) {
    const results = data.sets.filter((set) => set.eventSlug === event.slug).map((set) => [set.winnerId, set.loserId]);
    for (const [winner, loser] of results) {
      if (!seen.has(winner) || !seen.has(loser)) {
        score.skipped++;
        continue;
      }
      const probability = Math.min(Math.max(model.predict(winner, loser, event), 1e-9), 1 - 1e-9);
      score.sets++;
      score.logLoss -= Math.log(probability);
      score.losses.push(-Math.log(probability));
      score.brier += (1 - probability) ** 2;
      if (probability > 0.5) score.correct++;
    }
    model.update(event, results);
    for (const [winner, loser] of results) seen.add(winner).add(loser);
  }
  return score;
}

const format = (score) =>
  `${(score.logLoss / score.sets).toFixed(4)}  ${(score.brier / score.sets).toFixed(4)}  ${((100 * score.correct) / score.sets).toFixed(1).padStart(5)}%`;

function pairedDifference(losses, referenceLosses) {
  const differences = losses.map((loss, index) => loss - referenceLosses[index]);
  const mean = differences.reduce((sum, value) => sum + value, 0) / differences.length;
  const variance = differences.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (differences.length - 1);
  return { mean, z: mean / Math.sqrt(variance / differences.length) };
}

async function loadSeries(seriesName) {
  try {
    return JSON.parse(await readFile(`data/${seriesName}.json`, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error(`data/${seriesName}.json is missing; run: npm run fetch -- ${seriesName} && npm run build -- ${seriesName}`);
  }
}

const pooled = new Map(CANDIDATES.map((candidate) => [candidate.name, { sets: 0, logLoss: 0, brier: 0, correct: 0, losses: [] }]));
const perSeries = [];
for (const seriesName of SERIES_NAMES) {
  const data = await loadSeries(seriesName);
  const scores = new Map(CANDIDATES.map((candidate) => [candidate.name, backtest(data, candidate)]));
  perSeries.push({ seriesName, scores });
  for (const [name, score] of scores) {
    const total = pooled.get(name);
    for (const field of ['sets', 'logLoss', 'brier', 'correct']) total[field] += score[field];
    total.losses.push(...score.losses);
  }
}

console.log('sets predicted per dataset (a player\'s first event is skipped):');
for (const { seriesName, scores } of perSeries) console.log(`  ${seriesName.padEnd(32)} ${String(scores.get(REFERENCE).sets).padStart(6)} predicted, ${scores.get(REFERENCE).skipped} skipped`);

console.log(`\nall datasets pooled (${pooled.get(REFERENCE).sets} sets); coin flip logloss is 0.6931, lower is better`);
console.log(`${'model'.padEnd(46)} logloss  brier   accuracy  vs current`);
for (const [name, score] of [...pooled].sort((a, b) => a[1].logLoss / a[1].sets - b[1].logLoss / b[1].sets)) {
  const comparison = name === REFERENCE ? '' : `z=${pairedDifference(score.losses, pooled.get(REFERENCE).losses).z.toFixed(1)}`;
  console.log(`${name.padEnd(46)} ${format(score)}  ${comparison}`);
}

console.log('\nlogloss by dataset');
console.log(`${'dataset'.padEnd(32)} ${HIGHLIGHTED.map((name) => name.slice(0, 14).padStart(15)).join('')}`);
for (const { seriesName, scores } of perSeries) {
  console.log(`${seriesName.padEnd(32)} ${HIGHLIGHTED.map((name) => (scores.get(name).logLoss / scores.get(name).sets).toFixed(4).padStart(15)).join('')}`);
}

console.log(`\n${CHOSEN} vs the rest, pooled (negative mean = ${CHOSEN} is better; |z| > 2 is a real difference)`);
for (const name of HIGHLIGHTED.slice(1)) {
  const { mean, z } = pairedDifference(pooled.get(CHOSEN).losses, pooled.get(name).losses);
  console.log(`  vs ${name.padEnd(42)} ${mean >= 0 ? '+' : ''}${mean.toFixed(4)}  z=${z.toFixed(1)}`);
}
console.log(`\n${CHOSEN} vs ${REFERENCE}, per dataset`);
for (const { seriesName, scores } of perSeries) {
  const { mean, z } = pairedDifference(scores.get(CHOSEN).losses, scores.get(REFERENCE).losses);
  console.log(`  ${seriesName.padEnd(32)} ${mean >= 0 ? '+' : ''}${mean.toFixed(4)}  z=${z.toFixed(1)}`);
}
