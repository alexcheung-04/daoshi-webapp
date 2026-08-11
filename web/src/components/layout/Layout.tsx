import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStateStore } from '@/store/taskStore';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import MobileTabBar from './MobileTabBar';
import SettingsDrawer from './SettingsDrawer';
import ModePickerPopover from './ModePickerPopover';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const appearance = useAppStateStore((s) => s.appState.appearance);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const location = useLocation();
  const isChat = location.pathname === '/chat';

  // Apply dark mode based on app state
  useEffect(() => {
    if (appearance === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (appearance === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, [appearance]);

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      {/* Desktop sidebar */}
      <Sidebar onToggleSettings={() => setSettingsOpen(true)} />

      {/* Mobile top navigation */}
      <TopNav
        onToggleSettings={() => setSettingsOpen(!settingsOpen)}
        onToggleModePicker={() => setModePickerOpen(!modePickerOpen)}
      />

      {/* Main content area */}
      {isChat ? (
        // Chat: full-screen, no container constraints
        <main className="lg:pl-60 min-h-screen flex flex-col bg-[var(--surface)]">
          {children}
        </main>
      ) : (
        // Other pages: constrained container
        <main className="lg:pl-60 pt-16 lg:pt-0 pb-16 lg:pb-0 min-h-screen bg-[var(--surface)]">
          <div className="mx-auto max-w-[920px] p-4 lg:p-6">
            {children}
          </div>
        </main>
      )}

      {/* Mobile bottom tab bar */}
      <MobileTabBar />

      {/* Settings drawer */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Mode picker popover */}
      <ModePickerPopover
        open={modePickerOpen}
        onClose={() => setModePickerOpen(false)}
      />
    </div>
  );
}
