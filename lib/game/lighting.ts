import { createRandom } from './core';
import type { GameTheme } from './theme';

const ENVIRONMENT_COLORS = [
  'skyTop',
  'skyBottom',
  'cloudFar',
  'cloudNear',
  'distantCity',
  'buildingOutline',
  'windowDark',
  'windowLit',
  'ground',
  'groundEdge',
  'craterRim',
] as const;

type LightingPalette = Partial<
  Pick<GameTheme['palette'], (typeof ENVIRONMENT_COLORS)[number] | 'facades'>
>;

export type LightingPreset = {
  id: string;
  palette: LightingPalette;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

// Optional lighting must never make an otherwise usable theme fail to load.
export function parseLightingPresets(
  value: unknown,
): LightingPreset[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const ids = new Set<string>();
  const presets: LightingPreset[] = [];
  for (const preset of value) {
    if (
      !isRecord(preset) ||
      typeof preset.id !== 'string' ||
      !preset.id.trim() ||
      ids.has(preset.id) ||
      !isRecord(preset.palette)
    )
      return undefined;

    const palette: LightingPalette = {};
    for (const [key, color] of Object.entries(preset.palette)) {
      if (key === 'facades') {
        if (
          !Array.isArray(color) ||
          color.length === 0 ||
          !color.every(isColor)
        ) {
          return undefined;
        }
        palette.facades = [...color];
      } else {
        const field = ENVIRONMENT_COLORS.find((field) => field === key);
        if (!field || !isColor(color)) return undefined;
        palette[field] = color;
      }
    }
    ids.add(preset.id);
    presets.push({ id: preset.id, palette });
  }
  return presets;
}

export function resolveLightingTheme(
  theme: GameTheme,
  seed: number,
): GameTheme {
  const presets = parseLightingPresets(theme.lightingPresets);
  if (!presets) return theme;
  // An isolated visual stream leaves skyline, wind, and AI randomness untouched.
  const random = createRandom(seed ^ 0x4c494748);
  const preset = presets[Math.floor(random() * presets.length)];
  return { ...theme, palette: { ...theme.palette, ...preset.palette } };
}
