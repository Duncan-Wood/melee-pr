export default function Sparkline({ history, width = 96, height = 28 }) {
  if (history.length < 2) return <svg className="sparkline" width={width} height={height} aria-hidden="true" />;
  const ratings = history.map((entry) => entry.rating);
  const low = Math.min(...ratings);
  const high = Math.max(...ratings);
  const span = high - low || 1;
  const points = ratings.map((rating, index) => [
    2 + (index / (ratings.length - 1)) * (width - 6),
    3 + (1 - (rating - low) / span) * (height - 6),
  ]);
  const [lastX, lastY] = points.at(-1);
  return (
    <svg className="sparkline" width={width} height={height} aria-hidden="true">
      <polyline points={points.map((point) => point.join(',')).join(' ')} />
      <circle cx={lastX} cy={lastY} r="3" />
    </svg>
  );
}
