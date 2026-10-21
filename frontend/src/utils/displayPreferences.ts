export const DISPLAY_PREFERENCES_KEY = 'unas:display-preferences';
const LAYOUT_VERSION = 3;

export interface DisplayPreferences {
  sidebarMini: boolean;
  compactTables: boolean;
  fullWidth: boolean;
}

export const defaultDisplayPreferences: DisplayPreferences = {
  sidebarMini: false,
  compactTables: false,
  fullWidth: false,
};

export function parseDisplayPreferences(raw: string | null): DisplayPreferences {
  try {
    const saved = JSON.parse(raw ?? '{}') as Partial<DisplayPreferences> & {
      layoutVersion?: number;
    };
    return {
      sidebarMini: saved.sidebarMini === true,
      compactTables: saved.compactTables === true,
      fullWidth: saved.layoutVersion === LAYOUT_VERSION ? saved.fullWidth === true : false,
    };
  } catch {
    return { ...defaultDisplayPreferences };
  }
}

export function serializeDisplayPreferences(preferences: DisplayPreferences): string {
  return JSON.stringify({ ...preferences, layoutVersion: LAYOUT_VERSION });
}
