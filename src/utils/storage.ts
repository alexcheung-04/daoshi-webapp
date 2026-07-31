import type { PlannedTask, AppState } from '@/types';
import { DEFAULT_LLM_CONFIG } from '@/types';

const KEY_PREFIX = 'daoshi';

function getCurrentUser(): string | null {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}:session`);
    return raw || null;
  } catch {
    return null;
  }
}

function userKey(base: string): string {
  const user = getCurrentUser();
  if (!user) return `${KEY_PREFIX}:${base}:__guest__`;
  return `${KEY_PREFIX}:${base}:${user}`;
}

export const storage = {
  loadTasks(): PlannedTask[] {
    const user = getCurrentUser();
    if (!user) return [];

    try {
      const raw = localStorage.getItem(userKey('tasks'));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveTasks(tasks: PlannedTask[]): void {
    const user = getCurrentUser();
    if (!user) return;
    localStorage.setItem(userKey('tasks'), JSON.stringify(tasks));
  },

  loadAppState(): AppState {
    const user = getCurrentUser();
    if (!user) {
      return {
        appMode: 'daily',
        appearance: 'system',
        completionSound: 'bell',
        notificationsEnabled: true,
        llm: { ...DEFAULT_LLM_CONFIG },
      };
    }

    try {
      const raw = localStorage.getItem(userKey('state'));
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          appMode: parsed.appMode ?? 'daily',
          appearance: parsed.appearance ?? 'system',
          completionSound: parsed.completionSound ?? 'bell',
          notificationsEnabled: parsed.notificationsEnabled ?? true,
          llm: parsed.llm ?? { ...DEFAULT_LLM_CONFIG },
        };
      }
    } catch { /* ignore */ }
    return {
      appMode: 'daily',
      appearance: 'system',
      completionSound: 'bell',
      notificationsEnabled: true,
      llm: { ...DEFAULT_LLM_CONFIG },
    };
  },

  saveAppState(state: AppState): void {
    const user = getCurrentUser();
    if (!user) return;
    localStorage.setItem(userKey('state'), JSON.stringify(state));
  },

  loadCompletedBlockIDs(): Set<string> {
    const user = getCurrentUser();
    if (!user) return new Set();

    try {
      const raw = localStorage.getItem(userKey('completedBlocks'));
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  },

  saveCompletedBlockIDs(ids: Set<string>): void {
    const user = getCurrentUser();
    if (!user) return;
    localStorage.setItem(userKey('completedBlocks'), JSON.stringify([...ids]));
  },
};
