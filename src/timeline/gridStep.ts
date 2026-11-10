export type Box = { top: number; left: number; width: number };

// Moving up or down through pills that wrap into rows (the search's suggestions): to the one in the next row whose
// middle is nearest. Nothing highlighted (-1): down goes to the first, up stays. Up from the first row: back to
// nothing; down from the last: stays.
export function stepRow(boxes: readonly Box[], from: number, direction: 1 | -1): number {
  if (from < 0 || from >= boxes.length) return direction === 1 && boxes.length ? 0 : -1;
  const rows = [...new Set(boxes.map((box) => Math.round(box.top)))].sort((a, b) => a - b);
  const row = rows.indexOf(Math.round(boxes[from].top)) + direction;
  if (row < 0) return -1;
  if (row >= rows.length) return from;
  const middle = (box: Box) => box.left + box.width / 2;
  const origin = middle(boxes[from]);
  const target = rows[row];
  let nearest = from;
  let distance = Number.POSITIVE_INFINITY;
  boxes.forEach((box, index) => {
    const away = Math.abs(middle(box) - origin);
    if (Math.round(box.top) === target && away < distance) {
      nearest = index;
      distance = away;
    }
  });
  return nearest;
}
