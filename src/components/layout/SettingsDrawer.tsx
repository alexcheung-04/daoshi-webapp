import { useState, useEffect, useRef } from 'react';
import {
  X,
  Monitor,
  Sun,
  Moon,
  Bell,
  Music,
  Radio,
  BellRing,
  LogOut,
  Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStateStore } from '@/store/taskStore';
import { useAuthStore } from '@/store/authStore';
import type { AppAppearance } from '@/types';

type SectionIndex = 0 | 1 | 2;

const sections = ['使用导览', '应用场景', '智能设置'] as const;

const appearanceOptions: { value: AppAppearance; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '浅色模式', icon: Sun },
  { value: 'dark', label: '深色模式', icon: Moon },
];

const soundOptions = [
  { value: 'bell' as const, label: '经典铃声', icon: Bell },
  { value: 'chime' as const, label: '轻提示音', icon: Music },
  { value: 'electronic' as const, label: '电子提醒', icon: Radio },
  { value: 'alert' as const, label: '提醒音', icon: BellRing },
];

const llmProviders = ['DeepSeek', 'Qwen', 'GPT', '自定义'] as const;

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const appState = useAppStateStore((s) => s.appState);
  const setAppState = useAppStateStore((s) => s.setAppState);
  const currentUser = useAuthStore((s) => s.currentUser);
  const profile = useAuthStore((s) => s.profile);
  const [section, setSection] = useState<SectionIndex>(0);
  const llm = appState.llm;
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [profileError, setProfileError] = useState('');

  // LLM local edit state — synced from store on every open
  const [llmEnabled, setLlmEnabled] = useState(llm.enabled);
  const [llmProvider, setLlmProvider] = useState(llm.provider);
  const [apiKey, setApiKey] = useState(llm.apiKey);
  const [customUrl, setCustomUrl] = useState(llm.baseURL);
  const [customModel, setCustomModel] = useState(llm.model);

  // Sync local state from store whenever drawer opens
  const prevOpen = useRef(open);
  useEffect(() => {
    if (open && !prevOpen.current) {
      // Drawer just opened → reload from store
      setLlmEnabled(llm.enabled);
      setLlmProvider(llm.provider);
      setApiKey(llm.apiKey);
      setCustomUrl(llm.baseURL);
      setCustomModel(llm.model);
    }
    prevOpen.current = open;
  }, [open, llm.enabled, llm.provider, llm.apiKey, llm.baseURL, llm.model]);

  const saveLlmConfig = () => {
    setAppState({
      llm: {
        enabled: llmEnabled,
        provider: llmProvider as 'DeepSeek' | 'Qwen' | 'GPT' | '自定义',
        apiKey,
        baseURL: customUrl,
        model: customModel,
      },
    });
  };

  const handleClose = () => {
    saveLlmConfig();
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[var(--surface)]/60 transition-opacity"
          onClick={handleClose}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-[360px] max-w-[90vw] bg-white dark:bg-[var(--surface)] shadow-2xl transition-transform duration-300 ease-in-out overflow-y-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">设置</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="关闭设置"
          >
            <X size={20} />
          </button>
        </div>

        {/* Segmented picker */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {sections.map((s, i) => (
              <button
                key={s}
                onClick={() => setSection(i as SectionIndex)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded-md transition-all',
                  section === i
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Section content */}
        <div className="px-5 py-4 space-y-5">
          {section === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                倒时·日程是一款智能日程管理工具，帮助你高效规划每日任务。
                通过灵活的任务分类、智能排期和冲突检测功能，
                让你轻松应对日常生活、考试复习或紧急异常等各种场景。
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                支持多模式切换，根据不同场景自动过滤任务类型。
                配合专注计时功能，让你的学习和工作更加高效。
              </p>
              <button
                onClick={() => alert('引导功能将在后续版本中实现')}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                重看引导
              </button>
            </div>
          )}

          {section === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                根据你的当前需求选择合适的应用模式。不同模式下，
                系统会自动调整任务筛选规则和排期策略。
              </p>

              {/* Mode cards */}
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Sun size={16} className="text-blue-500" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">日常生活</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">常规日程，可添加任意类型任务</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Sun size={16} className="text-amber-500" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">复习/考试周</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">专注备考，屏蔽娱乐类任务</p>
                </div>
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Sun size={16} className="text-red-500" />
                    <span className="text-sm font-semibold text-red-700 dark:text-red-300">紧急异常</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">高效处理异常，屏蔽娱乐类任务</p>
                </div>
              </div>
            </div>
          )}

          {section === 2 && (
            <div className="space-y-6">
              {/* Appearance */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">外观</h3>
                <div className="flex gap-2">
                  {appearanceOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAppState({ appearance: opt.value })}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-all border',
                        appState.appearance === opt.value
                          ? 'bg-orange-50 border-orange-300 text-orange-600 dark:bg-orange-900/20 dark:border-orange-600 dark:text-orange-400'
                          : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750'
                      )}
                    >
                      <opt.icon size={18} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">通知</h3>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">允许通知</span>
                  <button
                    onClick={() => setAppState({ notificationsEnabled: !appState.notificationsEnabled })}
                    className={cn(
                      'w-10 h-5 rounded-full transition-colors relative',
                      appState.notificationsEnabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                        appState.notificationsEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Focus completion sound */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">专注完成提示音</h3>
                <div className="grid grid-cols-2 gap-2">
                  {soundOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAppState({ completionSound: opt.value })}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border',
                        appState.completionSound === opt.value
                          ? 'bg-orange-50 border-orange-300 text-orange-600 dark:bg-orange-900/20 dark:border-orange-600 dark:text-orange-400'
                          : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750'
                      )}
                    >
                      <opt.icon size={14} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* LLM Configuration */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">语言模型 (LLM)</h3>
                <div className="space-y-3">
                  {/* Enable toggle */}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300">启用 LLM</span>
                    <button
                      onClick={() => setLlmEnabled(!llmEnabled)}
                      className={cn(
                        'w-10 h-5 rounded-full transition-colors relative',
                        llmEnabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                          llmEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>

                  {llmEnabled && (
                    <>
                      {/* Provider picker */}
                      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                        {llmProviders.map((p) => (
                          <button
                            key={p}
                            onClick={() => setLlmProvider(p)}
                            className={cn(
                              'flex-1 py-1.5 text-xs font-medium rounded-md transition-all',
                              llmProvider === p
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400'
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>

                      {/* API Key */}
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">API Key</label>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="sk-..."
                          className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
                        />
                      </div>

                      {/* Custom URL + Model (only for 自定义) */}
                      {llmProvider === '自定义' && (
                        <>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">自定义 URL</label>
                            <input
                              type="text"
                              value={customUrl}
                              onChange={(e) => setCustomUrl(e.target.value)}
                              placeholder="https://api.example.com/v1"
                              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">模型名称</label>
                            <input
                              type="text"
                              value={customModel}
                              onChange={(e) => setCustomModel(e.target.value)}
                              placeholder="gpt-4o-mini"
                              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Auth — visible in all sections */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
            {currentUser ? (
              <div className="space-y-2">
                {/* Avatar + Name */}
                {profile && (
                  <div className="flex items-center gap-3 px-1 py-2">
                    <div className="relative group">
                      {/* Avatar image or fallback */}
                      {profile.avatarUrl ? (
                        <img
                          src={profile.avatarUrl}
                          alt={profile.name}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-bold flex-shrink-0"
                          style={{ backgroundColor: profile.avatarColor }}
                        >
                          {profile.initial}
                        </div>
                      )}

                      {/* Camera overlay */}
                      <div
                        className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors cursor-pointer"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        <Camera size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      {/* Hidden file input */}
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          // Validate size (max 200KB)
                          if (file.size > 200 * 1024) {
                            alert('图片大小不能超过 200KB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            const dataUrl = reader.result as string;
                            useAuthStore.getState().updateAvatar(dataUrl);
                          };
                          reader.readAsDataURL(file);
                          // Reset so same file can be re-selected
                          e.target.value = '';
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {profile.name}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        @{profile.username}
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit profile button */}
                {!editingProfile && (
                  <button
                    onClick={() => {
                      setEditName(profile?.name || '');
                      setProfileError('');
                      setEditingProfile(true);
                    }}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                  >
                    编辑资料
                  </button>
                )}

                {/* Edit profile form */}
                {editingProfile && (
                  <div className="space-y-2 px-1 py-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">用户名</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                    {profileError && (
                      <p className="text-xs text-red-500 dark:text-red-400">{profileError}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          setEditingProfile(false);
                          setProfileError('');
                        }}
                        className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => {
                          const result = useAuthStore.getState().updateProfile({ name: editName });
                          if (!result.ok) {
                            setProfileError((result as { ok: false; error: string }).error);
                          } else {
                            setEditingProfile(false);
                            setProfileError('');
                          }
                        }}
                        className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                        style={{ backgroundColor: 'rgb(0.01, 0.16, 0.47)' }}
                      >
                        保存
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    useAuthStore.getState().logout();
                    handleClose();
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut size={16} />
                  <span>退出登录</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  handleClose();
                  // Small delay so drawer closes smoothly before modal appears
                  setTimeout(() => useAuthStore.getState().openLoginModal(), 200);
                }}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                <LogOut size={16} style={{ transform: 'scaleX(-1)' }} />
                <span>登录 / 注册</span>
              </button>
            )}
          </div>

          {/* 版本号 */}
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">版本 26.7</p>
            <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">
              倒时 · 日程
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
