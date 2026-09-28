import { eventTitle, fullDate, startggUrl } from './format.js';

export default function Events({ data, settings, setSettings, base }) {
  const included = new Set(settings.includedEventSlugs);
  const largest = Math.max(...data.events.map((event) => event.numEntrants));

  function toggle(slug) {
    const next = new Set(included);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setSettings((current) => ({ ...current, includedEventSlugs: data.events.filter((event) => next.has(event.slug)).map((event) => event.slug) }));
  }

  return (
    <div className="page">
      <h1 className="page-title">Events</h1>
      <p className="page-intro">
        Every bracket in the series, oldest first. Uncheck an event to leave it out of the rankings.
      </p>
      <ol className="timeline">
        {data.events.map((event) => {
          const winner = event.standings.find((standing) => standing.placement === 1);
          const isCounted = included.has(event.slug);
          return (
            <li key={event.slug} className={isCounted ? 'timeline-event' : 'timeline-event timeline-excluded'}>
              <time dateTime={event.date}>{fullDate(event.date)}</time>
              <div className="sheet timeline-sheet">
                <h2>
                  <a href={startggUrl(event)} target="_blank" rel="noreferrer">{eventTitle(event)}</a>
                </h2>
                {event.note && <p className="timeline-note">{event.note}</p>}
                <div className="entrants" aria-label={`${event.numEntrants} entrants`}>
                  <span className="entrants-track">
                    <span className="entrants-bar" style={{ width: `${(event.numEntrants / largest) * 100}%` }} />
                  </span>
                  <span className="entrants-count">{event.numEntrants} entrants</span>
                </div>
                <p className="timeline-winner">
                  {winner ? (
                    <>
                      Won by <a href={`${base}/player/${winner.playerId}`}>{data.players[winner.playerId].tag}</a>
                    </>
                  ) : (
                    'No winner recorded'
                  )}
                </p>
                <label className="timeline-toggle">
                  <input type="checkbox" checked={isCounted} onChange={() => toggle(event.slug)} />
                  Counts toward the rankings
                </label>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
