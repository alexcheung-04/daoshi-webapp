import { NavLink } from 'react-router-dom';
import {
  Calendar,
  ListChecks,
  Timer,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/taskStore';

const tabs = [
  { to: '/', label: '仪表盘', icon: Calendar },
  { to: '/tasks', label: '任务', icon: ListChecks },
  { to: '/timer', label: '计时器', icon: Timer },
  { to: '/conflicts', label: '冲突', icon: AlertTriangle, showBadge: true },
  { to: '/settings', label: '设置', icon: Settings },
];

export default function MobileTabBar() {
  const conflicts = useTaskStore((s) => s.conflicts);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 h-16 bg-white/90 dark:bg-[var(--surface)]/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-around h-full px-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center justify-center gap-0.5 w-14 py-1 rounded-lg transition-colors',
                isActive ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <tab.icon size={22} />
                  {/* Red dot for conflicts */}
                  {tab.showBadge && conflicts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white dark:border-[var(--surface)]" />
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute -top-0.5 w-6 h-0.5 rounded-full bg-orange-500" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
