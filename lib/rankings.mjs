import glicko2 from 'glicko2';
import { createWholeHistoryRating, dayNumber } from './whr.mjs';

export const DEFAULT_OPTIONS = {
  algorithm: 'whr',
  minimumEvents: 3,
  conservativeDeviations: 2,
  tau: 0.5,
  eloKFactor: 32,
  whrDriftEloPerSqrtDay: 5,
  whrPriorGames: 0.25,
};

export const STARTING_RATING = 1500;

export const winChance = (rating, opponentRating) => 1 / (1 + 10 ** ((opponentRating - rating) / 400));

export const ALGORITHMS = {
  whr: { label: 'Whole-History', hasUncertainty: true },
  glicko2: { label: 'Glicko-2', hasUncertainty: true },
  elo: { label: 'Elo', hasUncertainty: false },
};

function glicko2Rater({ tau }) {
  const ranking = new glicko2.Glicko2({ tau, rating: STARTING_RATING, rd: 350, vol: 0.06 });
  const players = new Map();
  return {
    add: (playerId) => players.set(playerId, ranking.makePlayer()),
    ratePeriod: (results) => ranking.updateRatings(results.map(([winnerId, loserId]) => [players.get(winnerId), players.get(loserId), 1])),
    rating: (playerId) => players.get(playerId).getRating(),
    deviation: (playerId) => players.get(playerId).getRd(),
  };
}

function eloRater({ eloKFactor }) {
  const ratings = new Map();
  return {
    add: (playerId) => ratings.set(playerId, STARTING_RATING),
    ratePeriod: (results) => {
      for (const [winnerId, loserId] of results) {
        const winnerRating = ratings.get(winnerId);
        const loserRating = ratings.get(loserId);
        const expectedWin = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
        const change = eloKFactor * (1 - expectedWin);
        ratings.set(winnerId, winnerRating + change);
        ratings.set(loserId, loserRating - change);
      }
    },
    rating: (playerId) => ratings.get(playerId),
    deviation: () => 0,
  };
}

function wholeHistoryRater({ whrDriftEloPerSqrtDay, whrPriorGames }) {
  const model = createWholeHistoryRating({ driftEloPerSqrtDay: whrDriftEloPerSqrtDay, priorGames: whrPriorGames });
  let isFitted = false;
  const fitted = () => {
    if (!isFitted) model.fit();
    isFitted = true;
    return model;
  };
  return {
    add: () => {},
    ratePeriod: (results, event) => {
      model.addEvent(dayNumber(event.date), results);
      isFitted = false;
    },
    rating: (playerId) => fitted().rating(playerId),
    deviation: (playerId) => fitted().deviation(playerId),
    historyFor: (playerId, events) => {
      const played = fitted().history(playerId);
      if (played.length === 0) {
        return events.map((event) => ({ eventSlug: event.slug, date: event.date, rating: model.rating(playerId), deviation: model.deviation(playerId) }));
      }
      return events.map((event) => {
        const day = dayNumber(event.date);
        const latest = played.findLast((entry) => entry.day <= day) ?? played[0];
        const drift = whrDriftEloPerSqrtDay ** 2 * Math.max(day - latest.day, 0);
        return { eventSlug: event.slug, date: event.date, rating: latest.rating, deviation: Math.sqrt(latest.deviation ** 2 + drift) };
      });
    },
  };
}

const RATERS = { glicko2: glicko2Rater, whr: wholeHistoryRater, elo: eloRater };

