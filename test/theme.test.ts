// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setSetting } from '../src/settingsStore.ts';
import { followTheme } from '../src/theme.ts';

const meta = (media: string) => {
  const node = document.createElement('meta');
  node.name = 'theme-color';
  node.media = media;
  document.head.append(node);
  return node;
};

describe('followTheme', () => {
  let stop: () => void;
  let light: HTMLMetaElement;
  let dark: HTMLMetaElement;
  beforeEach(() => {
    setSetting('theme', 'system');
    light = meta('(prefers-color-scheme: light)');
    dark = meta('(prefers-color-scheme: dark)');
    stop = followTheme();
  });
  afterEach(() => {
    stop();
    light.remove();
    dark.remove();
  });

  it("leaves the device's theme alone, each bar colour its own", () => {
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(light.content).not.toBe(dark.content);
  });

  it('puts a chosen theme on the page and the bar, and goes back to the device', () => {
    setSetting('theme', 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(light.content).toBe(dark.content);
    setSetting('theme', 'system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(light.content).not.toBe(dark.content);
  });
});
