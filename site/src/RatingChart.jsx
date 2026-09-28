import { useState } from 'react';
import useWidth from './useWidth.js';
import { eventTitle, fullDate, monthYear, ordinal } from './format.js';

const HEIGHT = 260;
const MARGIN = { top: 16, right: 20, bottom: 32, left: 48 };

export default function RatingChart({ player, events, deviations }) {
  const [ref, width] = useWidth();
  const [hoverIndex, setHoverIndex] = useState(null);
  const placementBySlug = new Map(player.placements.map((entry) => [entry.eventSlug, entry.placement]));
  const eventIndex = new Map(events.map((event, index) => [event.slug, index]));
  const points = player.history.map((entry) => ({ ...entry, index: eventIndex.get(entry.eventSlug), placement: placementBySlug.get(entry.eventSlug) }));
  const showBand = deviations > 0 && points.some((point) => point.deviation > 0);

  const lows = points.map((point) => point.rating - (showBand ? deviations * point.deviation : 0));
  const highs = points.map((point) => point.rating + (showBand ? deviations * point.deviation : 0));
  const domainLow = Math.floor(Math.min(...lows) / 100) * 100;
  const domainHigh = Math.ceil(Math.max(...highs) / 100) * 100;
  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (index) => MARGIN.left + (events.length === 1 ? plotWidth / 2 : (index / (events.length - 1)) * plotWidth);
  const y = (rating) => MARGIN.top + (1 - (rating - domainLow) / (domainHigh - domainLow)) * plotHeight;

  const tickStep = (domainHigh - domainLow) / 100 > 8 ? 200 : 100;
  const ticks = [];
  for (let value = domainLow; value <= domainHigh; value += tickStep) ticks.push(value);
  const labelEvery = Math.ceil(events.length / Math.max(Math.floor(plotWidth / 56), 1));

  const line = points.map((point, order) => `${order ? 'L' : 'M'}${x(point.index)},${y(point.rating)}`).join('');
  const band = showBand
    ? points.map((point, order) => `${order ? 'L' : 'M'}${x(point.index)},${y(point.rating + deviations * point.deviation)}`).join('') +
      [...points].reverse().map((point) => `L${x(point.index)},${y(point.rating - deviations * point.deviation)}`).join('') +
      'Z'
    : null;

  function onPointerMove(pointerEvent) {
    const bounds = pointerEvent.currentTarget.getBoundingClientRect();
    const pointerX = pointerEvent.clientX - bounds.left;
    let nearest = points[0];
    for (const point of points) if (Math.abs(x(point.index) - pointerX) < Math.abs(x(nearest.index) - pointerX)) nearest = point;
    setHoverIndex(nearest.index);
  }

  const hovered = points.find((point) => point.index === hoverIndex);
  const hoveredEvent = hovered && events[hovered.index];

  return (
    <figure className="rating-chart" ref={ref}>
      <svg width={width} height={HEIGHT} role="img" aria-label={`${player.tag}'s rating after each event`} onPointerMove={onPointerMove} onPointerLeave={() => setHoverIndex(null)}>
        {ticks.map((value) => (
          <g key={value} className="chart-grid">
            <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={y(value)} y2={y(value)} />
            <text x={MARGIN.left - 8} y={y(value)} dy="0.32em" textAnchor="end">{value}</text>
          </g>
        ))}
        {events.map((event, index) =>
          index % labelEvery === 0 ? (
            <text key={event.slug} className="chart-axis-label" x={x(index)} y={HEIGHT - 8} textAnchor="middle">{monthYear(event.date)}</text>
          ) : null,
        )}
        {band && <path className="chart-band" d={band} />}
        <path className="chart-line" d={line} />
        {points.filter((point) => point.placement).map((point) => (
          <circle key={point.eventSlug} className={point.placement === 1 ? 'chart-dot chart-dot-won' : 'chart-dot'} cx={x(point.index)} cy={y(point.rating)} r={(events.length > 40 ? 3 : 5) + (point.placement === 1 ? 2 : 0)} />
        ))}
        {hovered && <line className="chart-crosshair" x1={x(hovered.index)} x2={x(hovered.index)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} />}
      </svg>
      {hovered && (
        <div className="chart-tooltip" style={{ left: Math.min(Math.max(x(hovered.index), 90), width - 90) }}>
          <strong>{eventTitle(hoveredEvent)}</strong>
          <span>{fullDate(hoveredEvent.date)}</span>
          <span>{hovered.placement ? `Placed ${ordinal(hovered.placement)}` : 'Didn’t attend'}</span>
          <span>Rating {Math.round(hovered.rating)}{showBand ? ` ± ${Math.round(hovered.deviation)}` : ''}</span>
        </div>
      )}
      <figcaption>
        Rating after each counted event. Dots mark events they entered{points.some((point) => point.placement === 1) ? ', and the larger, highlighted ones are wins' : ''}.
        {showBand ? ` The shaded band is the rating ± ${deviations}× uncertainty; its bottom edge is the PR score.` : ''}
      </figcaption>
    </figure>
  );
}
