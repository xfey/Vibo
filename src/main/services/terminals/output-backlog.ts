import type { TerminalSessionSnapshot } from '@shared/contracts/terminal';

const DEFAULT_MAX_OUTPUT_CHARACTERS = 256 * 1024;

export class TerminalOutputBacklog {
  private readonly chunks: string[] = [];
  private totalLength = 0;
  private truncated = false;

  constructor(private readonly maxOutputCharacters = DEFAULT_MAX_OUTPUT_CHARACTERS) {}

  append(chunk: string): void {
    if (chunk.length === 0) {
      return;
    }

    if (chunk.length >= this.maxOutputCharacters) {
      this.chunks.length = 0;
      this.chunks.push(chunk.slice(-this.maxOutputCharacters));
      this.totalLength = this.chunks[0].length;
      this.truncated = true;
      return;
    }

    this.chunks.push(chunk);
    this.totalLength += chunk.length;

    while (this.totalLength > this.maxOutputCharacters && this.chunks.length > 0) {
      const overflow = this.totalLength - this.maxOutputCharacters;
      const oldestChunk = this.chunks[0];

      if (oldestChunk.length <= overflow) {
        this.chunks.shift();
        this.totalLength -= oldestChunk.length;
      } else {
        this.chunks[0] = oldestChunk.slice(overflow);
        this.totalLength -= overflow;
      }

      this.truncated = true;
    }
  }

  readSnapshot(sessionId: string, lastSequence: number): TerminalSessionSnapshot {
    return {
      sessionId,
      output: this.chunks.join(''),
      lastSequence,
      truncated: this.truncated,
    };
  }

  readTail(maxOutputCharacters = 4096): string {
    if (maxOutputCharacters <= 0 || this.chunks.length === 0) {
      return '';
    }

    let remainingCharacters = maxOutputCharacters;
    const tailChunks: string[] = [];

    for (let index = this.chunks.length - 1; index >= 0 && remainingCharacters > 0; index -= 1) {
      const chunk = this.chunks[index];

      if (chunk.length <= remainingCharacters) {
        tailChunks.unshift(chunk);
        remainingCharacters -= chunk.length;
        continue;
      }

      tailChunks.unshift(chunk.slice(-remainingCharacters));
      remainingCharacters = 0;
    }

    return tailChunks.join('');
  }
}
