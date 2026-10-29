export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Runs requests one after another (await each before starting the next) with a random pause between them, min–max ms
// (equal: a fixed one). The first request starts at once unless `first` is set (a script that always pauses before a
// request).
export function paced({ pause: [min, max], first = false }: { pause: [number, number]; first?: boolean }) {
  let ran = false;
  return async <T>(request: () => Promise<T>): Promise<T> => {
    if (ran || first) await sleep(min + Math.random() * (max - min));
    ran = true;
    return request();
  };
}
