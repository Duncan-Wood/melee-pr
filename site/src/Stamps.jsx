import { eventTitle, monthYear, ordinal } from './format.js';

export default function Stamps({ events, player }) {
  const placementBySlug = new Map(player.placements.map((entry) => [entry.eventSlug, entry.placement]));
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
