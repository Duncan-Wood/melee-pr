import { useState } from 'react';

const SIZE_CHOICES = [8, 12, 16];

function cellTone(wins, losses) {
  if (wins + losses === 0) return 'none';
  const share = wins / (wins + losses);
  if (share === 1) return 'win-strong';
  if (share > 0.5) return 'win';
  if (share === 0.5) return 'even';
  if (share > 0) return 'loss';
  return 'loss-strong';
}

export default function HeadToHead({ results }) {
  const [size, setSize] = useState(12);
  const [hovered, setHovered] = useState(null);
  const grid = results.ranked.slice(0, size);

  const readout = hovered
    ? (() => {
        const { row, column } = hovered;
        const { wins, losses } = results.headToHead(row.playerId, column.playerId);
        if (wins + losses === 0) return `${row.tag} and ${column.tag} haven’t played in a counted event.`;
        return `${row.tag} is ${wins}–${losses} in sets against ${column.tag}.`;
      })()
    : 'Hover or tap a square to read it.';

  return (
    <div className="page">
      <h1 className="page-title">Head-to-head</h1>
      <p className="page-intro">Each row is one player’s set record against each column. Blue means the row player leads, red means they trail.</p>
      <fieldset className="segmented">
        <legend>Players shown</legend>
        {SIZE_CHOICES.map((choice) => (
          <label key={choice}>
            <input type="radio" name="grid-size" checked={size === choice} onChange={() => setSize(choice)} />
            <span>Top {choice}</span>
          </label>
        ))}
      </fieldset>
      <p className="h2h-readout" aria-live="polite">{readout}</p>
      <div className="sheet h2h-sheet">
        <table className="h2h" onPointerLeave={() => setHovered(null)}>
          <thead>
            <tr>
              <td />
              {grid.map((column) => (
                <th key={column.playerId} scope="col">
                  <span>{column.tag}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row.playerId}>
                <th scope="row">
                  <a href={`#/player/${row.playerId}`}>{row.tag}</a>
                </th>
                {grid.map((column) => {
                  if (row.playerId === column.playerId) return <td key={column.playerId} className="h2h-self" />;
                  const { wins, losses } = results.headToHead(row.playerId, column.playerId);
                  const isHovered = hovered && hovered.row === row && hovered.column === column;
                  return (
                    <td
                      key={column.playerId}
                      className={`h2h-cell h2h-${cellTone(wins, losses)}${isHovered ? ' h2h-hovered' : ''}`}
                      onPointerEnter={() => setHovered({ row, column })}
                      onClick={() => setHovered({ row, column })}
                    >
                      {wins + losses ? `${wins}–${losses}` : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="h2h-legend" aria-label="Legend">
        <li><span className="h2h-swatch h2h-win-strong" />Undefeated</li>
        <li><span className="h2h-swatch h2h-win" />Leads</li>
        <li><span className="h2h-swatch h2h-even" />Even</li>
        <li><span className="h2h-swatch h2h-loss" />Trails</li>
        <li><span className="h2h-swatch h2h-loss-strong" />Winless</li>
      </ul>
    </div>
  );
}
