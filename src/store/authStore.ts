import { create } from 'zustand';

const USERS_KEY = 'daoshi:users';
const SESSION_KEY = 'daoshi:session';

interface StoredUser {
  username: string;
  name: string;
  password: string;
  avatarUrl?: string;
}

interface UserProfile {
  username: string;
  name: string;
  initial: string;
  avatarColor: string;
  avatarUrl?: string;
}

interface AuthStore {
  currentUser: string | null;
  profile: UserProfile | null;
  isLoggedIn: boolean;
  showLoginModal: boolean;

  init: () => void;
  register: (fields: { username: string; password: string }) => { ok: true } | { ok: false; error: string };
  login: (username: string, password: string) => { ok: true } | { ok: false; error: string };
  /** Reset password via username (local simulation — no email/phone needed) */
  forgotPassword: (username: string, newPassword: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  deleteAccount: () => void;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  /** Update profile avatar */
  updateAvatar: (dataUrl: string) => void;
  /** Update profile display name */
  updateProfile: (fields: { name?: string }) => { ok: true } | { ok: false; error: string };
}

// Avatar color palette
const AVATAR_COLORS = [
  '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#22C55E',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

function getAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function buildProfile(user: StoredUser): UserProfile {
  return {
    username: user.username,
    name: user.name,
    initial: user.name.charAt(0).toUpperCase(),
    avatarColor: getAvatarColor(user.username),
    avatarUrl: user.avatarUrl,
  };
}

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function saveSession(username: string): void {
  localStorage.setItem(SESSION_KEY, username);
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function isValidUsername(val: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(val);
}

function isValidPassword(pw: string): { ok: boolean; error?: string } {
  if (pw.length < 8) return { ok: false, error: '密码至少 8 位' };
  if (!/[A-Z]/.test(pw)) return { ok: false, error: '密码必须包含大写字母' };
  if (!/[a-z]/.test(pw)) return { ok: false, error: '密码必须包含小写字母' };
  if (!/[0-9]/.test(pw)) return { ok: false, error: '密码必须包含数字' };
  return { ok: true };
}

export const useAuthStore = create<AuthStore>((set) => ({
  currentUser: null,
  profile: null,
  isLoggedIn: false,
  showLoginModal: false,

  init: () => {
    const session = loadSession();
    if (session) {
      const users = loadUsers();
      const user = users.find((u) => u.username === session);
      if (user) {
        set({ currentUser: user.username, profile: buildProfile(user), isLoggedIn: true });
      } else {
        clearSession();
      }
    }
  },

  register: ({ username, password }) => {
    const trimmedUsername = username.trim();
    if (!isValidUsername(trimmedUsername)) {
      return { ok: false, error: '用户名需 3-20 位字母、数字或下划线' };
    }

    // Password strength check
    const pwCheck = isValidPassword(password);
    if (!pwCheck.ok) return { ok: false, error: pwCheck.error! };

    const users = loadUsers();
    if (users.some((u) => u.username === trimmedUsername)) {
      return { ok: false, error: '该用户名已被注册' };
    }

    const newUser: StoredUser = {
      username: trimmedUsername,
      name: trimmedUsername,
      password,
    };
    users.push(newUser);
    saveUsers(users);

    saveSession(newUser.username);
    set({ currentUser: newUser.username, profile: buildProfile(newUser), isLoggedIn: true, showLoginModal: false });
    return { ok: true };
  },

  login: (username, password) => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return { ok: false, error: '请输入用户名' };
    if (!password) return { ok: false, error: '请输入密码' };

    const user = loadUsers().find((u) => u.username === trimmedUsername);
    if (!user) return { ok: false, error: '用户名不存在' };
    if (user.password !== password) return { ok: false, error: '密码错误' };

    saveSession(user.username);
    set({ currentUser: user.username, profile: buildProfile(user), isLoggedIn: true, showLoginModal: false });
    return { ok: true };
  },

  forgotPassword: (username, newPassword) => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return { ok: false, error: '请输入用户名' };

    const users = loadUsers();
    const idx = users.findIndex((u) => u.username === trimmedUsername);
    if (idx === -1) return { ok: false, error: '用户名不存在' };

    const pwCheck = isValidPassword(newPassword);
    if (!pwCheck.ok) return { ok: false, error: pwCheck.error! };

    users[idx].password = newPassword;
    saveUsers(users);
    return { ok: true };
  },

  logout: () => {
    clearSession();
    set({ currentUser: null, profile: null, isLoggedIn: false });
  },

  deleteAccount: () => {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser) return;

    const users = loadUsers().filter((u) => u.username !== currentUser);
    saveUsers(users);
    clearSession();
    const prefix = 'daoshi';
    [`${prefix}:tasks:${currentUser}`, `${prefix}:state:${currentUser}`, `${prefix}:completedBlocks:${currentUser}`, `${prefix}:chatMessages:${currentUser}`]
      .forEach((k) => localStorage.removeItem(k));
    set({ currentUser: null, profile: null, isLoggedIn: false, showLoginModal: false });
  },

  openLoginModal: () => set({ showLoginModal: true }),
  closeLoginModal: () => set({ showLoginModal: false }),

  updateAvatar: (dataUrl) => {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser) return;

    const users = loadUsers();
    const idx = users.findIndex((u) => u.username === currentUser);
    if (idx === -1) return;

    users[idx].avatarUrl = dataUrl;
    saveUsers(users);
    set({ profile: buildProfile(users[idx]) });
  },

  updateProfile: ({ name }) => {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser) return { ok: false, error: '未登录' };

    const users = loadUsers();
    const idx = users.findIndex((u) => u.username === currentUser);
    if (idx === -1) return { ok: false, error: '用户不存在' };

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) return { ok: false, error: '用户名不能为空' };
      users[idx].name = trimmed;
    }

    saveUsers(users);
    set({ profile: buildProfile(users[idx]) });
    return { ok: true };
  },
}));