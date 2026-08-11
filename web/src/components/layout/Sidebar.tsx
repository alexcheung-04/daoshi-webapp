import { NavLink } from 'react-router-dom';
import {
  Calendar,
  ListChecks,
  AlertTriangle,
  MessageCircleMore,
  Settings,
  LogOut,
  LogIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

const navItems = [
  { to: '/', label: '日历/列表', icon: Calendar },
  { to: '/tasks', label: '已录入任务', icon: ListChecks },
  { to: '/conflicts', label: '冲突提醒', icon: AlertTriangle },
  { to: '/chat', label: '人机对话', icon: MessageCircleMore },
];

interface SidebarProps {
  onToggleSettings?: () => void;
}

export default function Sidebar({ onToggleSettings }: SidebarProps) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const openLoginModal = useAuthStore((s) => s.openLoginModal);

  return (
    <aside className="hidden lg:flex lg:flex-col fixed left-0 top-0 h-full w-60 bg-white dark:bg-[var(--surface)] border-r border-gray-200 dark:border-gray-800 z-30">
      {/* Brand header */}
      <div
        className="flex items-center justify-center h-16 shrink-0"
        style={{ backgroundColor: 'rgb(0.01, 0.16, 0.47)' }}
      >
        <h1 className="text-xl font-bold text-white tracking-wide">
          倒时·日程
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
              )
            }
            style={({ isActive }) =>
              isActive
                ? {
                    backgroundColor: 'rgb(0.01, 0.16, 0.47)',
                    borderLeft: '3px solid rgb(0.01, 0.16, 0.47)',
                  }
                : {}
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'shrink-0',
                    isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'
                  )}
                  size={20}
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info & Settings & Auth */}
      <div className="px-3 pb-4 border-t border-gray-200 dark:border-white/10 pt-3 space-y-1">
        {/* Current user — avatar + name */}
        {profile && (
          <div className="flex items-center gap-3 px-4 py-3">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: profile.avatarColor }}
              >
                {profile.initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {profile.name}
              </div>
              <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                {profile.email}
              </div>
            </div>
          </div>
        )}

        {/* Settings */}
        <button
          onClick={onToggleSettings}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors w-full text-left"
        >
          <Settings size={20} />
          <span>设置</span>
        </button>

        {/* Auth */}
        {currentUser ? (
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full text-left"
          >
            <LogOut size={20} />
            <span>退出登录</span>
          </button>
        ) : (
          <button
            onClick={openLoginModal}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors w-full text-left"
          >
            <LogIn size={20} />
            <span>登录 / 注册</span>
          </button>
        )}
      </div>
    </aside>
  );
}
