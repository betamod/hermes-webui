// Hermes WebUI — ChatArea Component
// Main chat panel: top bar, message list, and composer.

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  ArrowUp,
  X,
  Paperclip,
  Wrench,
  ChevronDown,
  ChevronRight,
  Check,
  ShieldAlert,
  Cpu,
  FolderOpen,
  Coins,
  Pencil,
  Sparkles,
  Code,
  FileText,
  Lightbulb,
  Send,
} from 'lucide-react';
import { useAppStore } from '../store';
import type { Message, ToolCall } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './ui/card';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './ui/tooltip';

// Code syntax highlighting theme
import 'highlight.js/styles/github-dark.css';

// ── Slash commands ──────────────────────────────────────────────────

const SLASH_COMMANDS = [
  { command: '/model', description: 'Switch the active model' },
  { command: '/workspace', description: 'Switch the active workspace' },
  { command: '/theme', description: 'Toggle light/dark theme' },
  { command: '/compact', description: 'Compact context history' },
  { command: '/clear', description: 'Clear current session messages' },
  { command: '/help', description: 'Show available commands' },
];

// ── Welcome suggestions ─────────────────────────────────────────────

const WELCOME_SUGGESTIONS = [
  { icon: Code, label: 'Explain a code concept', prompt: 'Explain how async/await works in JavaScript' },
  { icon: FileText, label: 'Summarize a document', prompt: 'Help me summarize the key points of a document' },
  { icon: Lightbulb, label: 'Brainstorm ideas', prompt: 'Help me brainstorm ideas for a new side project' },
  { icon: Sparkles, label: 'Write something creative', prompt: 'Write a short creative story about a robot learning to paint' },
];

// ── Top Bar ─────────────────────────────────────────────────────────

