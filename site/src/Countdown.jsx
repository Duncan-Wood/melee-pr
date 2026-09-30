import { useCallback, useEffect, useState } from 'react';
import Numeral from './Numeral.jsx';
import Stamps from './Stamps.jsx';
import Sparkline from './Sparkline.jsx';
import Mentions from './Mentions.jsx';
import CharacterIcons, { PlayerPortrait } from './CharacterIcons.jsx';
import { fullDate, ordinal, setRecord } from './format.js';

const LENGTH_CHOICES = [10, 15, 20];

function opponentNames(entries, tagOf, limit) {
  return entries.slice(0, limit).map((entry) => (entry.count > 1 ? `${tagOf(entry.opponentId)} ×${entry.count}` : tagOf(entry.opponentId)));
}

function tagSizeClass(tag) {
  if (tag.length > 16) return 'tag-long';
  if (tag.length > 9) return 'tag-medium';
  return 'tag-short';
}

export default function Countdown({ data, results, settings, base }) {
  const [length, setLength] = useState(10);
  const [step, setStep] = useState(-1);
  const countdownLength = Math.min(length, results.ranked.length);
  const tagOf = (playerId) => data.players[playerId].tag;
  const totalSets = data.sets.filter((set) => results.events.some((event) => event.slug === set.eventSlug)).length;

  const next = useCallback(() => setStep((current) => Math.min(current + 1, countdownLength)), [countdownLength]);
  const previous = useCallback(() => setStep((current) => Math.max(current - 1, -1)), []);

  useEffect(() => {
    function onKeyDown(keyEvent) {
      if (keyEvent.target.closest('button, a, input, select')) return;
      if (['ArrowRight', ' ', 'Enter'].includes(keyEvent.key)) {
        keyEvent.preventDefault();
        next();
      }
      if (keyEvent.key === 'ArrowLeft') previous();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [next, previous]);

  if (step === -1) {
    const first = results.events[0];
    const last = results.events.at(-1);
    return (
      <section className="countdown countdown-intro">
        <h1 className="poster-title">
          <span>The {data.name}</span>
          <span>Power Rankings</span>
        </h1>
        <p className="poster-facts">
          {results.events.length} brackets from {fullDate(first.date)} to {fullDate(last.date)}. {totalSets} sets played. Every one of them counted.
        </p>
        <fieldset className="segmented">
          <legend>Count down from</legend>
          {LENGTH_CHOICES.filter((choice) => choice <= results.ranked.length || choice === LENGTH_CHOICES[0]).map((choice) => (
            <label key={choice}>
              <input type="radio" name="countdown-length" checked={length === choice} onChange={() => setLength(choice)} />
              <span>#{choice}</span>
            </label>
          ))}
        </fieldset>
        <button className="button-primary" onClick={next} autoFocus>
          Start the countdown
        </button>
        <p className="hint">Tap the card or press → to reveal the next player.</p>
      </section>
    );
  }

  if (step === countdownLength) {
    return (
      <section className="countdown countdown-outro">
        <h1 className="poster-title">
          <span>That’s the list.</span>
        </h1>
        <Mentions results={results} settings={settings} base={base} />
        <div className="countdown-actions">
          <button className="button-secondary" onClick={() => setStep(-1)}>Watch it again</button>
          <a className="button-primary" href={`${base}/rankings`}>See the full rankings</a>
        </div>
      </section>
    );
  }

  const player = results.ranked[countdownLength - 1 - step];
  const bestWins = opponentNames(player.notableWins, tagOf, 3);
  return (
    <section className="countdown">
      <article className="reveal-card" onClick={next} key={player.playerId}>
        <div className="reveal-rank">
          <Numeral value={player.rank} />
        </div>
        <div className="reveal-body">
          <div className="reveal-heading">
            <div>
              <h1 className={`reveal-tag ${tagSizeClass(player.tag)}`}>{player.tag}</h1>
              <CharacterIcons characters={data.players[player.playerId].characters} size="large" />
            </div>
            <PlayerPortrait player={data.players[player.playerId]} className="reveal-portrait" />
          </div>
          <div className="sheet reveal-sheet">
            <dl className="facts">
              <div>
                <dt>Sets</dt>
                <dd>{setRecord(player)}</dd>
              </div>
              <div>
                <dt>{player.eventWins === 1 ? 'Title' : 'Titles'}</dt>
                <dd>{player.eventWins}</dd>
              </div>
              <div>
                <dt>Best finish</dt>
                <dd>{ordinal(player.bestPlacement)}</dd>
              </div>
              <div>
                <dt>Showed up</dt>
                <dd>
                  {player.eventsAttended}<small>/{results.events.length}</small>
                </dd>
              </div>
            </dl>
            {bestWins.length > 0 && (
              <p className="best-wins">
                <span>Best wins</span> {bestWins.join(', ')}
              </p>
            )}
            <Stamps events={results.events} player={player} />
            <div className="reveal-trend">
              <span>Rating over time</span>
              <Sparkline history={player.history} width={200} height={40} />
            </div>
          </div>
        </div>
      </article>
      <div className="countdown-controls">
        <button className="button-secondary" onClick={previous} aria-label="Previous player">←</button>
        <span className="countdown-progress">{step + 1} of {countdownLength}</span>
        <button className="button-primary" onClick={next}>{player.rank === 1 ? 'Finish' : `Reveal #${player.rank - 1}`}</button>
      </div>
    </section>
  );
}
