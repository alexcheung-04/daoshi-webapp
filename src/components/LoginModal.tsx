import { useEffect, useState } from 'react';
import { X, User, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

type Mode = 'login' | 'register' | 'forgot';

const inputClass =
  'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40';

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const submitClass =
  'w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors';

export default function LoginModal() {
  const showLoginModal = useAuthStore((s) => s.showLoginModal);
  const closeLoginModal = useAuthStore((s) => s.closeLoginModal);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const forgotPassword = useAuthStore((s) => s.forgotPassword);

  const [mode, setMode] = useState<Mode>('login');

  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  // Forgot password fields
  const [forgotUsername, setForgotUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirm, setNewConfirm] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reset state whenever the modal opens
  useEffect(() => {
    if (showLoginModal) {
      setMode('login');
      setUsername('');
      setPassword('');
      setRegUsername('');
      setRegPassword('');
      setRegConfirm('');
      setForgotUsername('');
      setNewPassword('');
      setNewConfirm('');
      setError('');
      setSuccessMsg('');
    }
  }, [showLoginModal]);

  if (!showLoginModal) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    const result = login(username, password);
    if (!result.ok) setError((result as { ok: false; error: string }).error);
    // On success, the store auto-closes the modal
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (regPassword !== regConfirm) {
      setError('两次输入的密码不一致');
      return;
    }
    const result = register({ username: regUsername, password: regPassword });
    if (!result.ok) setError((result as { ok: false; error: string }).error);
  };

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (newPassword !== newConfirm) {
      setError('两次输入的密码不一致');
      return;
    }
    const result = forgotPassword(forgotUsername, newPassword);
    if (!result.ok) {
      setError((result as { ok: false; error: string }).error);
      return;
    }
    // Success → go back to login with username prefilled
    setUsername(forgotUsername.trim());
    setPassword('');
    setMode('login');
    setSuccessMsg('密码已重置，请用新密码登录');
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setSuccessMsg('');
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeLoginModal();
  };

  const titles: Record<Mode, string> = {
    login: '登录',
    register: '注册',
    forgot: '忘记密码',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50"
      onClick={handleOverlayClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{titles[mode]}</h2>
          <button
            onClick={closeLoginModal}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {mode === 'login' && (
            /* ========== LOGIN ========== */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={labelClass}>用户名</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="输入用户名"
                    autoComplete="username"
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>密码</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入密码"
                    autoComplete="current-password"
                    className={`${inputClass} pl-10`}
                  />
                </div>
                <div className="text-right mt-1.5">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    忘记密码？
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}
              {successMsg && <p className="text-sm text-green-600 dark:text-green-400 text-center">{successMsg}</p>}

              <button type="submit" className={submitClass} style={{ backgroundColor: 'rgb(0.01, 0.16, 0.47)' }}>
                登 录
              </button>
            </form>
          )}

          {mode === 'register' && (
            /* ========== REGISTER ========== */
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className={labelClass}>用户名</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="3-20 位字母、数字或下划线"
                    autoComplete="username"
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>密码</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="至少 8 位，需含大小写字母和数字"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>确认密码</label>
                <input
                  type="password"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  placeholder="再次输入密码"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>

              {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}

              <button type="submit" className={submitClass} style={{ backgroundColor: 'rgb(0.01, 0.16, 0.47)' }}>
                注 册
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            /* ========== FORGOT PASSWORD ========== */
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                输入你的用户名并设置一个新密码即可完成重置（本地账号无需邮箱或手机验证）。
              </p>
              <div>
                <label className={labelClass}>用户名</label>
                <input
                  type="text"
                  value={forgotUsername}
                  onChange={(e) => setForgotUsername(e.target.value)}
                  placeholder="输入用户名"
                  autoComplete="username"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>新密码</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 8 位，需含大小写字母和数字"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>确认新密码</label>
                <input
                  type="password"
                  value={newConfirm}
                  onChange={(e) => setNewConfirm(e.target.value)}
                  placeholder="再次输入新密码"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>

              {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}
              {successMsg && <p className="text-sm text-green-600 dark:text-green-400 text-center">{successMsg}</p>}

              <button type="submit" className={submitClass} style={{ backgroundColor: 'rgb(0.01, 0.16, 0.47)' }}>
                重置密码
              </button>
            </form>
          )}

          {/* Switch mode */}
          <div className="text-center">
            {mode === 'login' && (
              <button
                onClick={() => switchMode('register')}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                还没有账号？去注册
              </button>
            )}
            {mode === 'register' && (
              <button
                onClick={() => switchMode('login')}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                已有账号？去登录
              </button>
            )}
            {mode === 'forgot' && (
              <button
                onClick={() => switchMode('login')}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                返回登录
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}