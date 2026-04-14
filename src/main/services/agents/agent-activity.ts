import { mkdtemp, readdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import {
  createTerminalSessionActivityPayload,
  TERMINAL_SESSION_ACTIVITY_OSC,
  type TerminalSessionActivity,
} from '@shared/domain/terminal';

import { quotePosixShell } from '@main/services/ssh/ssh-command-runner';

interface CommandHookDefinition {
  type: 'command';
  command: string;
  timeout: number;
}

interface HookMatcherDefinition {
  matcher?: string;
  hooks: CommandHookDefinition[];
}

interface HookConfigDefinition {
  hooks: Record<string, HookMatcherDefinition[]>;
}

interface LocalCodexHookRuntime {
  cleanupPaths: string[];
  codexHomePath: string;
}

const HOOK_COMMAND_TIMEOUT_SECONDS = 5;
const CODEX_HOME_PERSISTED_ENTRY_NAMES = [
  'auth.json',
  'config.toml',
  'history.jsonl',
  'state_5.sqlite',
  'state_5.sqlite-shm',
  'state_5.sqlite-wal',
] as const;

function createCommandHook(activity: TerminalSessionActivity): CommandHookDefinition {
  return {
    type: 'command',
    command: buildPosixTerminalSignalCommand(activity),
    timeout: HOOK_COMMAND_TIMEOUT_SECONDS,
  };
}

function buildPosixTerminalSignalCommand(activity: TerminalSessionActivity): string {
  const payload = createTerminalSessionActivityPayload(activity);

  return [
    '[ -w /dev/tty ]',
    '&&',
    `printf '\\033]${TERMINAL_SESSION_ACTIVITY_OSC};%s\\007' ${quotePosixShell(payload)} > /dev/tty 2>/dev/null`,
    '|| true',
  ].join(' ');
}

function buildClaudeHooksConfig(): HookConfigDefinition {
  return {
    hooks: {
      SessionStart: [
        {
          matcher: 'startup|resume',
          hooks: [createCommandHook('waiting_input')],
        },
      ],
      UserPromptSubmit: [
        {
          hooks: [createCommandHook('working')],
        },
      ],
      Stop: [
        {
          hooks: [createCommandHook('waiting_input')],
        },
      ],
      StopFailure: [
        {
          hooks: [createCommandHook('waiting_input')],
        },
      ],
    },
  };
}

function buildCodexHooksConfig(): HookConfigDefinition {
  return {
    hooks: {
      SessionStart: [
        {
          matcher: 'startup|resume',
          hooks: [createCommandHook('waiting_input')],
        },
      ],
      UserPromptSubmit: [
        {
          hooks: [createCommandHook('working')],
        },
      ],
      Stop: [
        {
          hooks: [createCommandHook('waiting_input')],
        },
      ],
    },
  };
}

function mergeHookConfigs(
  baseConfig: HookConfigDefinition | null,
  nextConfig: HookConfigDefinition,
): HookConfigDefinition {
  const mergedHooks = normalizeHookMap(baseConfig);

  for (const [eventName, nextEntries] of Object.entries(nextConfig.hooks)) {
    const existingEntries = mergedHooks[eventName];

    mergedHooks[eventName] = existingEntries ? [...existingEntries, ...nextEntries] : nextEntries;
  }

  return {
    hooks: mergedHooks,
  };
}

function normalizeHookMap(
  config: HookConfigDefinition | null,
): Record<string, HookMatcherDefinition[]> {
  const hooks = config?.hooks;

  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) {
    return {};
  }

  const normalizedHooks: Record<string, HookMatcherDefinition[]> = {};

  for (const [eventName, entries] of Object.entries(hooks)) {
    if (Array.isArray(entries)) {
      normalizedHooks[eventName] = entries as HookMatcherDefinition[];
    }
  }

  return normalizedHooks;
}

