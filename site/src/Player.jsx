import Numeral from './Numeral.jsx';
import RatingChart from './RatingChart.jsx';
import Stamps from './Stamps.jsx';
import WhyRank from './WhyRank.jsx';
import CharacterIcons, { PlayerPortrait } from './CharacterIcons.jsx';
import { eventTitle, fullDate, ordinal, setRecord, startggUrl, tagSizeClass } from './format.js';
import { ALGORITHMS } from '../../lib/rankings.mjs';

export default function Player({ data, results, settings, playerId, base }) {
  const player = results.players.find((candidate) => candidate.playerId === playerId);
  const tagOf = (id) => data.players[id].tag;

  if (!player) {
    const tag = data.players[playerId]?.tag;
    return (
      <div className="page">
        <a className="back-link" href={`${base}/rankings`}>Back to rankings</a>
        <p className="empty">
          {tag ? `${tag} didn’t play any of the events being counted. Add their events on the rankings page to see them here.` : 'There’s no player with that link. Pick someone from the rankings.'}
        </p>
      </div>
    );
  }

  const deviations = ALGORITHMS[settings.algorithm].hasUncertainty ? settings.conservativeDeviations : 0;
  const counted = new Set(results.events.map((event) => event.slug));
  const playerSets = data.sets.filter((set) => counted.has(set.eventSlug) && (set.winnerId === playerId || set.loserId === playerId));
  const eventsAttended = results.events.filter((event) => player.placements.some((entry) => entry.eventSlug === event.slug)).reverse();

  return (
    <div className="page">
      <a className="back-link" href={`${base}/rankings`}>Back to rankings</a>
      <header className="player-header">
        {player.rank ? <Numeral value={player.rank} size="medium" /> : <span className="unranked-badge">Unranked</span>}
        <div>
          <h1 className={`player-tag ${tagSizeClass(player.tag)}`}>{player.tag}</h1>
          <CharacterIcons characters={data.players[playerId].characters} size="medium" />
          <p className="player-summary">
            {setRecord(player)} in sets across {player.eventsAttended} {player.eventsAttended === 1 ? 'event' : 'events'}
            {player.eventWins ? `, ${player.eventWins} ${player.eventWins === 1 ? 'title' : 'titles'}` : ''}. Rating {Math.round(player.rating)}
            {deviations ? ` ± ${Math.round(player.deviation)}` : ''}.
            {!player.rank && ` Needs ${settings.minimumEvents} counted events to be ranked.`}
          </p>
        </div>
        <PlayerPortrait player={data.players[playerId]} className="player-portrait" />
      </header>

      <section className="sheet">
        <RatingChart player={player} events={results.events} deviations={deviations} />
        <Stamps events={results.events} player={player} />
      </section>

      <WhyRank player={player} results={results} settings={settings} tagOf={tagOf} base={base} />

      <section className="sheet">
        <h2>Every set</h2>
        {eventsAttended.map((event) => {
          const placement = player.placements.find((entry) => entry.eventSlug === event.slug).placement;
          const sets = playerSets.filter((set) => set.eventSlug === event.slug);
          return (
            <div className="event-sets" key={event.slug}>
              <h3>
                <a href={startggUrl(event)} target="_blank" rel="noreferrer">{eventTitle(event)}</a>
                <span className="muted">{fullDate(event.date)}, {ordinal(placement)} of {event.numEntrants}</span>
              </h3>
              <ul>
                {sets.map((set) => {
                  const won = set.winnerId === playerId;
                  const opponentId = won ? set.loserId : set.winnerId;
                  const score = set.winnerScore != null && set.loserScore != null ? (won ? `${set.winnerScore}–${set.loserScore}` : `${set.loserScore}–${set.winnerScore}`) : '';
                  return (
                    <li key={set.id} className={won ? 'set-won' : 'set-lost'}>
                      <span className="set-result">{won ? 'W' : 'L'}</span>
                      <span className="set-score">{score}</span>
                      <a href={`${base}/player/${opponentId}`}>{tagOf(opponentId)}</a>
                      <span className="muted set-round">{set.roundName}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
