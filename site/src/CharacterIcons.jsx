import { characterIconSlug, characterName } from '../../lib/characters.mjs';

const CHARACTERS_WITHOUT_PORTRAITS = new Set(['Sheik / Zelda', 'Random Character']);

export function CharacterPortrait({ characters = [], className = '' }) {
  const main = characters.find((name) => !CHARACTERS_WITHOUT_PORTRAITS.has(characterName(name)));
  if (!main) return null;
  return <img className={`character-portrait ${className}`} src={`${import.meta.env.BASE_URL}portraits/${characterIconSlug(main)}.png`} alt={main} />;
}

export default function CharacterIcons({ characters = [], size = 'small' }) {
  if (characters.length === 0) return null;
  return (
    <span className={`character-icons character-icons-${size}`}>
      {characters.map((name) => (
        <img key={name} src={`${import.meta.env.BASE_URL}characters/${characterIconSlug(characterName(name))}.png`} alt={name} title={name} />
      ))}
    </span>
  );
}
