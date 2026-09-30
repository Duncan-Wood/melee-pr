import { readFile, writeFile, access, readdir, stat } from 'node:fs/promises';
import { characterIconSlug, characterName } from '../lib/characters.mjs';

const MAIN_SHARE_OF_GAMES = 0.2;
const MAXIMUM_PHOTO_BYTES = 300_000;
const MAXIMUM_MAINS = 3;

const seriesName = process.argv[2] ?? 'chudhouse';
const series = JSON.parse(await readFile(`series/${seriesName}.json`, 'utf8'));
const aliases = series.aliases ?? {};
const tagOverrides = series.tagOverrides ?? {};
const characterOverrides = series.characters ?? {};
if (!series.timezone) throw new Error(`series/${seriesName}.json needs a "timezone" (e.g. "America/Chicago") so event dates are local`);
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: series.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });

const players = {};
const events = [];
const sets = [];
const skipped = { disqualifications: 0, byes: 0, unfinished: 0 };
const gamesByCharacter = new Map();

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

    for (const game of set.games ?? []) {
      for (const selection of game.selections ?? []) {
        if (!selection.character) continue;
        const slot = set.slots.find((candidate) => candidate.entrant.id === selection.entrant.id);
        if (!slot) throw new Error(`Character pick for entrant ${selection.entrant.id} not in set ${set.id} (${config.slug})`);
        const { playerId } = canonicalPlayer(slot.entrant, config.slug);
        const counts = gamesByCharacter.get(playerId) ?? new Map();
        counts.set(selection.character.name, (counts.get(selection.character.name) ?? 0) + 1);
        gamesByCharacter.set(playerId, counts);
      }
    }

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

function mainsFromGames(counts) {
  const totalGames = [...counts.values()].reduce((sum, games) => sum + games, 0);
  return [...counts]
    .filter(([, games]) => games / totalGames >= MAIN_SHARE_OF_GAMES)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAXIMUM_MAINS)
    .map(([name]) => name);
}

for (const playerId of Object.keys(characterOverrides)) {
  if (!players[playerId]) throw new Error(`"characters" in series/${seriesName}.json names player ${playerId}, who isn't in any event (use the main id, not an alias)`);
}
for (const player of Object.values(players)) {
  player.characters = characterOverrides[player.id] ?? mainsFromGames(gamesByCharacter.get(player.id) ?? new Map());
  for (const main of player.characters) {
    await requireFile(`site/public/characters/${characterIconSlug(characterName(main))}.png`, `No icon for character "${main}" (player ${player.id})`);
    if (main !== characterName(main)) {
      await requireFile(`site/public/portraits/${characterIconSlug(main)}.png`, `No costume "${main}" (player ${player.id})`);
    }
  }
}

const photoDirectory = `site/public/photos/${seriesName}`;
const photoFiles = await readdir(photoDirectory).catch((error) => (error.code === 'ENOENT' ? [] : Promise.reject(error)));
for (const file of photoFiles) {
  const playerId = file.replace(/\.jpg$/, '');
  if (!file.endsWith('.jpg') || !players[playerId]) throw new Error(`${photoDirectory}/${file} should be named <player id>.jpg for a player in this series`);
  const { size } = await stat(`${photoDirectory}/${file}`);
  if (size > MAXIMUM_PHOTO_BYTES) throw new Error(`${photoDirectory}/${file} is ${Math.round(size / 1000)} KB; shrink it first (e.g. sips -Z 800 -s formatOptions 80)`);
  players[playerId].photo = `photos/${seriesName}/${file}`;
}

async function requireFile(path, message) {
  try {
    await access(path);
  } catch {
    throw new Error(`${message}; expected ${path}`);
  }
}

await writeFile(`data/${seriesName}.json`, JSON.stringify({ name: series.name, defaults: series.defaults ?? {}, events, players, sets }, null, 2));
console.log(`${events.length} events, ${Object.keys(players).length} players, ${sets.length} sets`);
console.log(`skipped: ${JSON.stringify(skipped)}`);
console.log(`${Object.values(players).filter((player) => player.characters.length).length} players with characters`);
