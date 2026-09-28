import { readFile, writeFile } from 'node:fs/promises';
import { computeRankings, DEFAULT_OPTIONS } from '../lib/rankings.mjs';

const seriesName = process.argv[2] ?? 'chudhouse';
const listSize = Number(process.argv[3] ?? 20);
const headToHeadSize = 12;

const data = JSON.parse(await readFile(`data/${seriesName}.json`, 'utf8'));
const { events, players, ranked, headToHead } = computeRankings(data);
const tagOf = (playerId) => data.players[playerId].tag;
const ordinalRules = new Intl.PluralRules('en-US', { type: 'ordinal' });
const ordinalSuffixes = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
const ordinal = (value) => `${value}${ordinalSuffixes[ordinalRules.select(value)]}`;
const setRecord = (player) => `${player.wins.length}-${player.losses.length}`;
const opponentList = (entries) =>
  entries.map((entry) => `${tagOf(entry.opponentId)}${entry.count > 1 ? ` ×${entry.count}` : ''}`).join(', ') || '—';

const lines = [];
lines.push(`# ${data.name} Power Ranking — data draft`, '');
lines.push(
  `Built from ${events.length} start.gg events (${events[0].date} → ${events.at(-1).date}), ` +
    `${data.sets.filter((set) => events.some((event) => event.slug === set.eventSlug)).length} sets. ` +
    `Ranked players attended at least ${DEFAULT_OPTIONS.minimumEvents} events.`,
  '',
);

lines.push('## Ranking', '');
lines.push('| # | Player | PR score | Events | Titles | Best | Avg place | Sets | Rating |');
lines.push('|---|---|---|---|---|---|---|---|---|');
for (const player of ranked.slice(0, listSize)) {
  lines.push(
    `| ${player.rank} | **${player.tag}** | ${Math.round(player.conservativeRating)} | ${player.eventsAttended} | ${player.eventWins || ''} | ${ordinal(player.bestPlacement)} | ` +
      `${player.averagePlacement.toFixed(1)} | ${setRecord(player)} | ${Math.round(player.rating)} ± ${Math.round(player.deviation)} |`,
  );
}

lines.push('', '## Panel notes', '');
for (const player of ranked.slice(0, listSize)) {
  lines.push(`**${player.rank}. ${player.tag}** — ${setRecord(player)} in sets across ${player.eventsAttended} events`);
  lines.push(`- Best wins: ${opponentList(player.notableWins)}`);
  lines.push(`- Lost to: ${opponentList(player.notableLosses)}`);
  lines.push(`- Placements: ${player.placements.map((entry) => `${ordinal(entry.placement)} @ ${entry.eventName}`).join(' · ')}`);
  lines.push('');
}

const topRatedButUnranked = players.filter((player) => player.eventsAttended < DEFAULT_OPTIONS.minimumEvents).slice(0, 8);
if (topRatedButUnranked.length) {
  lines.push('## Honorable mentions (too few events to rank)', '');
  for (const player of topRatedButUnranked) {
    lines.push(`- **${player.tag}** — ${player.eventsAttended} event(s), ${setRecord(player)}, best ${ordinal(player.bestPlacement)}. Wins: ${opponentList(player.notableWins)}`);
  }
  lines.push('');
}

const grid = ranked.slice(0, headToHeadSize);
lines.push(`## Head-to-head (top ${grid.length}, row player's set record vs column)`, '');
lines.push(`| | ${grid.map((player) => player.tag).join(' | ')} |`);
lines.push(`|---|${grid.map(() => ':-:').join('|')}|`);
for (const row of grid) {
  const cells = grid.map((column) => {
    if (row.playerId === column.playerId) return '·';
    const { wins, losses } = headToHead(row.playerId, column.playerId);
    return wins + losses ? `${wins}-${losses}` : '';
  });
  lines.push(`| **${row.tag}** | ${cells.join(' | ')} |`);
}

lines.push('', '## Events', '');
for (const event of data.events) {
  const counted = events.includes(event);
  lines.push(`- ${event.date} — ${event.name} (${event.numEntrants} entrants)${counted ? '' : ' — *not counted*'}`);
}

lines.push('', '## Method', '');
lines.push(
  '- Every completed set (DQs removed) feeds a **Glicko-2** rating, with each tournament as one rating period. Beating a highly rated player moves you much more than beating someone new or low-rated.',
  `- Rating deviation (±) shrinks the more you attend and grows while you're away. Players are ordered by **PR score = rating − ${DEFAULT_OPTIONS.conservativeDeviations}×deviation**, so consistent attendance is rewarded and one hot run doesn't top the list.`,
  '- "Best wins" = opponents beaten, highest-rated first. "Lost to" = opponents lost to, lowest-rated first. "Titles" = tournaments won.',
  '- This is a data starting point for the panel, not a final answer.',
);

await writeFile(`output/${seriesName}_pr_draft.md`, lines.join('\n') + '\n');
console.log(`wrote output/${seriesName}_pr_draft.md (${ranked.length} ranked, top ${Math.min(listSize, ranked.length)} shown)`);
