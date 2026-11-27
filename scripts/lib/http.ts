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

// Who we are, for the sites we read.
export const SCRAPER_HEADERS: Record<string, string> = {
  'User-Agent': 'uma-ddoc scraper (Umaddoc, static tier list site)',
};

type GetOptions = { headers?: Record<string, string>; what?: string };

// A GET that throws on an error status, naming `what` (the URL by default).
export async function getOk(url: string, { headers, what = url }: GetOptions = {}): Promise<Response> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${what}: ${res.status} ${res.statusText}`);
  return res;
}
export const getJson = async (url: string, options?: GetOptions): Promise<unknown> =>
  (await getOk(url, options)).json();
export const getText = async (url: string, options?: GetOptions): Promise<string> => (await getOk(url, options)).text();
