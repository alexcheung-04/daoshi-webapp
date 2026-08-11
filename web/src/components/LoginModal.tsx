import { useState } from 'react';
import { X, Smartphone, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

type LoginTab = 'password' | 'phone';
type Mode = 'login' | 'register';

/* ---- Official brand SVG icons ---- */

function WeChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045.247.247 0 0 0 .242-.245c0-.06-.024-.12-.04-.178l-.325-1.233a.492.492 0 0 1 .178-.553C23.028 18.333 24 16.592 24 14.628c0-3.299-3.063-5.77-7.062-5.77zm-2.18 2.452c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z"/>
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

export default function LoginModal() {
  const showLoginModal = useAuthStore((s) => s.showLoginModal);
  const closeLoginModal = useAuthStore((s) => s.closeLoginModal);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const sendVerificationCode = useAuthStore((s) => s.sendVerificationCode);
  const phoneCodeLogin = useAuthStore((s) => s.phoneCodeLogin);
  const socialLogin = useAuthStore((s) => s.socialLogin);

  const [loginTab, setLoginTab] = useState<LoginTab>('password');
  const [mode, setMode] = useState<Mode>('login');

  // Password login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Phone code fields
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [codeCountdown, setCodeCountdown] = useState(0);

  const [error, setError] = useState('');
  const [socialMsg, setSocialMsg] = useState('');

  if (!showLoginModal) return null;

  /* ---- Password login ---- */
  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = login(identifier, password);
    if (!result.ok) setError((result as { ok: false; error: string }).error);
  };

  /* ---- Register ---- */
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = register({
      name: regName,
      email: regEmail || regPhone,
      password: regPassword,
      phone: regPhone || undefined,
    });
    if (!result.ok) setError((result as { ok: false; error: string }).error);
  };

  /* ---- Phone code ---- */
  const handleSendCode = () => {
    if (!phoneNumber.trim()) {
      setError('请输入手机号');
      return;
    }
    const result = sendVerificationCode(phoneNumber.trim());
    if (!result.ok) {
      setError((result as { ok: false; error: string }).error);
      return;
    }
    setSentCode((result as { ok: true; code: string }).code);
    setError('');
    setCodeCountdown(60);
    const timer = setInterval(() => {
      setCodeCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePhoneLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = phoneCodeLogin(phoneNumber.trim(), verifyCode.trim());
    if (!result.ok) setError((result as { ok: false; error: string }).error);
  };

  /* ---- Social ---- */
  const handleSocialClick = (provider: 'wechat' | 'google' | 'apple') => {
    const result = socialLogin(provider);
    if (!result.ok) {
      setSocialMsg((result as { ok: false; error: string }).error);
      setTimeout(() => setSocialMsg(''), 3000);
    }
    // On success, the Zustand state change auto-closes the modal
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeLoginModal();
  };

  /* ---- Reset state on modal open ---- */
  const resetState = () => {
    setLoginTab('password');
    setMode('login');
    setIdentifier('');
    setPassword('');
    setRegName('');
    setRegEmail('');
    setRegPhone('');
    setRegPassword('');
    setPhoneNumber('');
    setVerifyCode('');
    setSentCode('');
    setCodeCountdown(0);
    setError('');
    setSocialMsg('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50"
      onClick={handleOverlayClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
            {mode === 'login' ? '登录' : '注册'}
          </h2>
          <button
            onClick={closeLoginModal}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {mode === 'login' ? (
            /* ========== LOGIN ========== */
            <>
              {/* Login tab switcher */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                <button
                  onClick={() => { setLoginTab('password'); setError(''); }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all',
                    loginTab === 'password'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  <Mail size={14} />
                  密码登录
                </button>
                <button
                  onClick={() => { setLoginTab('phone'); setError(''); }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all',
                    loginTab === 'phone'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  <Smartphone size={14} />
                  验证码登录
                </button>
              </div>

              {loginTab === 'password' ? (
                /* -- Password login form -- */
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      邮箱 / 手机号
                    </label>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="输入邮箱或手机号"
                      autoComplete="username"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      密码
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="输入密码"
                      autoComplete="current-password"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: 'rgb(0.01, 0.16, 0.47)' }}
                  >
                    登 录
                  </button>
                </form>
              ) : (
                /* -- Phone code login form -- */
                <form onSubmit={handlePhoneLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      手机号
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+86 13800138000"
                      autoComplete="tel"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      验证码
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value)}
                        placeholder="输入 6 位验证码"
                        inputMode="numeric"
                        maxLength={6}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                      <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={codeCountdown > 0}
                        className={cn(
                          'px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                          codeCountdown > 0
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                        )}
                      >
                        {codeCountdown > 0 ? `${codeCountdown}s` : '获取验证码'}
                      </button>
                    </div>
                  </div>

                  {/* Show the simulated code */}
                  {sentCode && (
                    <p className="text-xs text-amber-500 dark:text-amber-400 text-center">
                      🔐 模拟验证码：<span className="font-mono font-bold">{sentCode}</span>
                    </p>
                  )}

                  {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: 'rgb(0.01, 0.16, 0.47)' }}
                  >
                    登 录
                  </button>
                </form>
              )}
            </>
          ) : (
            /* ========== REGISTER ========== */
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  姓名
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="你的名字"
                  autoComplete="name"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  邮箱
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  手机号 <span className="text-gray-400 font-normal">（选填）</span>
                </label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="+86 13800138000"
                  autoComplete="tel"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  密码
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="至少 8 位，需含大小写字母和数字"
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: 'rgb(0.01, 0.16, 0.47)' }}
              >
                注 册
              </button>
            </form>
          )}

          {/* ===== Social Login ===== */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-gray-800 px-2 text-gray-400 dark:text-gray-500">
                其他登录方式
              </span>
            </div>
          </div>

          <div className="flex justify-center gap-5">
            {/* WeChat */}
            <button
              onClick={() => handleSocialClick('wechat')}
              className="flex flex-col items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-900/50 transition-colors">
                <WeChatIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-[10px]">微信</span>
            </button>

            {/* Google */}
            <button
              onClick={() => handleSocialClick('google')}
              className="flex flex-col items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                <GoogleIcon className="w-5 h-5" />
              </div>
              <span className="text-[10px]">Google</span>
            </button>

            {/* Apple */}
            <button
              onClick={() => handleSocialClick('apple')}
              className="flex flex-col items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                <AppleIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </div>
              <span className="text-[10px]">Apple</span>
            </button>
          </div>

          {socialMsg && (
            <p className="text-xs text-amber-500 dark:text-amber-400 text-center">{socialMsg}</p>
          )}

          {/* Switch mode */}
          <div className="text-center">
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSocialMsg(''); }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
