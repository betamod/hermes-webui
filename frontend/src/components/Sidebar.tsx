// Hermes WebUI — Sidebar Component
// Chat session list with search, grouping, and bottom controls.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Settings,
  Sun,
  Moon,
  ChevronDown,
  MessageSquare,
  Star,
  Archive,
  ArchiveRestore,
  FolderOpen,
  Cpu,
  PanelLeftClose,
} from 'lucide-react';
import { useAppStore } from '../store';
import type { Session } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from './ui/dropdown-menu';

// ── Date grouping helpers ──────────────────────────────────────────

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isYesterday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
}

function isPrevious7Days(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return d > sevenDaysAgo && d <= now && !isToday(dateStr) && !isYesterday(dateStr);
}

type DateGroup = 'pinned' | 'today' | 'yesterday' | 'week' | 'older';

interface GroupedSessions {
  label: string;
  key: DateGroup;
  sessions: Session[];
}

function groupSessions(sessions: Session[]): GroupedSessions[] {
  const pinned: Session[] = [];
  const today: Session[] = [];
  const yesterday: Session[] = [];
  const week: Session[] = [];
  const older: Session[] = [];

  for (const s of sessions) {
    if (s.archived) continue;
    if (s.pinned) {
      pinned.push(s);
      continue;
    }
    if (isToday(s.updated)) {
      today.push(s);
    } else if (isYesterday(s.updated)) {
      yesterday.push(s);
    } else if (isPrevious7Days(s.updated)) {
      week.push(s);
    } else {
      older.push(s);
    }
  }

  const groups: GroupedSessions[] = [];
  if (pinned.length) groups.push({ label: 'Pinned', key: 'pinned', sessions: pinned });
  if (today.length) groups.push({ label: 'Today', key: 'today', sessions: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', key: 'yesterday', sessions: yesterday });
  if (week.length) groups.push({ label: 'Previous 7 Days', key: 'week', sessions: week });
  if (older.length) groups.push({ label: 'Older', key: 'older', sessions: older });
  return groups;
}

// ── Session Item ───────────────────────────────────────────────────

function SessionItem({
  session,
  isActive,
  onSelect,
  onRename,
  onPin,
  onArchive,
  onDelete,
}: {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onRename: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const truncatedTitle =
    session.title.length > 32 ? session.title.slice(0, 32) + '...' : session.title;

  return (
    <DropdownMenu>
      <div
        className={`
          group relative flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer
          transition-colors duration-100
          ${
            isActive
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          }
        `}
        onClick={onSelect}
        onContextMenu={(e) => {
          e.preventDefault();
        }}
      >
        {/* Pin star for pinned sessions */}
        {session.pinned && (
          <Star className="size-3 shrink-0 text-amber-500 fill-amber-500" />
        )}

        {/* Icon */}
        <MessageSquare className="size-3.5 shrink-0 opacity-50" />

        {/* Title + model badge */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="truncate text-sm">{truncatedTitle || 'Untitled'}</span>
          {session.model && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0 font-normal opacity-60">
              {session.model.length > 16 ? session.model.slice(0, 14) + '..' : session.model}
            </Badge>
          )}
        </div>

        {/* Context menu trigger */}
        <DropdownMenuTrigger
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
          }}
        >
          <ChevronDown className="size-3.5 text-muted-foreground hover:text-foreground" />
        </DropdownMenuTrigger>

        {/* Dropdown menu */}
        <DropdownMenuContent align="end" side="right" sideOffset={4}>
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="size-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPin}>
              {session.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              {session.pinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              {session.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
              {session.archived ? 'Unarchive' : 'Archive'}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}

// ── Rename Dialog (inline) ─────────────────────────────────────────

function RenameInput({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(value);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(value)}
        className="h-6 text-xs"
      />
    </div>
  );
}

// ── Main Sidebar ───────────────────────────────────────────────────

export function Sidebar() {
  const store = useAppStore();

  const {
    sessions,
    currentSessionId,
    sessionsLoading,
    models,
    currentModel,
    workspaces,
    currentWorkspace,
    theme,
    sidebarCollapsed,
    loadSessions,
    selectSession,
    createNewSession,
    deleteSessionById,
    renameSessionById,
    pinSessionById,
    archiveSessionById,
    searchSessions,
    loadModels,
    loadWorkspaces,
    setCurrentModel,
    setCurrentWorkspace,
    setTheme,
    toggleSidebar,
  } = store;

  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data on mount
  useEffect(() => {
    loadSessions();
    loadModels();
    loadWorkspaces();
  }, [loadSessions, loadModels, loadWorkspaces]);

  // Debounced search
  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        searchSessions(value);
      }, 300);
    },
    [searchSessions],
  );

  // Group sessions by date
  const grouped = useMemo(() => groupSessions(sessions), [sessions]);

  // Filter by search query locally as well for instant feedback
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return grouped;
    const q = searchQuery.toLowerCase();
    return grouped
      .map((g) => ({
        ...g,
        sessions: g.sessions.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.model.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.sessions.length > 0);
  }, [grouped, searchQuery]);

  // Handlers
  const handleNewChat = useCallback(async () => {
    await createNewSession(currentModel || undefined, currentWorkspace || undefined);
  }, [createNewSession, currentModel, currentWorkspace]);

  const handleRename = useCallback(
    (id: string, title: string) => {
      renameSessionById(id, title);
      setRenamingId(null);
    },
    [renameSessionById],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteSessionById(id);
    },
    [deleteSessionById],
  );

  const handleToggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // ── Collapsed sidebar (icon-only rail) ───────────────────────────

  if (sidebarCollapsed) {
    return (
      <TooltipProvider delay={200}>
        <div className="flex h-full w-full flex-col items-center gap-1 border-r border-border/40 bg-sidebar py-3 px-1">
          <Tooltip>
            <TooltipTrigger>
              <Button variant="ghost" size="icon-sm" onClick={handleNewChat}>
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New Chat</TooltipContent>
          </Tooltip>

          <Separator className="my-1 w-6" />

          <ScrollArea className="flex-1 w-full">
            <div className="flex flex-col items-center gap-0.5 px-1">
              {sessions
                .filter((s) => !s.archived)
                .slice(0, 20)
                .map((s) => (
                  <Tooltip key={s.session_id}>
                    <TooltipTrigger>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className={`${
                          currentSessionId === s.session_id
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground'
                        }`}
                        onClick={() => selectSession(s.session_id)}
                      >
                        {s.pinned ? (
                          <Star className="size-3 text-amber-500 fill-amber-500" />
                        ) : (
                          <MessageSquare className="size-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {s.title || 'Untitled'}
                    </TooltipContent>
                  </Tooltip>
                ))}
            </div>
          </ScrollArea>

          <Separator className="my-1 w-6" />

          <Tooltip>
            <TooltipTrigger>
              <Button variant="ghost" size="icon-xs" onClick={toggleSidebar}>
                <PanelLeftClose className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand Sidebar</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  // ── Expanded sidebar ─────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col border-r border-border/40 bg-sidebar text-sidebar-foreground">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-base select-none" title="Mercury — Hermetic principle">
            ☿
          </span>
          <h1 className="text-sm font-semibold tracking-wide">Hermes</h1>
        </div>
        <TooltipProvider delay={300}>
          <Tooltip>
            <TooltipTrigger>
              <Button variant="ghost" size="icon-xs" onClick={toggleSidebar}>
                <PanelLeftClose className="size-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Collapse Sidebar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* ── New Chat Button ────────────────────────────────────── */}
      <div className="px-3 pt-1 pb-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleNewChat}
        >
          <Plus className="size-4" />
          New Chat
        </Button>
      </div>

      {/* ── Search ─────────────────────────────────────────────── */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => handleSearch((e.target as HTMLInputElement).value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* ── Session List ───────────────────────────────────────── */}
      <ScrollArea className="flex-1 px-2">
        {sessionsLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            Loading...
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <MessageSquare className="size-6 opacity-30" />
            {searchQuery ? 'No sessions found' : 'No sessions yet'}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 pb-2">
            {filteredGroups.map((group) => (
              <div key={group.key}>
                <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                  {group.label}
                </div>
                {group.sessions.map((session) =>
                  renamingId === session.session_id ? (
                    <RenameInput
                      key={session.session_id}
                      initialValue={session.title}
                      onSave={(val) => handleRename(session.session_id, val)}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <SessionItem
                      key={session.session_id}
                      session={session}
                      isActive={currentSessionId === session.session_id}
                      onSelect={() => selectSession(session.session_id)}
                      onRename={() => setRenamingId(session.session_id)}
                      onPin={() => pinSessionById(session.session_id, !session.pinned)}
                      onArchive={() => archiveSessionById(session.session_id, !session.archived)}
                      onDelete={() => handleDelete(session.session_id)}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* ── Bottom Controls ────────────────────────────────────── */}
      <Separator />
      <div className="flex flex-col gap-1 p-2">
        {/* Model Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors w-full">
            <Cpu className="size-3.5 shrink-0" />
            <span className="truncate flex-1 text-left">
              {currentModel || 'Select model'}
            </span>
            <ChevronDown className="size-3 shrink-0 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {models.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => setCurrentModel(m.id)}
                >
                  <span className="truncate">{m.name || m.id}</span>
                  {m.id === currentModel && (
                    <span className="ml-auto text-[10px] text-muted-foreground">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
              {models.length === 0 && (
                <DropdownMenuItem disabled>No models available</DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Workspace Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors w-full">
            <FolderOpen className="size-3.5 shrink-0" />
            <span className="truncate flex-1 text-left">
              {currentWorkspace || 'Select workspace'}
            </span>
            <ChevronDown className="size-3 shrink-0 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Workspace</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.map((w) => (
                <DropdownMenuItem
                  key={w.name}
                  onClick={() => setCurrentWorkspace(w.name)}
                >
                  <span className="truncate">{w.name}</span>
                  {w.name === currentWorkspace && (
                    <span className="ml-auto text-[10px] text-muted-foreground">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
              {workspaces.length === 0 && (
                <DropdownMenuItem disabled>No workspaces available</DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle + Settings row */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleToggleTheme}
            className="text-muted-foreground hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground"
          >
            <Settings className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
