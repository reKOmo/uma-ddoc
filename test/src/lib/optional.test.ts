import { describe, expect, it, vi } from 'vitest';
import { optionalJson } from '../../../src/lib/optional.ts';

describe('optionalJson', () => {
  it('gives null without the file', async () => {
    expect(await optionalJson<number>({})()).toBeNull();
  });

  it('loads the file once', async () => {
    const load = vi.fn(async () => 7);
    const loader = optionalJson({ 'file.json': load });
    expect(await loader()).toBe(7);
    expect(await loader()).toBe(7);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