async function readLocalCodexHooksConfig(
  codexHomePath: string,
): Promise<HookConfigDefinition | null> {
  const hooksConfigPath = path.join(codexHomePath, 'hooks.json');

  try {
    const rawContent = await readFile(hooksConfigPath, 'utf8');
    return JSON.parse(rawContent) as HookConfigDefinition;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT') {
      return null;
    }

    console.warn('[agent-activity] ignoring invalid Codex hooks.json while creating session', {
      codexHomePath,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

function resolveLocalCodexHomePath(): string {
  const codexHomeFromEnv = process.env.CODEX_HOME?.trim();

  if (codexHomeFromEnv) {
    return codexHomeFromEnv;
  }

  return path.join(homedir(), '.codex');
}

export function buildClaudeCodeSettingsOverride(): string {
  return JSON.stringify(buildClaudeHooksConfig());
}

export async function createLocalCodexHookRuntime(): Promise<LocalCodexHookRuntime> {
  const overlayCodexHomePath = await mkdtemp(path.join(tmpdir(), 'vibo-codex-'));
  const localCodexHomePath = resolveLocalCodexHomePath();
  const linkedEntryNames = new Set<string>();

  try {
    const existingEntries = await readdir(localCodexHomePath, {
      withFileTypes: true,
    });

    for (const entry of existingEntries) {
      if (entry.name === 'hooks.json') {
        continue;
      }

      await symlink(
        path.join(localCodexHomePath, entry.name),
        path.join(overlayCodexHomePath, entry.name),
      );
      linkedEntryNames.add(entry.name);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  for (const entryName of CODEX_HOME_PERSISTED_ENTRY_NAMES) {
    if (linkedEntryNames.has(entryName)) {
      continue;
    }

    await symlink(
      path.join(localCodexHomePath, entryName),
      path.join(overlayCodexHomePath, entryName),
    );
  }

  const mergedHooksConfig = mergeHookConfigs(
    await readLocalCodexHooksConfig(localCodexHomePath),
    buildCodexHooksConfig(),
  );

  await writeFile(
    path.join(overlayCodexHomePath, 'hooks.json'),
    JSON.stringify(mergedHooksConfig, null, 2),
    'utf8',
  );

  return {
    cleanupPaths: [overlayCodexHomePath],
    codexHomePath: overlayCodexHomePath,
  };
}

function buildRemoteCodexHookMergeScript(hooksJson: string): string {
  return [
    'import json',
    'import sys',
    '',
    'base_path, out_path = sys.argv[1], sys.argv[2]',
    `overlay = json.loads(${JSON.stringify(hooksJson)})`,
    '',
    'try:',
    '    with open(base_path, "r", encoding="utf-8") as handle:',
    '        base = json.load(handle)',
    'except Exception:',
    '    base = {}',
    '',
    'hooks = base.get("hooks") if isinstance(base, dict) else {}',
    'if not isinstance(hooks, dict):',
    '    hooks = {}',
    '',
    'merged = {"hooks": dict(hooks)}',
    'for event_name, entries in overlay.get("hooks", {}).items():',
    '    existing = merged["hooks"].get(event_name)',
    '    if isinstance(existing, list):',
    '        merged["hooks"][event_name] = [*existing, *entries]',
    '    else:',
    '        merged["hooks"][event_name] = entries',
    '',
    'with open(out_path, "w", encoding="utf-8") as handle:',
    '    json.dump(merged, handle, indent=2)',
  ].join('\n');
}

export function buildRemoteCodexHookSetupCommand(): string {
  const hooksJson = JSON.stringify(buildCodexHooksConfig(), null, 2);
  const mergeScript = buildRemoteCodexHookMergeScript(hooksJson);

  return [
    'VIBO_CODEX_HOME_SOURCE="${CODEX_HOME:-$HOME/.codex}"',
    'VIBO_CODEX_HOME="$(mktemp -d "${TMPDIR:-/tmp}/vibo-codex.XXXXXX")"',
    'trap \'rm -rf "$VIBO_CODEX_HOME"\' EXIT HUP INT TERM',
    'if [ -d "$VIBO_CODEX_HOME_SOURCE" ]; then',
    '  find "$VIBO_CODEX_HOME_SOURCE" -mindepth 1 -maxdepth 1 ! -name hooks.json -exec ln -s {} "$VIBO_CODEX_HOME"/ \\;',
    'fi',
    'for entry in auth.json config.toml history.jsonl state_5.sqlite state_5.sqlite-shm state_5.sqlite-wal; do',
    '  if [ ! -e "$VIBO_CODEX_HOME/$entry" ]; then',
    '    ln -s "$VIBO_CODEX_HOME_SOURCE/$entry" "$VIBO_CODEX_HOME/$entry"',
    '  fi',
    'done',
    'if [ -f "$VIBO_CODEX_HOME_SOURCE/hooks.json" ] && command -v python3 >/dev/null 2>&1; then',
    `  python3 - "$VIBO_CODEX_HOME_SOURCE/hooks.json" "$VIBO_CODEX_HOME/hooks.json" <<'PY'\n${mergeScript}\nPY`,
    'else',
    `  cat > "$VIBO_CODEX_HOME/hooks.json" <<'JSON'\n${hooksJson}\nJSON`,
    'fi',
    'export CODEX_HOME="$VIBO_CODEX_HOME"',
  ].join('\n');
}
