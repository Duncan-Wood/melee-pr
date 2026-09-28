export default function Numeral({ value, size = 'large', animateKey }) {
  return (
    <span className={`numeral numeral-${size}`} key={animateKey} aria-label={`Rank ${value}`}>
      <span className="numeral-blue" aria-hidden="true">{value}</span>
      <span className="numeral-red" aria-hidden="true">{value}</span>
    </span>
  );
}
