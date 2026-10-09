/**
 * Read-only access to the star and planet catalogues (public/data/*.json):
 * lookups, multiple-star systems, distances and name search.
 */

/** Folds case, accents and superscripts so "alpha1 cen" finds "Alpha¹ Centauri". */
export const normalize = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** True for bare catalogue designations, which get lower label priority on the map. */
export const isCatalogueName = (name) => /^(Gliese|GJ|HD|HIP|HYG|LHS|LTT|LP|G|L|TOI|WISEP?|CWISEP|VHS|COCONUTS)[\s-]/.test(name);

export function createCatalog(starsData, planetsData) {
  const stars = starsData.stars;
  const byId = new Map();
  const systems = new Map();

  for (const s of stars) {
    byId.set(s.id, s);
    if (!systems.has(s.sys)) systems.set(s.sys, { id: s.sys, name: s.sysName, members: [] });
    systems.get(s.sys).members.push(s);
  }
  for (const sys of systems.values()) {
    sys.primary = byId.get(sys.id);
    sys.members.sort((a, b) =>
      a === sys.primary ? -1 : b === sys.primary ? 1 : (a.comp ?? '').localeCompare(b.comp ?? ''),
    );
    sys.planets = sys.members.flatMap((m) =>
      (planetsData.byStar[m.id] ?? []).map((p) => ({ ...p, starId: m.id })),
    );
  }

  const searchIndex = stars.map((star) => ({
    star,
    keys: [...new Set([star.name, star.sysName, ...star.aliases].map(normalize))],
  }));

  const star = (id) => byId.get(id);
  const system = (id) => systems.get(id);

  return {
    stars,
    systems: [...systems.values()],
    star,
    system,
    systemOf: (starId) => systems.get(byId.get(starId)?.sys),
    planetsOf: (starId) => planetsData.byStar[starId] ?? [],

    /** Light-years between two stars. */
    distance(aId, bId) {
      const a = byId.get(aId);
      const b = byId.get(bId);
      return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    },

    /** Stars matching a name or designation, best matches first. */
    search(query, limit = 8) {
      const q = normalize(query);
      if (!q) return [];
      const hits = [];
      for (const { star: s, keys } of searchIndex) {
        let score = 0;
        for (const k of keys) {
          if (k === q) score = Math.max(score, 4);
          else if (k.startsWith(q)) score = Math.max(score, 3);
          else if (k.includes(` ${q}`)) score = Math.max(score, 2);
          else if (k.includes(q)) score = Math.max(score, 1);
        }
        if (score) hits.push({ s, score });
      }
      hits.sort((a, b) => b.score - a.score || a.s.d - b.s.d);
      return hits.slice(0, limit).map((h) => h.s);
    },
  };
}
