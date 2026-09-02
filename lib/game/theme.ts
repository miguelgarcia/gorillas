export type PixelSprite = {
  rows: string[];
  colors: Record<string, string>;
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
};

function isTheme(value: unknown): value is GameTheme {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GameTheme>;
  return Boolean(
    candidate.id &&
    candidate.name &&
    candidate.palette?.facades?.length &&
    candidate.sprites?.gorilla?.rows?.length &&
    candidate.sprites?.banana?.rows?.length &&
    candidate.sprites?.flag?.rows?.length,
  );
}

export async function loadTheme(url: string): Promise<GameTheme> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Theme request failed with ${response.status}`);
  }
  const value: unknown = await response.json();
  if (!isTheme(value)) throw new Error('Theme manifest is incomplete');
  return value;
}
