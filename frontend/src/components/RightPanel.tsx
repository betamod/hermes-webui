import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  FolderOpen, File, FileCode, FileText, Image, ChevronRight, ChevronDown,
  Plus, Trash2, Clock, BookOpen, Brain, Search, Play, Pause, RotateCcw,
  FolderPlus, FilePlus, RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/store';
import * as api from '@/api';
import type { FileEntry, CronJob, Skill, Memory as MemoryType } from '@/types';

// ── File icon helper ──────────────────────────────────────────────────────
function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png','jpg','jpeg','gif','svg','webp','ico'].includes(ext)) return <Image className="h-4 w-4 text-blue-400" />;
  if (['ts','tsx','js','jsx','py','rs','go','rb','java','c','cpp','h','swift','kt'].includes(ext)) return <FileCode className="h-4 w-4 text-green-400" />;
  if (['md','txt','rst','adoc'].includes(ext)) return <FileText className="h-4 w-4 text-amber-400" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

// ── Files Tab ─────────────────────────────────────────────────────────────
function FilesTab() {
  const currentWorkspace = useAppStore((s) => s.currentWorkspace);
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const [dir, setDir] = useState('.');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const result = await api.fetchFiles(d, currentSessionId || undefined);
      // Sort: dirs first, then files, alphabetical within
      result.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(result);
      setDir(d);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load('.'); }, [load]);

  const navigate = (path: string) => {
    setPreview(null);
    load(path);
  };

  const openFile = async (entry: FileEntry) => {
    if (entry.type === 'dir') return navigate(entry.path);
    try {
      const res = await api.readFile(entry.path, currentSessionId || undefined);
      setPreview({ path: entry.path, content: res.content });
    } catch { /* ignore */ }
  };

  const handleDelete = async (path: string) => {
    try { await api.deleteFile(path); load(dir); setPreview(null); }
    catch { /* ignore */ }
  };

  const breadcrumbs = dir === '.' ? [] : dir.split('/').filter(Boolean);
  const ext = preview?.path.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png','jpg','jpeg','gif','svg','webp','ico'].includes(ext);

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground border-b border-border/50 flex-shrink-0">
        <button onClick={() => navigate('.')} className="hover:text-foreground transition-colors font-medium">root</button>
        {breadcrumbs.map((seg, i) => {
          const path = breadcrumbs.slice(0, i + 1).join('/');
          return (
            <span key={path} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <button onClick={() => navigate(path)} className="hover:text-foreground transition-colors">{seg}</button>
            </span>
          );
        })}
      </div>

      {preview ? (
        /* File preview */
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 flex-shrink-0">
            <span className="text-xs font-medium text-foreground truncate">{preview.path}</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setPreview(null)}>Close</Button>
          </div>
          <ScrollArea className="flex-1">
            {isImage ? (
              <div className="p-4 flex justify-center">
                <img src={`/api/file/raw?path=${encodeURIComponent(preview.path)}`} alt={preview.path} className="max-w-full rounded" />
              </div>
            ) : (
              <pre className="p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                {preview.content}
              </pre>
            )}
          </ScrollArea>
        </div>
      ) : (
        /* File list */
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading...
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">Empty directory</div>
          ) : (
            <div className="py-1">
              {dir !== '.' && (
                <button
                  onClick={() => navigate(dir.split('/').slice(0, -1).join('/') || '.')}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                >
                  <FolderOpen className="h-4 w-4" /> ..
                </button>
              )}
              {entries.map((entry) => (
                <div
                  key={entry.path}
                  className="flex items-center group px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => openFile(entry)}
                >
                  {entry.type === 'dir' ? (
                    <FolderOpen className="h-4 w-4 text-blue-400 mr-2 flex-shrink-0" />
                  ) : (
                    <span className="mr-2 flex-shrink-0">{fileIcon(entry.name)}</span>
                  )}
                  <span className="flex-1 truncate text-foreground">{entry.name}</span>
                  {entry.size != null && (
                    <span className="text-[10px] text-muted-foreground mr-2">
                      {entry.size < 1024 ? `${entry.size}B` : `${(entry.size / 1024).toFixed(1)}K`}
                    </span>
                  )}
                  <Button
                    variant="ghost" size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); handleDelete(entry.path); }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      )}

      {/* Bottom action bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-t border-border/50 flex-shrink-0">
        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => load(dir)}>
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>
    </div>
  );
}

// ── Skills Tab ────────────────────────────────────────────────────────────
function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ name: string; content: string } | null>(null);

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const result = await api.fetchSkills();
      setSkills(result);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const viewSkill = async (name: string) => {
    try {
      const res = await api.fetchSkillContent(name);
      setSelected({ name, content: res.content });
    } catch { /* ignore */ }
  };

  const filtered = skills.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const grouped: Record<string, Skill[]> = {};
  for (const s of filtered) {
    const cat = s.category || 'uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border/50 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs pl-7"
          />
        </div>
      </div>

      {selected ? (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 flex-shrink-0">
            <span className="text-xs font-medium text-foreground">{selected.name}</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelected(null)}>Close</Button>
          </div>
          <ScrollArea className="flex-1">
            <pre className="p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {selected.content}
            </pre>
          </ScrollArea>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading...
            </div>
          ) : (
            <div className="py-1">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{cat}</div>
                  {items.map((skill) => (
                    <button
                      key={skill.name}
                      className="flex flex-col w-full px-3 py-1.5 text-left hover:bg-accent/50 transition-colors"
                      onClick={() => viewSkill(skill.name)}
                    >
                      <span className="text-xs font-medium text-foreground">{skill.name}</span>
                      <span className="text-[10px] text-muted-foreground line-clamp-1">{skill.description}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}

// ── Cron Tab ──────────────────────────────────────────────────────────────
function CronTab() {
  const [crons, setCrons] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCrons(await api.fetchCrons()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/15 text-green-400 border-green-500/30';
      case 'paused': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'completed': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground">{crons.length} jobs</span>
        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={load}>
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading...
          </div>
        ) : crons.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">No cron jobs</div>
        ) : (
          <div className="py-1 px-2 space-y-1.5">
            {crons.map((job) => (
              <Card key={job.id} className="p-0 border-border/50 bg-card/50">
                <button
                  className="flex items-center gap-2 w-full p-2 text-left"
                  onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                >
                  {expanded === job.id ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-xs font-medium text-foreground flex-1 truncate">{job.name}</span>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${statusColor(job.status)}`}>
                    {job.status}
                  </Badge>
                </button>
                {expanded === job.id && (
                  <div className="px-2 pb-2 space-y-2">
                    <div className="text-[10px] text-muted-foreground">
                      <span className="font-medium">Schedule:</span> {job.schedule}
                    </div>
                    <div className="text-[10px] text-muted-foreground line-clamp-3">
                      <span className="font-medium">Prompt:</span> {job.prompt}
                    </div>
                    {job.last_run && (
                      <div className="text-[10px] text-muted-foreground">
                        <span className="font-medium">Last run:</span> {new Date(job.last_run).toLocaleString()}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 pt-1">
                      <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => api.runCron(job.id).then(load)}>
                        <Play className="h-3 w-3 mr-1" /> Run
                      </Button>
                      {job.status === 'active' ? (
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => api.pauseCron(job.id).then(load)}>
                          <Pause className="h-3 w-3 mr-1" /> Pause
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => api.resumeCron(job.id).then(load)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Resume
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => api.deleteCron(job.id).then(load)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Memory Tab ────────────────────────────────────────────────────────────
function MemoryTab() {
  const [memories, setMemories] = useState<MemoryType[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.fetchMemory();
      // Backend returns { memory: "raw text..." } -- split into lines for display
      const rawText = res.memory || '';
      const entries: MemoryType[] = rawText
        .split('\n§\n')
        .filter(Boolean)
        .map((content, i) => ({ content: content.trim(), id: `mem-${i}`, target: 'memory' }));
      setMemories(entries);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground">{memories.length} entries</span>
        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={load}>
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading...
          </div>
        ) : memories.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">No memory entries</div>
        ) : (
          <div className="py-1">
            {memories.map((mem, i) => (
              <div key={mem.id || i} className="px-3 py-2 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  {mem.target && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      {mem.target}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-4">{mem.content}</p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Main RightPanel ───────────────────────────────────────────────────────
export function RightPanel() {
  const tab = useAppStore((s) => s.rightPanelTab);
  const setTab = useAppStore((s) => s.setRightPanelTab);

  return (
    <div className="h-full flex flex-col bg-card/30">
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col h-full">
        <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-1 h-9 flex-shrink-0">
          <TabsTrigger value="files" className="text-xs data-[state=active]:bg-accent/50">
            <FolderOpen className="h-3.5 w-3.5 mr-1" /> Files
          </TabsTrigger>
          <TabsTrigger value="skills" className="text-xs data-[state=active]:bg-accent/50">
            <BookOpen className="h-3.5 w-3.5 mr-1" /> Skills
          </TabsTrigger>
          <TabsTrigger value="cron" className="text-xs data-[state=active]:bg-accent/50">
            <Clock className="h-3.5 w-3.5 mr-1" /> Cron
          </TabsTrigger>
          <TabsTrigger value="memory" className="text-xs data-[state=active]:bg-accent/50">
            <Brain className="h-3.5 w-3.5 mr-1" /> Memory
          </TabsTrigger>
        </TabsList>
        <TabsContent value="files" className="flex-1 m-0 min-h-0"><FilesTab /></TabsContent>
        <TabsContent value="skills" className="flex-1 m-0 min-h-0"><SkillsTab /></TabsContent>
        <TabsContent value="cron" className="flex-1 m-0 min-h-0"><CronTab /></TabsContent>
        <TabsContent value="memory" className="flex-1 m-0 min-h-0"><MemoryTab /></TabsContent>
      </Tabs>
    </div>
  );
}
