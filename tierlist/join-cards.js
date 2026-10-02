// Rebuilds upstream-format card objects (one per id × limit break, in
// upstream's id/LB order) from metadata plus one server's stats. Each server's
// char_name is in its own language, which scenarioLink relies on.

// Which metadata name each server's char_name comes from.
export const NAME_FIELD = { gl: "name_en", jp: "name_jp" }

export function joinCards(server, metadata, stats) {
  const cards = []
  // Integer keys iterate in ascending order, so cards come out sorted by id.
  for (const [id, levels] of Object.entries(stats)) {
    const meta = metadata[id]
    levels.forEach((levelStats, limit_break) => {
      cards.push({
        id: meta.id,
        type: meta.type,
        group: meta.group,
        rarity: meta.rarity,
        limit_break,
        ...levelStats,
        char_name: meta[NAME_FIELD[server]],
      })
    })
  }
  return cards
}
