const ordinalRules = new Intl.PluralRules('en-US', { type: 'ordinal' });
const ordinalSuffixes = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

export const ordinal = (value) => `${value}${ordinalSuffixes[ordinalRules.select(value)]}`;

const asDate = (date) => new Date(`${date}T00:00:00Z`);
export const shortMonth = (date) => monthFormat.format(asDate(date));
export const monthYear = (date) => `${shortMonth(date)} ’${date.slice(2, 4)}`;
export const fullDate = (date) => `${shortMonth(date)} ${asDate(date).getUTCDate()}, ${date.slice(0, 4)}`;

export const eventTitle = (event) =>
  event.name
    .replace(/^chud ?house\s+[\d./]+$/i, 'CHUD HOUSE')
    .replace(/\s+[\d./]+$/, '')
    .replace(/^CHUD HOUSE FINALE$/i, 'CHUD HOUSE Finale');

export const startggUrl = (event) => `https://www.start.gg/${event.slug}/standings`;

export const setRecord = (player) => `${player.wins.length}–${player.losses.length}`;
