export const characterIconSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const characterName = (main) => main.replace(/ \(.+\)$/, '');
