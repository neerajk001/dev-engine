import type { ToolSchema } from './types.js';

/** JSON Schemas for the agent tools. Single source of truth: the registry
 * and the LLM provider both read these. */

export const readFileSchema: ToolSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Path to the file, relative to the project root or absolute inside it.' },
    offset: { type: 'number', description: '1-based line to start reading from. Negative counts back from the end.' },
    limit: { type: 'number', description: 'Maximum number of lines to read.' },
  },
  required: ['path'],
  additionalProperties: false,
};

export const listFilesSchema: ToolSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Subdirectory to list. Defaults to the project root.' },
    depth: { type: 'number', description: 'Maximum recursion depth. 0 lists the root entries only.' },
    includeHidden: { type: 'boolean', description: 'Include dotfiles/dot-directories (default false).' },
  },
  required: [],
  additionalProperties: false,
};

export const searchFilesSchema: ToolSchema = {
  type: 'object',
  properties: {
    pattern: { type: 'string', description: 'Regular expression to search for.' },
    path: { type: 'string', description: 'Subdirectory to search. Defaults to the project root.' },
    glob: { type: 'string', description: 'Glob filter, e.g. "*.ts" or "src/**/*.ts".' },
    caseSensitive: { type: 'boolean', description: 'Case-sensitive search (default false).' },
    maxResults: { type: 'number', description: 'Maximum matches to return (default 200).' },
  },
  required: ['pattern'],
  additionalProperties: false,
};

export const editFileSchema: ToolSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Path to the file to edit.' },
    oldText: { type: 'string', description: 'Exact text to find. Must match exactly once.' },
    newText: { type: 'string', description: 'Replacement text.' },
  },
  required: ['path', 'oldText', 'newText'],
  additionalProperties: false,
};

export const runCommandSchema: ToolSchema = {
  type: 'object',
  properties: {
    command: { type: 'string', description: 'Command to run in the project root, e.g. "npm test" or "tsc --noEmit".' },
    timeoutMs: { type: 'number', description: 'Optional timeout in milliseconds.' },
  },
  required: ['command'],
  additionalProperties: false,
};

export const toolSchemas: Record<string, ToolSchema> = {
  read_file: readFileSchema,
  list_files: listFilesSchema,
  search_files: searchFilesSchema,
  edit_file: editFileSchema,
  run_command: runCommandSchema,
};
