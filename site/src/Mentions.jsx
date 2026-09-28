import { ordinal, setRecord } from './format.js';

export function honorableMentions(results, settings, limit = 6) {
  return results.players.filter((player) => player.eventsAttended < settings.minimumEvents).slice(0, limit);
}

export default function Mentions({ results, settings }) {
  const mentions = honorableMentions(results, settings);
  if (mentions.length === 0) return null;
  return (
    <section className="sheet">
      <h2>Honorable mentions</h2>
      <p className="sheet-intro">Strong showings, but fewer than {settings.minimumEvents} counted events, so not ranked.</p>
      <ul className="mentions">
        {mentions.map((player) => (
          <li key={player.playerId}>
            <a href={`#/player/${player.playerId}`}>{player.tag}</a>
            <span>
              {setRecord(player)} in sets across {player.eventsAttended} {player.eventsAttended === 1 ? 'event' : 'events'}, best finish {ordinal(player.bestPlacement)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
