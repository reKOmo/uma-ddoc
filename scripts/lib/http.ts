export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Runs requests one after another (await each before starting the next) with a random pause between them, min–max ms
// (equal: a fixed one). The first request starts at once unless `first` is set (a script that always pauses before a
// request). `pace.pause` can be changed later (news-api's setPause()).
export type Paced = {
  <T>(request: () => Promise<T>): Promise<T>;
  pause: [min: number, max: number];
};

export function paced({ pause, first = false }: { pause: [number, number]; first?: boolean }): Paced {
  let ran = false;
  const pace = async <T>(request: () => Promise<T>): Promise<T> => {
    if (ran || first) await sleep(pace.pause[0] + Math.random() * (pace.pause[1] - pace.pause[0]));
    ran = true;
    return request();
  };
  pace.pause = pause;
  return pace;
}
