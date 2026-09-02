export type PixelSprite = {
  rows: string[];
  colors: Record<string, string>;
};

export type GorillaPose = 'idle' | 'aim' | 'throw' | 'victory' | 'hit';

export type GorillaSpriteSheet = {
  src: string;
  columns: number;
  rows: number;
  frames: Record<GorillaPose, number>;
  playerRows: [number, number];
  baselineOffsets: [number, number];
  renderWidth: number;
  renderHeight: number;
  image: HTMLImageElement;
};

export type GameTheme = {
  id: string;
  name: string;
  palette: {
    skyTop: string;
    skyBottom: string;
    cloudFar: string;
    cloudNear: string;
    distantCity: string;
    buildingOutline: string;
    facades: string[];
    windowDark: string;
    windowLit: string;
    ground: string;
    groundEdge: string;
    p1: string;
    p2: string;
    ring: string;
    ringFill: string;
    banana: string;
    craterRim: string;
    explosionCore: string;
    explosionEdge: string;
    text: string;
    panel: string;
    panelBorder: string;
  };
  sprites: {
    gorilla: PixelSprite;
    banana: PixelSprite;
    flag: PixelSprite;
  };
  gorillaSheet?: GorillaSpriteSheet;
};

type GorillaSpriteSheetConfig = Omit<GorillaSpriteSheet, 'image'>;
type GameThemeManifest = Omit<GameTheme, 'gorillaSheet'> & {
  gorillaSheet?: GorillaSpriteSheetConfig;
};

function isTheme(value: unknown): value is GameThemeManifest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GameThemeManifest>;
  const sheet = candidate.gorillaSheet;
  const validSheet =
    !sheet ||
    (typeof sheet.src === 'string' &&
      sheet.columns > 0 &&
      sheet.rows > 0 &&
      sheet.renderWidth > 0 &&
      sheet.renderHeight > 0 &&
      sheet.playerRows.length === 2 &&
      sheet.baselineOffsets.length === 2 &&
      sheet.baselineOffsets.every((offset) => offset >= 0 && offset < 0.5) &&
      ['idle', 'aim', 'throw', 'victory', 'hit'].every((pose) =>
        Number.isInteger(sheet.frames[pose as GorillaPose]),
      ));
  return Boolean(
    candidate.id &&
    candidate.name &&
    candidate.palette?.facades?.length &&
    candidate.sprites?.gorilla?.rows?.length &&
    candidate.sprites?.banana?.rows?.length &&
    candidate.sprites?.flag?.rows?.length &&
    validSheet,
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Theme image failed to load: ${src}`));
    image.src = src;
  });
}

export async function loadTheme(url: string): Promise<GameTheme> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Theme request failed with ${response.status}`);
  }
  const value: unknown = await response.json();
  if (!isTheme(value)) throw new Error('Theme manifest is incomplete');
  const { gorillaSheet, ...theme } = value;
  if (!gorillaSheet) return theme;
  return {
    ...theme,
    gorillaSheet: {
      ...gorillaSheet,
      image: await loadImage(gorillaSheet.src),
    },
  };
}
