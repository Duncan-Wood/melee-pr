import { readFile, writeFile } from 'node:fs/promises';

const seriesName = process.argv[2] ?? 'chudhouse';
const series = JSON.parse(await readFile(`series/${seriesName}.json`, 'utf8'));
const aliases = series.aliases ?? {};
const tagOverrides = series.tagOverrides ?? {};
if (!series.timezone) throw new Error(`series/${seriesName}.json needs a "timezone" (e.g. "America/Chicago") so event dates are local`);
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: series.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });

const players = {};
const events = [];
const sets = [];
const skipped = { disqualifications: 0, byes: 0, unfinished: 0 };

function canonicalPlayer(entrant, context) {
  const participants = entrant.participants ?? [];
  if (participants.length !== 1 || !participants[0].player?.id) {
    throw new Error(`Expected exactly one player on entrant ${entrant.id} (${context}), got ${JSON.stringify(participants)}`);
  }
  const { id, gamerTag } = participants[0].player;
  const playerId = String(aliases[String(id)] ?? id);
  return { playerId, gamerTag: tagOverrides[playerId] ?? gamerTag };
}

const rawEvents = await Promise.all(
  series.events.map(async (config) => ({
    config,
    raw: JSON.parse(await readFile(`data/raw/${config.slug.split('/')[1]}.json`, 'utf8')),
  })),
);
rawEvents.sort((a, b) => a.raw.event.startAt - b.raw.event.startAt);

for (const { config, raw } of rawEvents) {
  const { event } = raw;
  const entrantToPlayer = new Map();

  const standings = raw.standings.map((standing) => {
    const { playerId, gamerTag } = canonicalPlayer(standing.entrant, config.slug);
    entrantToPlayer.set(standing.entrant.id, playerId);
    players[playerId] = { id: playerId, tag: gamerTag };
    return { playerId, placement: standing.placement };
  });

  for (const set of raw.sets) {
    const [first, second] = set.slots;
    if (!first?.entrant || !second?.entrant) {
      skipped.byes++;
      continue;
    }
    const scores = set.slots.map((slot) => slot.standing?.stats?.score?.value ?? null);
    if (set.displayScore === 'DQ' || scores.includes(-1)) {
      skipped.disqualifications++;
      continue;
    }
    if (set.winnerId == null) {
      skipped.unfinished++;
      console.warn(`unfinished set ${set.id} in ${config.slug} (${set.fullRoundText})`);
      continue;
    }

    const winnerIndex = set.slots.findIndex((slot) => slot.entrant.id === set.winnerId);
    if (winnerIndex === -1) throw new Error(`Winner ${set.winnerId} not in set ${set.id} (${config.slug})`);
    const loserIndex = 1 - winnerIndex;
    const winner = canonicalPlayer(set.slots[winnerIndex].entrant, config.slug);
    const loser = canonicalPlayer(set.slots[loserIndex].entrant, config.slug);

    sets.push({
      id: set.id,
      eventSlug: config.slug,
      round: set.round,
      roundName: set.fullRoundText,
      winnerId: winner.playerId,
      loserId: loser.playerId,
      winnerScore: scores[winnerIndex],
      loserScore: scores[loserIndex],
    });
  }

  events.push({
    slug: config.slug,
    tournamentSlug: event.tournament.slug,
    name: event.tournament.name,
    date: localDate.format(new Date(event.startAt * 1000)),
    numEntrants: event.numEntrants,
    countsForPR: config.countsForPR,
    note: config.note ?? null,
    standings,
  });
}

await writeFile(`data/${seriesName}.json`, JSON.stringify({ name: series.name, defaults: series.defaults ?? {}, events, players, sets }, null, 2));
console.log(`${events.length} events, ${Object.keys(players).length} players, ${sets.length} sets`);
console.log(`skipped: ${JSON.stringify(skipped)}`);
