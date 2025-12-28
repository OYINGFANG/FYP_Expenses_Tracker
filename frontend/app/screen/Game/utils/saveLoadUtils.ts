// app/screen/Game/utils/saveLoadUtils.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState, GameSaveListItem } from '../types';
import { localStorageKeys } from '../data/constants';

// --- platform storage shim ----------------------------------------------------
const hasWebLocalStorage =
  typeof window !== 'undefined' &&
  typeof (window as any).localStorage !== 'undefined';

const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (hasWebLocalStorage) {
        return (window as any).localStorage.getItem(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn('Storage getItem error', e);
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      if (hasWebLocalStorage) {
        (window as any).localStorage.setItem(key, value);
        return;
      }
      // fire-and-forget to keep reducers synchronous
      AsyncStorage.setItem(key, value).catch((e) =>
        console.warn('Storage setItem error', e)
      );
    } catch (e) {
      console.warn('Storage setItem error (sync)', e);
    }
  },
  removeItem(key: string): void {
    try {
      if (hasWebLocalStorage) {
        (window as any).localStorage.removeItem(key);
        return;
      }
      AsyncStorage.removeItem(key).catch((e) =>
        console.warn('Storage removeItem error', e)
      );
    } catch (e) {
      console.warn('Storage removeItem error (sync)', e);
    }
  },
};

// --- helpers ------------------------------------------------------------------
/**
 * Get userId from AsyncStorage. Returns null if not found.
 */
const getUserId = async (): Promise<string | null> => {
  try {
    if (hasWebLocalStorage) {
      return (window as any).localStorage.getItem('userId');
    }
    return await AsyncStorage.getItem('userId');
  } catch (e) {
    console.warn('Get userId error', e);
    return null;
  }
};

/**
 * Get user-specific storage key by appending userId to the base key.
 * If userId is not available, uses the base key (for backward compatibility).
 */
const getUserStorageKey = async (baseKey: string): Promise<string> => {
  const userId = await getUserId();
  if (userId) {
    return `${baseKey}_${userId}`;
  }
  return baseKey;
};

/**
 * Get user-specific save key for a game save.
 * Format: sh_save__userId_gameId
 */
const getUserSaveKey = async (gameId: string): Promise<string> => {
  const userId = await getUserId();
  const basePrefix = localStorageKeys.savePrefix;
  if (userId) {
    return `${basePrefix}${userId}_${gameId}`;
  }
  return `${basePrefix}${gameId}`;
};

const getSaveListItemFromGameState = (gameState: GameState): GameSaveListItem => ({
  id: gameState.id,
  location: gameState.location,
  numTurns: gameState.numTurns,
  netWealth: gameState.netWealth,
  modifiedAt: `${Date.now()}`,
});

const zpadDateTime = (v: number) => (v > 9 ? `${v}` : `0${v}`);

