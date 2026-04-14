import { toRemoteShellPathExpression, type SshCommandRunner } from '@main/services/ssh/ssh-command-runner';

const REMOTE_FILE_HEADER = '__VIBO_REMOTE_FILE__';
const REMOTE_FILE_MISSING = '__VIBO_REMOTE_FILE_MISSING__';

export async function readRemoteFile(
  sshCommandRunner: SshCommandRunner,
  host: string,
  rawPath: string,
): Promise<Buffer | null> {
  const targetExpression = toRemoteShellPathExpression(rawPath);
  const result = await sshCommandRunner.run(
    host,
    [
      `target=${targetExpression};`,
      'if [ ! -f "$target" ] && [ ! -L "$target" ]; then',
      `  printf '%s' ${JSON.stringify(REMOTE_FILE_MISSING)};`,
      '  exit 0;',
      'fi;',
      `printf '%s\\n' ${JSON.stringify(REMOTE_FILE_HEADER)};`,
      'cat -- "$target"',
    ].join(' '),
  );
  const headerBuffer = Buffer.from(`${REMOTE_FILE_HEADER}\n`, 'utf8');
  const missingBuffer = Buffer.from(REMOTE_FILE_MISSING, 'utf8');

  if (result.stdout.equals(missingBuffer)) {
    return null;
  }

  if (result.stdout.subarray(0, headerBuffer.length).equals(headerBuffer)) {
    return result.stdout.subarray(headerBuffer.length);
  }

  throw new Error('Remote file response was malformed.');
}

export async function getRemoteFileSize(
  sshCommandRunner: SshCommandRunner,
  host: string,
  rawPath: string,
): Promise<number | null> {
  const targetExpression = toRemoteShellPathExpression(rawPath);
  const output = await sshCommandRunner.runText(
    host,
    [
      `target=${targetExpression};`,
      'if [ ! -f "$target" ] && [ ! -L "$target" ]; then',
      "  printf '%s\\n' 'missing';",
      '  exit 0;',
      'fi;',
      "wc -c < \"$target\" | tr -d '[:space:]'",
    ].join(' '),
  );
  const normalized = output.trim();

  if (normalized === 'missing' || normalized.length === 0) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function listRemoteFiles(
  sshCommandRunner: SshCommandRunner,
  host: string,
  rawDirectoryPath: string,
): Promise<string[]> {
  const targetExpression = toRemoteShellPathExpression(rawDirectoryPath);
  const output = await sshCommandRunner.run(
    host,
    [
      `target=${targetExpression};`,
      'if [ ! -d "$target" ]; then',
      '  exit 0;',
      'fi;',
      "find \"$target\" -mindepth 1 -maxdepth 1 -type f -print0",
    ].join(' '),
  );

  return output.stdout
    .toString('utf8')
    .split('\0')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
