import Settings from './Settings.jsx';
import Sparkline from './Sparkline.jsx';
import Mentions from './Mentions.jsx';
import CharacterIcons from './CharacterIcons.jsx';
import { setRecord } from './format.js';
import { ALGORITHMS } from '../../lib/rankings.mjs';

export function methodSummary(settings) {
  if (settings.algorithm === 'elo') {
    return 'Every set updates an Elo rating: beat someone rated above you and you gain more. Players are sorted by rating.';
  }
  const attendance = settings.conservativeDeviations
    ? ` Players are sorted by PR score: rating minus ${settings.conservativeDeviations}× its uncertainty, so a rating backed by lots of events beats one hot run.`
    : ' Players are sorted by rating alone.';
  if (settings.algorithm === 'whr') {
    return `Ratings are fit to every set at once, so a win counts for how strong that opponent turned out to be, not how they were rated that day. Skill can drift slowly between events, and each rating carries an uncertainty that shrinks the more a player shows up.${attendance}`;
  }
  return `Every set updates a Glicko-2 rating, and beating a strong player counts for much more than beating a new one. The rating also carries an uncertainty that shrinks each time a player shows up.${attendance}`;
}

export default function Rankings(props) {
  const { data, results, settings, base } = props;
  const scoreLabel = ALGORITHMS[settings.algorithm].hasUncertainty && settings.conservativeDeviations ? 'PR score' : 'Rating';

  if (results.events.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Rankings</h1>
        <Settings {...props} />
        <p className="empty">No events are counted. Pick at least one event above to build a ranking.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Rankings</h1>
      <p className="page-intro">{methodSummary(settings)} Change anything below and the list reorders.</p>
      <Settings {...props} />
      <div className="sheet table-sheet">
        <table className="rankings-table">
          <thead>
            <tr>
              <th scope="col" className="numeric">#</th>
              <th scope="col">Player</th>
              <th scope="col" className="trend-column">Trend</th>
              <th scope="col" className="numeric">{scoreLabel}</th>
              <th scope="col" className="numeric">Sets</th>
              <th scope="col" className="numeric">Events</th>
              <th scope="col" className="numeric optional-column">Titles</th>
              <th scope="col" className="numeric optional-column" title="Average finish as a share of each bracket, so 9th of 30 is top 30%">Avg top %</th>
            </tr>
          </thead>
          <tbody>
            {results.ranked.map((player) => (
              <tr key={player.playerId} onClick={() => (window.location.hash = `${base}/player/${player.playerId}`)}>
                <td className="numeric rank-cell">{player.rank}</td>
                <th scope="row">
                  <span className="player-cell">
                    <a href={`${base}/player/${player.playerId}`}>{player.tag}</a>
                    <CharacterIcons characters={data.players[player.playerId].characters} />
                  </span>
                </th>
                <td className="trend-column">
                  <Sparkline history={player.history} />
                </td>
                <td className="numeric">{Math.round(player.conservativeRating)}</td>
                <td className="numeric">{setRecord(player)}</td>
                <td className="numeric">{player.eventsAttended}</td>
                <td className="numeric optional-column">{player.eventWins || ''}</td>
                <td className="numeric optional-column">{Math.round(player.averageTopPercent)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Mentions results={results} settings={settings} base={base} />
    </div>
  );
}
