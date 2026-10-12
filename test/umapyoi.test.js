import { describe, expect, it } from 'vitest';
import { umapyoiUrl } from '../src/umapyoi.js';

describe('umapyoiUrl', () => {
  it("links JP's posts in Japanese and Global's on the English mirror, by the official post id", () => {
    expect(umapyoiUrl('https://umamusume.jp/news/detail/?id=3481')).toBe('https://umapyoi.net/news/3481?lang=jp');
    expect(umapyoiUrl('https://umamusume.com/news/1076/')).toBe('https://umapyoi.net/en/news/1076');
  });
  it('has nothing for an event without a post', () => {
    expect(umapyoiUrl(null)).toBe(null);
    expect(umapyoiUrl('https://gametora.com/umamusume/events')).toBe(null);
  });
});