export const getShortRealDate = (timestamp: string) => {
  const d = new Date(parseInt(`${timestamp}`, 10));
  const months = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec',
  ];
  const h = d.getHours();
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} @${
    h > 12 ? zpadDateTime(h - 12) : zpadDateTime(h)
  }:${zpadDateTime(d.getMinutes())}${h > 11 ? 'PM' : 'AM'}`;
};

const localSavesListAdapter = (localSavesList: GameSaveListItem[]) =>
  localSavesList.map((item) => ({
    ...item,
    location: `${item.location.charAt(0).toUpperCase()}${item.location.substring(1)}`,
    netWealth: item.netWealth,
    modifiedAt: getShortRealDate(item.modifiedAt),
  }));

// --- public API ---------------------------------------------------------------

/**
 * Save current game to storage. If `isQuickSave` is true, use the quick slot,
 * else save under an id-specific key and maintain an index.
 *
 * Note: keep it fire-and-forget (no awaits) so reducers can call it safely.
 */
export const saveGameLocal = async (gameState: GameState, isQuickSave: boolean) => {
  const gameStateNow: GameState = {
    ...gameState,
    modifiedAt: `${Date.now()}`,
  };

  try {
    const quickSaveKey = await getUserStorageKey(localStorageKeys.quickSaveKey);
    const saveKey = isQuickSave
      ? quickSaveKey
      : await getUserSaveKey(gameState.id);

    storage.setItem(saveKey, JSON.stringify(gameStateNow));

    if (!isQuickSave) {
      const savesIndexKey = await getUserStorageKey(localStorageKeys.savesIndex);
      const savesListRaw = await storage.getItem(savesIndexKey);
      let savesList: GameSaveListItem[] = [];
      if (savesListRaw && savesListRaw.length > 1) {
        try {
          savesList = JSON.parse(savesListRaw) as GameSaveListItem[];
        } catch {
          savesList = [];
        }
      }

      const saveListItem = getSaveListItemFromGameState(gameStateNow);
      const isNew = !savesList.some((item) => item.id === gameState.id);

      const newSavesList = (isNew
        ? [saveListItem, ...savesList]
        : savesList.map((item) => (item.id === gameState.id ? saveListItem : item))
      ).sort((a, b) => {
        // Sort descending (newest first) by comparing timestamps
        const aTime = parseInt(a.modifiedAt, 10);
        const bTime = parseInt(b.modifiedAt, 10);
        return bTime - aTime; // Descending order
      });

      storage.setItem(savesIndexKey, JSON.stringify(newSavesList));
    }
  } catch (err) {
    console.error('Save Game Error', err);
  }
};

/** Returns adapted list with pretty dates; [] if none. */
export const getLocalSavesList = async (): Promise<GameSaveListItem[]> => {
  try {
    const savesIndexKey = await getUserStorageKey(localStorageKeys.savesIndex);
    const savesListRaw = await storage.getItem(savesIndexKey);
    let savesList: GameSaveListItem[] = [];
    if (savesListRaw && savesListRaw.length > 1) {
      try {
        savesList = JSON.parse(savesListRaw) as GameSaveListItem[];
      } catch {
        savesList = [];
      }
    }
    // Sort by modifiedAt descending (newest first) before applying adapter
    const sortedSaves = savesList.sort((a, b) => {
      const aTime = parseInt(a.modifiedAt, 10);
      const bTime = parseInt(b.modifiedAt, 10);
      return bTime - aTime; // Descending order (newest first)
    });
    return sortedSaves.length > 0 ? localSavesListAdapter(sortedSaves) : [];
  } catch (err) {
    console.error('get save list error', err);
    return [];
  }
};

export const getQuickSave = async (): Promise<GameState | null> => {
  try {
    const quickSaveKey = await getUserStorageKey(localStorageKeys.quickSaveKey);
    const raw = await storage.getItem(quickSaveKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as GameState;
    } catch {
      return null;
    }
  } catch (err) {
    console.error('Load QuickSave Error', err);
    return null;
  }
};

export const getLocalGameSave = async (gameId: string): Promise<GameState | null> => {
  try {
    const saveKey = await getUserSaveKey(gameId);
    const raw = await storage.getItem(saveKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as GameState;
    } catch {
      return null;
    }
  } catch (err) {
    console.error('Load Save Error', err);
    return null;
  }
};

export const deleteSaveItem = async (gameId: string) => {
  try {
    const saveKey = await getUserSaveKey(gameId);
    storage.removeItem(saveKey);

    const savesIndexKey = await getUserStorageKey(localStorageKeys.savesIndex);
    const savesListRaw = await storage.getItem(savesIndexKey);
    let savesList: GameSaveListItem[] = [];
    if (savesListRaw && savesListRaw.length > 1) {
      try {
        savesList = JSON.parse(savesListRaw) as GameSaveListItem[];
      } catch {
        savesList = [];
      }
      const newSavesList = savesList.filter((save) => save.id !== gameId);
      storage.setItem(savesIndexKey, JSON.stringify(newSavesList));
    }
  } catch (err) {
    console.error('Delete Save Error', err);
  }
};
