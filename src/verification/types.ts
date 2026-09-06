export interface Verdict {
  ok: boolean;
  command: string;
  exitCode: number | null;
  output: string;
  durationMs: number;
}