export function computeRankings(data, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const { includedEventSlugs, minimumEvents, conservativeDeviations } = settings;
  if (!RATERS[settings.algorithm]) throw new Error(`Unknown ranking algorithm "${settings.algorithm}"`);
  const included = new Set(includedEventSlugs ?? data.events.filter((event) => event.countsForPR).map((event) => event.slug));
  const events = data.events.filter((event) => included.has(event.slug));

  const rater = RATERS[settings.algorithm](settings);
  const stats = new Map();

  function statsFor(playerId) {
    if (!stats.has(playerId)) {
      stats.set(playerId, { playerId, tag: data.players[playerId].tag, placements: [], wins: [], losses: [], history: [] });
      rater.add(playerId);
    }
    return stats.get(playerId);
  }

  for (const event of events) {
    for (const { playerId, placement } of event.standings) {
      statsFor(playerId).placements.push({ eventSlug: event.slug, eventName: event.name, date: event.date, placement, numEntrants: event.numEntrants });
    }

    const eventSets = data.sets.filter((set) => set.eventSlug === event.slug);
    const results = eventSets.map((set) => {
      statsFor(set.winnerId).wins.push(set);
      statsFor(set.loserId).losses.push(set);
      return [set.winnerId, set.loserId];
    });
    rater.ratePeriod(results, event);

    if (rater.historyFor) continue;
    for (const [playerId, player] of stats) {
      player.history.push({ eventSlug: event.slug, date: event.date, rating: rater.rating(playerId), deviation: rater.deviation(playerId) });
    }
  }

  if (rater.historyFor) {
    for (const player of stats.values()) {
      const firstEventIndex = events.findIndex((event) => event.slug === player.placements[0].eventSlug);
      player.history = rater.historyFor(player.playerId, events.slice(firstEventIndex));
    }
  }

  const players = [...stats.values()].map((player) => {
    const rating = rater.rating(player.playerId);
    const deviation = rater.deviation(player.playerId);
    const placementValues = player.placements.map((entry) => entry.placement);
    return {
      ...player,
      rating,
      deviation,
      conservativeRating: rating - conservativeDeviations * deviation,
      eventsAttended: player.placements.length,
      bestPlacement: Math.min(...placementValues),
      averageTopPercent: (100 * player.placements.reduce((sum, entry) => sum + entry.placement / entry.numEntrants, 0)) / player.placements.length,
      eventWins: placementValues.filter((value) => value === 1).length,
    };
  });

  const ratingById = new Map(players.map((player) => [player.playerId, player.rating]));
  for (const player of players) {
    player.notableWins = uniqueOpponents(player.wins, 'loserId', ratingById).sort((a, b) => b.opponentRating - a.opponentRating).slice(0, 4);
  }

  players.sort((a, b) => b.conservativeRating - a.conservativeRating);
  const ranked = players.filter((player) => player.eventsAttended >= minimumEvents);
  ranked.forEach((player, index) => (player.rank = index + 1));
  if (ranked.some((player) => player.deviation > 0)) addRankRanges(ranked, conservativeDeviations);

  return { events, players, ranked, headToHead: headToHead(data.sets.filter((set) => included.has(set.eventSlug))) };
}

const RANK_SIMULATIONS = 2000;
const RANK_RANGE_COVERAGE = 0.8;

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function addRankRanges(ranked, conservativeDeviations) {
  const random = seededRandom(1);
  const standardNormal = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  const simulatedRanks = ranked.map(() => []);
  for (let simulation = 0; simulation < RANK_SIMULATIONS; simulation++) {
    const scores = ranked.map((player) => player.rating + player.deviation * standardNormal() - conservativeDeviations * player.deviation);
    const order = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score);
    order.forEach(({ index }, position) => simulatedRanks[index].push(position + 1));
  }
  const tail = (1 - RANK_RANGE_COVERAGE) / 2;
  ranked.forEach((player, index) => {
    const ranks = simulatedRanks[index].sort((a, b) => a - b);
    player.rankRange = { best: ranks[Math.floor(tail * RANK_SIMULATIONS)], worst: ranks[Math.ceil((1 - tail) * RANK_SIMULATIONS) - 1] };
  });
}

function uniqueOpponents(sets, opponentKey, ratingById) {
  const byOpponent = new Map();
  for (const set of sets) {
    const opponentId = set[opponentKey];
    const entry = byOpponent.get(opponentId) ?? { opponentId, opponentRating: ratingById.get(opponentId), count: 0 };
    entry.count++;
    byOpponent.set(opponentId, entry);
  }
  return [...byOpponent.values()];
}

export function headToHead(sets) {
  const records = new Map();
  for (const { winnerId, loserId } of sets) {
    const key = `${winnerId}:${loserId}`;
    records.set(key, (records.get(key) ?? 0) + 1);
  }
  return (playerId, opponentId) => ({
    wins: records.get(`${playerId}:${opponentId}`) ?? 0,
    losses: records.get(`${opponentId}:${playerId}`) ?? 0,
  });
}
