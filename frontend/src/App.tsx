import { useEffect } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Layout } from '@/components/Layout';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAppStore } from '@/store';

function App() {
  const loadSessions = useAppStore((s) => s.loadSessions);
  const loadModels = useAppStore((s) => s.loadModels);
  const loadWorkspaces = useAppStore((s) => s.loadWorkspaces);
  const loadProfiles = useAppStore((s) => s.loadProfiles);

  useEffect(() => {
    loadSessions().catch(() => {});
    loadModels().catch(() => {});
    loadWorkspaces().catch(() => {});
    loadProfiles().catch(() => {});
  }, [loadSessions, loadModels, loadWorkspaces, loadProfiles]);

  return (
    <ThemeProvider>
      <TooltipProvider delay={300}>
        <Layout />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
