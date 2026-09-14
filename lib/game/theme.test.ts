import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '../../public/themes/storm/theme.json';
import { loadTheme } from './theme';

const { gorillaSheet: _sheet, lightingPresets: _lighting, ...base } = manifest;
function serve(value: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => value,
    }),
  );
}
afterEach(() => vi.unstubAllGlobals());

describe('optional theme lighting', () => {
  it('loads valid presets without modifying the base manifest', async () => {
    const data = { ...base, lightingPresets: manifest.lightingPresets };
    const before = structuredClone(data);
    serve(data);
    const theme = await loadTheme('/theme.json');
    expect(theme.lightingPresets).toEqual(manifest.lightingPresets);
    expect(theme.palette).toEqual(base.palette);
    expect(data).toEqual(before);
  });

  it.each(
    [
      undefined,
      null,
      [],
      {},
      [null],
      [{ id: '', palette: {} }],
      [{ id: '   ', palette: {} }],
      [{ id: 'one' }],
      [{ id: 'one', palette: [] }],
      [
        { id: 'one', palette: {} },
        { id: 'one', palette: {} },
      ],
      [{ id: 'one', palette: { skyTop: '#fff' } }],
      [{ id: 'one', palette: { skyTop: '#gggggg' } }],
      [{ id: 'one', palette: { skyTop: 42 } }],
      [{ id: 'one', palette: { p1: '#ffffff' } }],
      [{ id: 'one', palette: { facades: [] } }],
      [{ id: 'one', palette: { facades: ['#123456', 'bad'] } }],
      [
        { id: 'valid', palette: {} },
        { id: 'invalid', palette: { ground: 'red' } },
      ],
    ].map((lightingPresets) => ({ lightingPresets })),
  )(
    'falls back to base for absent or malformed data (%#)',
    async ({ lightingPresets }) => {
      serve({ ...base, lightingPresets });
      const theme = await loadTheme('/theme.json');
      expect(theme.lightingPresets).toBeUndefined();
      expect(theme.palette).toEqual(base.palette);
      expect(theme.sprites).toEqual(base.sprites);
    },
  );

  it('still rejects missing required theme data', async () => {
    serve({ ...base, sprites: {}, lightingPresets: manifest.lightingPresets });
    await expect(loadTheme('/theme.json')).rejects.toThrow('incomplete');
  });

  it('still reports a failed theme request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(loadTheme('/theme.json')).rejects.toThrow('404');
  });
});
