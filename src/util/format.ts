/**
 * Rough token estimate: ~4 characters per token for mixed text,
 * ~1 token per 3 characters for compact code.
 */
export function estimateTokens(text: string): number {
  const codeChars = (text.match(/\S/g) ?? []).length;
  return Math.ceil(codeChars / 3);
}

/**
 * Keep `text` within an approximate token budget. Adds a clear truncation
 * note so the model knows content was cut, with the remaining portion's
 * location when a path is provided.
 */
export function truncateToTokens(
  text: string,
  maxTokens: number,
  note?: string,
): string {
  if (estimateTokens(text) <= maxTokens) {
    return text;
  }
  // Allow up to maxTokens worth of characters under the 3-char/token rule.
  const maxChars = maxTokens * 3;
  const head = text.slice(0, Math.max(0, Math.floor(maxChars / 2)));
  const tail = text.slice(Math.max(0, text.length - Math.floor(maxChars / 2)));
  const lines = ['... [truncated] ...'];
  if (note) {
    lines.push(`Note: ${note}`);
  }
  return `${head}\n${lines.join('\n')}\n${tail}`;
}

/** One-line project summary for the agent's context window. */
export function summarizeProject(name: string, fileCount: number, root: string): string {
  return [
    `Project: ${name}`,
    `Root: ${root}`,
    `Tracked source files: ${fileCount}`,
  ].join('\n');
}
