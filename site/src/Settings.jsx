import { ALGORITHMS } from '../../lib/rankings.mjs';
import { eventTitle, monthYear } from './format.js';

export default function Settings({ data, settings, setSettings, resetSettings }) {
  const update = (changes) => setSettings((current) => ({ ...current, ...changes }));
  const included = new Set(settings.includedEventSlugs);

  function toggleEvent(slug) {
    const next = new Set(included);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    update({ includedEventSlugs: data.events.filter((event) => next.has(event.slug)).map((event) => event.slug) });
  }

  return (
    <section className="settings" aria-label="Ranking settings">
      <fieldset className="segmented">
        <legend>Rating system</legend>
        {Object.entries(ALGORITHMS).map(([value, label]) => (
          <label key={value}>
            <input type="radio" name="algorithm" checked={settings.algorithm === value} onChange={() => update({ algorithm: value })} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <label className="control">
        <span>Minimum events to be ranked</span>
        <span className="stepper">
          <button onClick={() => update({ minimumEvents: Math.max(1, settings.minimumEvents - 1) })} aria-label="Fewer events">−</button>
          <output>{settings.minimumEvents}</output>
          <button onClick={() => update({ minimumEvents: Math.min(included.size, settings.minimumEvents + 1) })} aria-label="More events">+</button>
        </span>
      </label>

      {settings.algorithm === 'glicko2' && (
        <label className="control">
          <span>Attendance weight</span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.5"
            value={settings.conservativeDeviations}
            onChange={(changeEvent) => update({ conservativeDeviations: Number(changeEvent.target.value) })}
          />
          <output>{settings.conservativeDeviations === 0 ? 'Off' : `${settings.conservativeDeviations}×`}</output>
        </label>
      )}

      <details className="event-picker">
        <summary>
          Counting {included.size} of {data.events.length} events
        </summary>
        <ul>
          {data.events.map((event) => (
            <li key={event.slug}>
              <label>
                <input type="checkbox" checked={included.has(event.slug)} onChange={() => toggleEvent(event.slug)} />
                <span>{eventTitle(event)}</span>
                <span className="muted">{monthYear(event.date)}</span>
              </label>
            </li>
          ))}
        </ul>
      </details>

      <button className="link-button" onClick={resetSettings}>Reset to the default</button>
    </section>
  );
}
