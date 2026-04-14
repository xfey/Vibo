import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_LOGIN_SHELL = '/bin/zsh';

let loginShellPathPromise: Promise<string | null> | null = null;

function resolveLoginShellPath(): string {
  const shellPath = process.env.SHELL?.trim();

  return shellPath && shellPath.length > 0 ? shellPath : DEFAULT_LOGIN_SHELL;
}

async function readLoginShellPathValue(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(resolveLoginShellPath(), ['-lic', 'printf %s "$PATH"']);
    const pathValue = stdout.trim();

    return pathValue.length > 0 ? pathValue : null;
  } catch (error) {
    console.warn('[agents] failed to resolve login shell PATH', {
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

export async function resolveLoginShellPathValue(): Promise<string | null> {
  if (!loginShellPathPromise) {
    loginShellPathPromise = readLoginShellPathValue();
  }

  return loginShellPathPromise;
}

export async function buildLocalAgentEnvironment(
  envOverrides: Record<string, string>,
): Promise<Record<string, string>> {
  const loginShellPathValue = await resolveLoginShellPathValue();

  return {
    ...(loginShellPathValue ? { PATH: loginShellPathValue } : {}),
    ...envOverrides,
  };
}
