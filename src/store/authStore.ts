import { create } from 'zustand';

const USERS_KEY = 'daoshi:users';
const SESSION_KEY = 'daoshi:session';
const VERIFY_CODE_KEY = 'daoshi:verifyCode';

interface StoredUser {
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatarUrl?: string;
}

interface UserProfile {
  name: string;
  email: string;
  phone?: string;
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
  register: (fields: { name: string; email: string; password: string; phone?: string }) => { ok: true } | { ok: false; error: string };
  login: (identifier: string, password: string) => { ok: true } | { ok: false; error: string };
  /** Send verification code to phone (simulated) — returns the code for demo */
  sendVerificationCode: (phone: string) => { ok: true; code: string } | { ok: false; error: string };
  /** Login or auto-register via phone + verification code */
  phoneCodeLogin: (phone: string, code: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  deleteAccount: () => void;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  socialLogin: (provider: 'wechat' | 'google' | 'apple') => { ok: true; provider: string } | { ok: false; error: string };
  /** Update profile avatar */
  updateAvatar: (dataUrl: string) => void;
  /** Update profile name / phone */
  updateProfile: (fields: { name?: string; phone?: string }) => { ok: true } | { ok: false; error: string };
}

// Avatar color palette
const AVATAR_COLORS = [
  '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#22C55E',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function buildProfile(user: StoredUser): UserProfile {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone,
    initial: user.name.charAt(0).toUpperCase(),
    avatarColor: getAvatarColor(user.email),
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

function saveSession(email: string): void {
  localStorage.setItem(SESSION_KEY, email);
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function findUser(identifier: string): StoredUser | undefined {
  const users = loadUsers();
  return users.find((u) => u.email === identifier) || users.find((u) => u.phone === identifier);
}

function isValidEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function isValidPhone(val: string): boolean {
  return /^\+?[\d\s\-()]{7,20}$/.test(val);
}

function isValidPassword(pw: string): { ok: boolean; error?: string } {
  if (pw.length < 8) return { ok: false, error: '密码至少 8 位' };
  if (!/[A-Z]/.test(pw)) return { ok: false, error: '密码必须包含大写字母' };
  if (!/[a-z]/.test(pw)) return { ok: false, error: '密码必须包含小写字母' };
  if (!/[0-9]/.test(pw)) return { ok: false, error: '密码必须包含数字' };
  return { ok: true };
}

function generateVerifyCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
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
      const user = users.find((u) => u.email === session);
      if (user) {
        set({ currentUser: user.email, profile: buildProfile(user), isLoggedIn: true });
      } else {
        clearSession();
      }
    }
  },

  register: ({ name, email, password, phone }) => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) return { ok: false, error: '请输入姓名' };
    if (!trimmedEmail) return { ok: false, error: '请输入邮箱或手机号' };

    // Password strength check
    const pwCheck = isValidPassword(password);
    if (!pwCheck.ok) return { ok: false, error: pwCheck.error! };

    const isEmail = isValidEmail(trimmedEmail);
    const isPhone = isValidPhone(trimmedEmail);
    if (!isEmail && !isPhone) return { ok: false, error: '请输入有效的邮箱或手机号' };

    const users = loadUsers();
    if (users.some((u) => u.email === trimmedEmail)) {
      return { ok: false, error: '该邮箱/手机号已被注册' };
    }
    if (phone && users.some((u) => u.phone === phone)) {
      return { ok: false, error: '该手机号已被注册' };
    }

    const newUser: StoredUser = {
      name: trimmedName,
      email: trimmedEmail,
      password,
      phone: phone || (isPhone ? trimmedEmail : undefined),
    };
    users.push(newUser);
    saveUsers(users);

    saveSession(newUser.email);
    set({ currentUser: newUser.email, profile: buildProfile(newUser), isLoggedIn: true, showLoginModal: false });
    return { ok: true };
  },

  login: (identifier, password) => {
    if (!identifier) return { ok: false, error: '请输入邮箱或手机号' };
    if (!password) return { ok: false, error: '请输入密码' };

    const user = findUser(identifier);
    if (!user) return { ok: false, error: '账号不存在' };
    if (user.password !== password) return { ok: false, error: '密码错误' };

    saveSession(user.email);
    set({ currentUser: user.email, profile: buildProfile(user), isLoggedIn: true, showLoginModal: false });
    return { ok: true };
  },

  sendVerificationCode: (phone) => {
    if (!isValidPhone(phone)) return { ok: false, error: '请输入有效的手机号' };
    const code = generateVerifyCode();
    localStorage.setItem(VERIFY_CODE_KEY, JSON.stringify({ phone, code, expires: Date.now() + 300000 }));
    return { ok: true, code };
  },

  phoneCodeLogin: (phone, code) => {
    try {
      const stored = JSON.parse(localStorage.getItem(VERIFY_CODE_KEY) || '{}');
      if (stored.phone !== phone) return { ok: false, error: '请先获取验证码' };
      if (Date.now() > stored.expires) return { ok: false, error: '验证码已过期' };
      if (stored.code !== code) return { ok: false, error: '验证码错误' };

      localStorage.removeItem(VERIFY_CODE_KEY);

      // Find existing user or auto-register
      let users = loadUsers();
      let user = users.find((u) => u.phone === phone);
      if (!user) {
        user = {
          name: phone,
          email: phone,
          password: '',
          phone,
        };
        users.push(user);
        saveUsers(users);
      }

      saveSession(user.email);
      set({ currentUser: user.email, profile: buildProfile(user), isLoggedIn: true, showLoginModal: false });
      return { ok: true };
    } catch {
      return { ok: false, error: '验证失败，请重试' };
    }
  },

  logout: () => {
    clearSession();
    set({ currentUser: null, profile: null, isLoggedIn: false });
  },

  deleteAccount: () => {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser) return;

    const users = loadUsers().filter((u) => u.email !== currentUser);
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
    const idx = users.findIndex((u) => u.email === currentUser);
    if (idx === -1) return;

    users[idx].avatarUrl = dataUrl;
    saveUsers(users);
    set({ profile: buildProfile(users[idx]) });
  },

  updateProfile: ({ name, phone }) => {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser) return { ok: false, error: '未登录' };

    const users = loadUsers();
    const idx = users.findIndex((u) => u.email === currentUser);
    if (idx === -1) return { ok: false, error: '用户不存在' };

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) return { ok: false, error: '用户名不能为空' };
      users[idx].name = trimmed;
    }
    if (phone !== undefined) {
      users[idx].phone = phone.trim() || undefined;
    }

    saveUsers(users);
    set({ profile: buildProfile(users[idx]) });
    return { ok: true };
  },

  socialLogin: (provider) => {
    // Simulated social login — creates a local account with provider prefix
    const suffix = Math.random().toString(36).substring(2, 8);
    const displayName = provider === 'wechat' ? '微信用户' : provider === 'google' ? 'Google用户' : 'Apple用户';
    const email = `${provider}_${suffix}@social.local`;
    const name = `${displayName}_${suffix}`;

    const users = loadUsers();
    // Avoid duplicates
    let user = users.find((u) => u.email === email);
    if (!user) {
      user = { name, email, password: '' };
      users.push(user);
      saveUsers(users);
    }

    saveSession(user.email);
    set({ currentUser: user.email, profile: buildProfile(user), isLoggedIn: true, showLoginModal: false });
    return { ok: true, provider };
  },
}));
