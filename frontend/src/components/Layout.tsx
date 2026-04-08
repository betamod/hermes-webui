import { Toaster } from './ui/sonner';
import { useAppStore } from '../store';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { RightPanel } from './RightPanel';

export function Layout() {
  const theme = useAppStore((s) => s.theme);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex">
      {/* Sidebar — 20% of viewport, min 200px, max 320px */}
      <div
        className="flex-shrink-0 border-r border-border/50 overflow-hidden"
        style={{ width: 'clamp(200px, 20vw, 320px)' }}
      >
        <Sidebar />
      </div>

      {/* Chat — fills remaining space */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <ChatArea />
      </div>

      {/* Right panel — 22% of viewport, min 180px, max 360px */}
      <div
        className="flex-shrink-0 border-l border-border/50 overflow-hidden"
        style={{ width: 'clamp(180px, 22vw, 360px)' }}
      >
        <RightPanel />
      </div>

      <Toaster theme={theme as 'light' | 'dark' | 'system'} richColors closeButton />
    </div>
  );
}
