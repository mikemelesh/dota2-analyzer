const HERO_ICON_BASE = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes';

export function getHeroIconUrl(heroName: string): string {
  const name = heroName.replace('npc_dota_hero_', '');
  return `${HERO_ICON_BASE}/${name}.png`;
}

export function getHeroNameFromId(
  heroes: Record<string, { name?: string; localized_name?: string; id?: number }>,
  heroId: number
): string {
  const h = heroes[String(heroId)] || Object.values(heroes).find((x) => x.id === heroId);
  if (!h) return 'Unknown';
  return h.localized_name || (h.name || '').replace('npc_dota_hero_', '').replace(/_/g, ' ') || 'Unknown';
}

export function getHeroIconUrlById(
  heroes: Record<string, { name?: string; id?: number }>,
  heroId: number
): string {
  const h = heroes[String(heroId)] || Object.values(heroes).find((x) => x.id === heroId);
  if (!h?.name) {
    return 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/default.png';
  }
  return getHeroIconUrl(h.name);
}
