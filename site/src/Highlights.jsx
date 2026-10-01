import { winChance } from '../../lib/rankings.mjs';
import { eventTitle, monthYear } from './format.js';

const LIST_SIZE = 5;

function biggestUpsets(data, results) {
  const ratingById = new Map(results.players.map((player) => [player.playerId, player.rating]));
  const eventBySlug = new Map(results.events.map((event) => [event.slug, event]));
  return data.sets
    .filter((set) => eventBySlug.has(set.eventSlug))
    .map((set) => ({ set, chance: winChance(ratingById.get(set.winnerId), ratingById.get(set.loserId)), event: eventBySlug.get(set.eventSlug) }))
    .sort((a, b) => a.chance - b.chance)
    .slice(0, LIST_SIZE);
}

function mostImproved(results) {
  return results.ranked
    .map((player) => ({ player, gain: player.history.at(-1).rating - player.history[0].rating }))
    .filter((entry) => entry.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, LIST_SIZE);
}

function mostPlayedMatchups(data, results) {
  const counted = new Set(results.events.map((event) => event.slug));
  const pairs = new Map();
  for (const set of data.sets) {
    if (!counted.has(set.eventSlug)) continue;
    const [first, second] = [set.winnerId, set.loserId].sort();
    const pair = pairs.get(`${first}:${second}`) ?? { first, second, firstWins: 0, sets: 0 };
    pair.sets++;
    if (set.winnerId === first) pair.firstWins++;
    pairs.set(`${first}:${second}`, pair);
  }
  return [...pairs.values()]
    .sort((a, b) => b.sets - a.sets)
    .slice(0, LIST_SIZE)
    .map((pair) => (pair.firstWins * 2 >= pair.sets ? { leader: pair.first, trailer: pair.second, wins: pair.firstWins, losses: pair.sets - pair.firstWins } : { leader: pair.second, trailer: pair.first, wins: pair.sets - pair.firstWins, losses: pair.firstWins }));
}

export default function Highlights({ data, results, settings, base }) {
  if (results.events.length === 0) return null;
  const tagOf = (playerId) => data.players[playerId].tag;
  const playerLink = (playerId) => <a href={`${base}/player/${playerId}`}>{tagOf(playerId)}</a>;
  const improved = settings.algorithm === 'whr' ? mostImproved(results) : [];

  return (
    <section className="sheet highlights">
      <h2>Highlights</h2>
      <div className="highlight-lists">
        <div>
          <h3>Biggest upsets</h3>
          <ol>
            {biggestUpsets(data, results).map(({ set, chance, event }) => (
              <li key={set.id}>
                {playerLink(set.winnerId)} over {playerLink(set.loserId)}
                <span className="muted">
                  {Math.round(chance * 100)}% chance, {eventTitle(event)}, {monthYear(event.date)}
                </span>
              </li>
            ))}
          </ol>
        </div>
        {improved.length > 0 && (
          <div>
            <h3>Most improved</h3>
            <ol>
              {improved.map(({ player, gain }) => (
                <li key={player.playerId}>
                  {playerLink(player.playerId)}
                  <span className="muted">+{Math.round(gain)} rating since their first event</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div>
          <h3>Most-played matchups</h3>
          <ol>
            {mostPlayedMatchups(data, results).map((pair) => (
              <li key={`${pair.leader}:${pair.trailer}`}>
                {playerLink(pair.leader)} vs {playerLink(pair.trailer)}
                <span className="muted">
                  {pair.wins + pair.losses} sets, {pair.wins === pair.losses ? `tied ${pair.wins}–${pair.losses}` : `${tagOf(pair.leader)} leads ${pair.wins}–${pair.losses}`}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
