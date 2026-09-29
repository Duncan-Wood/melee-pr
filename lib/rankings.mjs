import glicko2 from 'glicko2';

export const DEFAULT_OPTIONS = {
  algorithm: 'glicko2',
  minimumEvents: 3,
  conservativeDeviations: 2,
  tau: 0.5,
  eloKFactor: 32,
};

export const STARTING_RATING = 1500;

export const ALGORITHMS = {
  glicko2: 'Glicko-2',
  elo: 'Elo',
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

const RATERS = { glicko2: glicko2Rater, elo: eloRater };

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
    rater.ratePeriod(results);

    for (const [playerId, player] of stats) {
      player.history.push({ eventSlug: event.slug, date: event.date, rating: rater.rating(playerId), deviation: rater.deviation(playerId) });
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
      averagePlacement: placementValues.reduce((sum, value) => sum + value, 0) / placementValues.length,
      eventWins: placementValues.filter((value) => value === 1).length,
    };
  });

  const ratingById = new Map(players.map((player) => [player.playerId, player.rating]));
  for (const player of players) {
    player.notableWins = uniqueOpponents(player.wins, 'loserId', ratingById).sort((a, b) => b.opponentRating - a.opponentRating).slice(0, 4);
    player.notableLosses = uniqueOpponents(player.losses, 'winnerId', ratingById)
      .sort((a, b) => a.opponentRating - b.opponentRating)
      .slice(0, 3);
  }

  players.sort((a, b) => b.conservativeRating - a.conservativeRating);
  const ranked = players.filter((player) => player.eventsAttended >= minimumEvents);
  ranked.forEach((player, index) => (player.rank = index + 1));

  return { events, players, ranked, headToHead: headToHead(data.sets.filter((set) => included.has(set.eventSlug))) };
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
