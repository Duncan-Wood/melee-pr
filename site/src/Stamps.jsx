import { eventTitle, monthYear, ordinal } from './format.js';

const MAXIMUM_STAMPS = 24;

function AttendanceStrip({ events, placementBySlug }) {
  const tickClass = (placement) => {
    if (!placement) return undefined;
    if (placement === 1) return 'tick-won';
    if (placement <= 3) return 'tick-podium';
    return 'tick-attended';
  };
  return (
    <div className="attendance-strip">
      <ol aria-label="Result at each counted event, oldest first">
        {events.map((event) => {
          const placement = placementBySlug.get(event.slug);
          const description = placement ? `${ordinal(placement)} at ${eventTitle(event)}` : `Missed ${eventTitle(event)}`;
          return <li key={event.slug} className={tickClass(placement)} title={description} />;
        })}
      </ol>
      <ul className="attendance-legend" aria-hidden="true">
        <li><span style={{ background: 'var(--warm)' }} />Won</li>
        <li><span style={{ background: 'var(--cool)' }} />Top 3</li>
        <li><span style={{ background: 'var(--ink-soft)' }} />Entered</li>
        <li><span style={{ background: 'var(--line)' }} />Missed</li>
        <li>{monthYear(events[0].date)} to {monthYear(events.at(-1).date)}</li>
      </ul>
    </div>
  );
}

export default function Stamps({ events, player }) {
  const placementBySlug = new Map(player.placements.map((entry) => [entry.eventSlug, entry.placement]));
  if (events.length > MAXIMUM_STAMPS) return <AttendanceStrip events={events} placementBySlug={placementBySlug} />;
  return (
    <ol className="stamps" aria-label="Placement at each counted event">
      {events.map((event) => {
        const placement = placementBySlug.get(event.slug);
        const state = placement === 1 ? 'won' : placement ? 'attended' : 'missed';
        const description = placement ? `${ordinal(placement)} at ${eventTitle(event)}, ${monthYear(event.date)}` : `Missed ${eventTitle(event)}, ${monthYear(event.date)}`;
        return (
          <li key={event.slug} className={`stamp stamp-${state}`} title={description} aria-label={description}>
            <span className="stamp-mark">{placement ?? ''}</span>
            <span className="stamp-month">{monthYear(event.date).replace(' ’', '\n’')}</span>
          </li>
        );
      })}
    </ol>
  );
}
