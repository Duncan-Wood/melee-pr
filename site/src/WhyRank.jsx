import { STARTING_RATING } from '../../lib/rankings.mjs';
import { eventTitle, monthYear, ordinal } from './format.js';

const MAXIMUM_SWINGS = 3;

const round = Math.round;
const eventCount = (player) => `${player.eventsAttended} ${player.eventsAttended === 1 ? 'event' : 'events'}`;
const signed = (value) => (value > 0 ? `+${round(value)}` : `−${round(Math.abs(value))}`);

function scoreSentence(player, deviations) {
  if (!deviations) return `Rating ${round(player.rating)}.`;
  return `PR score ${round(player.conservativeRating)}: rating ${round(player.rating)} minus ${deviations} × ${round(player.deviation)} uncertainty from ${eventCount(player)}.`;
}

function gapReason(ahead, behind, deviations) {
  if (deviations && ahead.rating < behind.rating) {
    const lessCertain = behind.eventsAttended < ahead.eventsAttended ? `from fewer events, ${behind.eventsAttended} to ${ahead.eventsAttended}` : 'less certain after time away';
    return `${behind.tag} is rated higher, ${round(behind.rating)} to ${round(ahead.rating)}, but ${lessCertain}.`;
  }
  return `${ahead.tag} is rated higher, ${round(ahead.rating)} to ${round(behind.rating)}.`;
}

function Neighbor({ player, other, results, deviations, base }) {
  const isAhead = other.rank < player.rank;
  const [ahead, behind] = isAhead ? [other, player] : [player, other];
  const gap = round(ahead.conservativeRating - behind.conservativeRating);
  const record = results.headToHead(player.playerId, other.playerId);
  const played = record.wins + record.losses > 0;
  return (
    <li>
      <p>
        <strong>
          #{other.rank} <a href={`${base}/player/${other.playerId}`}>{other.tag}</a>
        </strong>
        , {gap} {gap === 1 ? 'point' : 'points'} {isAhead ? 'ahead' : 'behind'}
      </p>
      <p className="muted">
        {gapReason(ahead, behind, deviations)}{' '}
        {played ? `Head-to-head ${record.wins}–${record.losses}.` : 'Never played in a counted event.'}
      </p>
    </li>
  );
}

function ratingSwings(player, events, tagOf) {
  const eventBySlug = new Map(events.map((event) => [event.slug, event]));
  const placementBySlug = new Map(player.placements.map((entry) => [entry.eventSlug, entry.placement]));
  let previousRating = STARTING_RATING;
  const swings = [];
  for (const entry of player.history) {
    const change = entry.rating - previousRating;
    previousRating = entry.rating;
    if (!placementBySlug.has(entry.eventSlug)) continue;
    const tagsAt = (sets, opponentKey) => [...new Set(sets.filter((set) => set.eventSlug === entry.eventSlug).map((set) => tagOf(set[opponentKey])))];
    swings.push({
      event: eventBySlug.get(entry.eventSlug),
      placement: placementBySlug.get(entry.eventSlug),
      change,
      beat: tagsAt(player.wins, 'loserId'),
      lostTo: tagsAt(player.losses, 'winnerId'),
    });
  }
  return {
    boosts: swings.filter((swing) => swing.change > 0).sort((a, b) => b.change - a.change).slice(0, MAXIMUM_SWINGS),
    hits: swings.filter((swing) => swing.change < 0).sort((a, b) => a.change - b.change).slice(0, MAXIMUM_SWINGS),
  };
}

function SwingList({ title, swings }) {
  return (
    <div>
      <h3>{title}</h3>
      {swings.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <ul className="swing-list">
          {swings.map((swing) => (
            <li key={swing.event.slug}>
              <span className={`swing-change ${swing.change > 0 ? 'swing-up' : 'swing-down'}`}>{signed(swing.change)}</span>
              <span>
                <strong>{eventTitle(swing.event)}</strong>, {monthYear(swing.event.date)}, {ordinal(swing.placement)}
                <span className="muted swing-sets">
                  {swing.beat.length > 0 && `Beat ${swing.beat.join(', ')}. `}
                  {swing.lostTo.length > 0 && `Lost to ${swing.lostTo.join(', ')}.`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WhyRank({ player, results, settings, tagOf, base }) {
  const deviations = settings.algorithm === 'glicko2' ? settings.conservativeDeviations : 0;
  const { boosts, hits } = ratingSwings(player, results.events, tagOf);
  const neighbors = player.rank ? [results.ranked[player.rank - 2], results.ranked[player.rank]].filter(Boolean) : [];
  const placeIfRanked = results.ranked.filter((other) => other.conservativeRating > player.conservativeRating).length + 1;

  return (
    <section className="sheet why-rank">
      <h2>{player.rank ? `Why #${player.rank}` : 'Why unranked'}</h2>
      <p className="sheet-intro">
        {scoreSentence(player, deviations)}
        {!player.rank &&
          ` Needs ${settings.minimumEvents} events to be ranked. Today’s ${deviations ? 'score' : 'rating'} would rank #${placeIfRanked}.`}
      </p>
      {neighbors.length > 0 && (
        <ul className="neighbor-list">
          {neighbors.map((other) => (
            <Neighbor key={other.playerId} player={player} other={other} results={results} deviations={deviations} base={base} />
          ))}
        </ul>
      )}
      <p className="sheet-intro">
        Everyone starts at {STARTING_RATING}.{settings.algorithm === 'glicko2' && ' Early events swing a rating the most.'}
      </p>
      <div className="two-up">
        <SwingList title="Biggest boosts" swings={boosts} />
        <SwingList title="Biggest drops" swings={hits} />
      </div>
    </section>
  );
}
