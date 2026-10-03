// Pure layout for the banner timeline: positions in days from an origin, so
// the view only multiplies by its zoom (pixels per day).

export const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// Greedy interval packing: each banner goes in the first row that's free by
// its start, so overlapping banners stack and the row count stays minimal.
function packRows(items) {
  const rows = [];
  for (const item of [...items].sort((a, b) => a.start - b.start)) {
    const row = rows.find((r) => r.end <= item.start);
    if (row) {
      row.items.push(item);
      row.end = item.end;
    } else {
      rows.push({ items: [item], end: item.end });
    }
  }
  return rows.map((r) => r.items);
}

// sections: [{ key, label, banners }] → everything the view needs to draw.
export function buildTimeline(sections, now = Date.now()) {
  const all = sections.flatMap((s) => s.banners);
  const times = all.flatMap((b) => [Date.parse(b.start), Date.parse(b.end)]);
  // A week of padding before the first banner, a month after the last (or today).
  const origin = startOfDay(Math.min(...times)) - 7 * DAY;
  const last = Math.max(...times, now) + 30 * DAY;
  const day = (ms) => (ms - origin) / DAY;

  // One entry per calendar day, for the day row of the axis.
  const dayDates = [];
  for (const d = new Date(origin); d.getTime() < last; d.setDate(d.getDate() + 1)) {
    dayDates.push({ day: day(d.getTime()), date: d.getDate() });
  }

  const months = [];
  const cursor = new Date(origin);
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() + 1);
  while (cursor.getTime() < last) {
    months.push({ date: new Date(cursor), day: day(cursor.getTime()) });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return {
    days: day(last),
    today: day(now),
    dayDates,
    months,
    sections: sections.map((s) => ({
      key: s.key,
      label: s.label,
      rows: packRows(
        s.banners.map((banner) => {
          const start = Date.parse(banner.start);
          const end = Date.parse(banner.end);
          return { banner, start, end, from: day(start), length: (end - start) / DAY };
        })
      ),
    })),
  };
}