function TopBar() {
  const currentSession = useAppStore((s) => s.currentSession);
  const currentModel = useAppStore((s) => s.currentModel);
  const currentWorkspace = useAppStore((s) => s.currentWorkspace);
  const lastUsage = useAppStore((s) => s.lastUsage);
  const renameSessionById = useAppStore((s) => s.renameSessionById);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(() => {
    if (!currentSession) return;
    setEditValue(currentSession.title);
    setEditing(true);
  }, [currentSession]);

  const saveTitle = useCallback(() => {
    if (currentSession && editValue.trim() && editValue !== currentSession.title) {
      renameSessionById(currentSession.session_id, editValue.trim());
    }
    setEditing(false);
  }, [currentSession, editValue, renameSessionById]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const tokenDisplay = useMemo(() => {
    if (!lastUsage) return null;
    const { input_tokens, output_tokens, estimated_cost } = lastUsage;
    const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
    const parts = [`${fmt(input_tokens)}in`, `${fmt(output_tokens)}out`];
    if (estimated_cost != null) parts.push(`$${estimated_cost.toFixed(4)}`);
    return parts.join(' / ');
  }, [lastUsage]);

  return (
    <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2 bg-background/80 backdrop-blur-sm">
      {/* Editable title */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {editing ? (
          <input
            ref={inputRef}
            className="h-6 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button
            className="truncate text-sm font-medium hover:text-foreground/80 transition-colors text-left"
            onClick={startEditing}
            title="Click to rename"
          >
            {currentSession?.title || 'New Chat'}
          </button>
        )}
        <TooltipProvider delay={300}>
          <Tooltip>
            <TooltipTrigger>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                onClick={startEditing}
              >
                <Pencil className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Rename session</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Model badge */}
      {currentModel && (
        <Badge variant="secondary" className="shrink-0 gap-1 text-[10px] h-5">
          <Cpu className="size-3" />
          {currentModel.length > 20 ? currentModel.slice(0, 18) + '..' : currentModel}
        </Badge>
      )}

      {/* Workspace badge */}
      {currentWorkspace && (
        <Badge variant="outline" className="shrink-0 gap-1 text-[10px] h-5">
          <FolderOpen className="size-3" />
          {currentWorkspace.length > 16 ? currentWorkspace.slice(0, 14) + '..' : currentWorkspace}
        </Badge>
      )}

      {/* Token usage */}
      {tokenDisplay && (
        <Badge variant="ghost" className="shrink-0 gap-1 text-[10px] h-5 font-mono">
          <Coins className="size-3" />
          {tokenDisplay}
        </Badge>
      )}
    </div>
  );
}

// ── Tool Call Card ──────────────────────────────────────────────────

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <Card size="sm" className="my-1.5 max-w-lg">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Wrench className="size-3.5 text-muted-foreground shrink-0" />
          <CardTitle className="text-xs font-mono">{toolCall.name}</CardTitle>
          <ChevronIcon className="size-3 text-muted-foreground ml-auto shrink-0" />
        </div>
        {toolCall.snippet && (
          <CardDescription className="text-[11px] truncate mt-0.5">
            {toolCall.snippet}
          </CardDescription>
        )}
      </CardHeader>
      {expanded && toolCall.args && Object.keys(toolCall.args).length > 0 && (
        <CardContent className="pt-0">
          <pre className="rounded-md bg-muted/50 p-2 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(toolCall.args, null, 2)}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}

// ── Active Tool Call Card (during streaming) ────────────────────────

function ActiveToolCard({
  tool,
}: {
  tool: { name: string; preview: string; args: Record<string, string> };
}) {
  return (
    <Card size="sm" className="my-1.5 max-w-lg animate-pulse">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wrench className="size-3.5 text-muted-foreground shrink-0" />
          <CardTitle className="text-xs font-mono">{tool.name}</CardTitle>
          <span className="ml-auto text-[10px] text-muted-foreground">running...</span>
        </div>
        {tool.preview && (
          <CardDescription className="text-[11px] truncate mt-0.5">
            {tool.preview}
          </CardDescription>
        )}
      </CardHeader>
    </Card>
  );
}

// ── Approval Card ───────────────────────────────────────────────────

function ApprovalCard() {
  const pendingApproval = useAppStore((s) => s.pendingApproval);
  const respondApproval = useAppStore((s) => s.respondApproval);

  if (!pendingApproval) return null;

  const { toolName, description, options } = pendingApproval;

  return (
    <div className="flex justify-start py-2 px-4">
      <Card className="max-w-md w-full border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-amber-500 shrink-0" />
            <CardTitle className="text-sm">Approval Required</CardTitle>
          </div>
          <CardDescription className="mt-1">
            <span className="font-mono text-xs text-foreground/70">{toolName}</span>
            {description && (
              <span className="block mt-1 text-xs">{description}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-wrap gap-2">
          {options.length > 0 ? (
            options.map((opt) => (
              <Button
                key={opt}
                size="sm"
                variant={opt === 'yes' || opt === 'approve' ? 'default' : 'outline'}
                onClick={() => respondApproval(opt)}
              >
                <Check className="size-3" />
                {opt}
              </Button>
            ))
          ) : (
            <>
              <Button size="sm" variant="default" onClick={() => respondApproval('yes')}>
                <Check className="size-3" />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => respondApproval('no')}>
                <X className="size-3" />
                Deny
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

// ── Streaming Indicator ─────────────────────────────────────────────

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2">
      <div className="flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-foreground/60 animate-bounce [animation-delay:0ms]" />
        <span className="size-1.5 rounded-full bg-foreground/60 animate-bounce [animation-delay:150ms]" />
        <span className="size-1.5 rounded-full bg-foreground/60 animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-muted-foreground ml-1">Thinking...</span>
    </div>
  );
}

// ── Markdown Message Content ────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        a: ({ children, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        code: ({ children, className, ...props }) => {
          // Inline code (no language class)
          const isInline = !className;
          if (isInline) {
            return (
              <code
                className="rounded bg-muted px-1 py-0.5 text-xs font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }
          // Block code handled by rehype-highlight
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children, ...props }) => (
          <pre
            className="my-2 overflow-x-auto rounded-lg bg-muted/60 p-3 text-sm"
            {...props}
          >
            {children}
          </pre>
        ),
        table: ({ children, ...props }) => (
          <div className="my-2 overflow-x-auto rounded-md border border-border/50">
            <table className="min-w-full text-sm" {...props}>
              {children}
            </table>
          </div>
        ),
        th: ({ children, ...props }) => (
          <th className="border-b border-border/50 bg-muted/30 px-3 py-1.5 text-left font-medium" {...props}>
            {children}
          </th>
        ),
        td: ({ children, ...props }) => (
          <td className="border-b border-border/30 px-3 py-1.5" {...props}>
            {children}
          </td>
        ),
        blockquote: ({ children, ...props }) => (
          <blockquote className="my-2 border-l-2 border-primary/30 pl-3 text-muted-foreground italic" {...props}>
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </Markdown>
  );
}

// ── Message Bubble ──────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end px-4 py-2">
        <div className="max-w-[75%] flex flex-col items-end">
          <div className="rounded-2xl rounded-br-sm bg-primary/10 px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {message.attachments.map((att, i) => (
                <Badge key={i} variant="outline" className="text-[10px] h-4 gap-0.5">
                  <Paperclip className="size-2.5" />
                  {att.split('/').pop()}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (message.role === 'assistant') {
    return (
      <div className="flex justify-start px-4 py-2">
        <div className="max-w-[85%] min-w-0">
          {/* Tool calls */}
          {message.tool_calls && message.tool_calls.length > 0 && (
            <div className="mb-2 flex flex-col">
              {message.tool_calls.map((tc, i) => (
                <ToolCallCard key={tc.tid || i} toolCall={tc} />
              ))}
            </div>
          )}
          {/* Content */}
          {message.content && (
            <div className="prose-chat text-sm leading-relaxed">
              <MarkdownContent content={message.content} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // tool/system messages
  return (
    <div className="flex justify-start px-4 py-1">
      <div className="text-xs text-muted-foreground italic">
        {message.name && <span className="font-mono mr-1">[{message.name}]</span>}
        {message.content}
      </div>
    </div>
  );
}

// ── Empty State / Welcome ───────────────────────────────────────────

function WelcomeState({ onSuggestionClick }: { onSuggestionClick: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 py-16">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">How can I help you today?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Start a conversation or pick a suggestion below.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
        {WELCOME_SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              className="group flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/60 hover:border-border"
              onClick={() => onSuggestionClick(s.prompt)}
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div>
                <div className="text-sm font-medium">{s.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {s.prompt}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Slash Command Autocomplete ──────────────────────────────────────

function SlashCommandMenu({
  filter,
  onSelect,
  onClose,
}: {
  filter: string;
  onSelect: (command: string) => void;
  onClose: () => void;
}) {
  const filtered = useMemo(
    () =>
      SLASH_COMMANDS.filter(
        (c) =>
          c.command.startsWith(filter) ||
          c.description.toLowerCase().includes(filter.slice(1).toLowerCase()),
      ),
    [filter],
  );

  if (filtered.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-border/50 bg-popover shadow-lg overflow-hidden z-50">
      <div className="py-1">
        {filtered.map((c) => (
          <button
            key={c.command}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors"
            onClick={() => {
              onSelect(c.command);
              onClose();
            }}
          >
            <span className="font-mono text-xs font-medium text-foreground/80">{c.command}</span>
            <span className="text-xs text-muted-foreground">{c.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Composer ────────────────────────────────────────────────────────

function Composer() {
  const [text, setText] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStreaming = useAppStore((s) => s.isStreaming);
  const sendMessage = useAppStore((s) => s.sendMessage);
  const cancelCurrentStream = useAppStore((s) => s.cancelCurrentStream);
  const currentSessionId = useAppStore((s) => s.currentSessionId);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxH = 200;
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
  }, [text]);

  // Slash command detection
  useEffect(() => {
    if (text.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashFilter(text);
    } else {
      setShowSlashMenu(false);
    }
  }, [text]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || !currentSessionId) return;

    // Convert pending files to attachment paths (using file names for now)
    const attachments = pendingFiles.length > 0
      ? pendingFiles.map((f) => f.name)
      : undefined;

    sendMessage(trimmed, attachments);
    setText('');
    setPendingFiles([]);
  }, [text, isStreaming, currentSessionId, pendingFiles, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (showSlashMenu) return;
        handleSend();
      }
    },
    [handleSend, showSlashMenu],
  );

  const handleSlashSelect = useCallback((command: string) => {
    setText(command + ' ');
    setShowSlashMenu(false);
    textareaRef.current?.focus();
  }, []);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setPendingFiles((prev) => [...prev, ...Array.from(files)]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const canSend = text.trim().length > 0 && !isStreaming && !!currentSessionId;

  return (
    <div className="border-t border-border/40 bg-background px-4 pb-4 pt-3">
      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {pendingFiles.map((f, i) => (
            <Badge key={i} variant="secondary" className="gap-1 text-[10px] h-5 pr-0.5">
              <Paperclip className="size-2.5" />
              {f.name}
              <button
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
                onClick={() => removePendingFile(i)}
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Composer area */}
      <div className="relative">
        {/* Slash command autocomplete */}
        {showSlashMenu && (
          <SlashCommandMenu
            filter={slashFilter}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlashMenu(false)}
          />
        )}

        <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 transition-all">
          {/* File attachment */}
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 mb-0.5"
            onClick={handleFileSelect}
            title="Attach file"
          >
            <Paperclip className="size-4 text-muted-foreground" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={handleFileChange}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground max-h-[200px] min-h-[24px]"
            placeholder={
              currentSessionId ? 'Message Hermes...' : 'Select or create a session...'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!currentSessionId}
            rows={1}
          />

          {/* Send / Cancel */}
          <div className="shrink-0 flex items-center gap-1 mb-0.5">
            {isStreaming ? (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={cancelCurrentStream}
                title="Cancel generation"
              >
                <X className="size-4 text-destructive" />
              </Button>
            ) : (
              <Button
                variant={canSend ? 'default' : 'ghost'}
                size="icon-xs"
                onClick={handleSend}
                disabled={!canSend}
                title="Send message (Enter)"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-1 text-center text-[10px] text-muted-foreground/50">
          Enter to send, Shift+Enter for new line, / for commands
        </div>
      </div>
    </div>
  );
}

// ── Main ChatArea ───────────────────────────────────────────────────

export function ChatArea() {
  const messages = useAppStore((s) => s.messages);
  const streamingText = useAppStore((s) => s.streamingText);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const activeToolCalls = useAppStore((s) => s.activeToolCalls);
  const pendingApproval = useAppStore((s) => s.pendingApproval);
  const sendMessage = useAppStore((s) => s.sendMessage);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming text
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, activeToolCalls, pendingApproval]);

  const handleSuggestionClick = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
    },
    [sendMessage],
  );

  const hasContent = messages.length > 0 || isStreaming;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Bar */}
      <TopBar />

      {/* Message List */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {hasContent ? (
          <ScrollArea className="h-full">
            <div className="py-4" ref={scrollRef}>
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}

              {/* Active tool calls (during streaming) */}
              {isStreaming &&
                activeToolCalls.map((tc, i) => (
                  <ActiveToolCard key={i} tool={tc} />
                ))}

              {/* Streaming text preview */}
              {isStreaming && streamingText && (
                <div className="flex justify-start px-4 py-2">
                  <div className="max-w-[85%] min-w-0 prose-chat text-sm leading-relaxed">
                    <MarkdownContent content={streamingText} />
                  </div>
                </div>
              )}

              {/* Streaming indicator (shown when streaming but no text yet) */}
              {isStreaming && !streamingText && activeToolCalls.length === 0 && (
                <StreamingIndicator />
              )}

              {/* Approval card */}
              {pendingApproval && <ApprovalCard />}

              {/* Scroll anchor */}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        ) : (
          <WelcomeState onSuggestionClick={handleSuggestionClick} />
        )}
      </div>

      {/* Composer */}
      <Composer />
    </div>
  );
}
