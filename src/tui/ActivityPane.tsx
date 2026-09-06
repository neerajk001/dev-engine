import React from 'react';
import { Box, Text } from 'ink';
import type { AgentEvent } from '../agent/events.js';

const EVENT_COLORS: Record<AgentEvent['type'], string> = {
  agent_start: 'cyan',
  model_request: 'gray',
  model_response: 'gray',
  tool_start: 'blue',
  tool_end: 'green',
  file_diff: 'white',
  verification_start: 'yellow',
  verification_end: 'yellow',
  repair_start: 'red',
  plan_ready: 'magenta',
  agent_end: 'cyan',
};

/** A compact one-line rendering of an agent event. */
function compactToolSummary(summary: string): string {
  try {
    const input = JSON.parse(summary) as Record<string, unknown>;
    const path = typeof input.path === 'string' ? input.path : undefined;
    const command = typeof input.command === 'string' ? input.command : undefined;
    if (path) return path;
    if (command) return command;
  } catch {
    // Non-JSON tool errors are already human-readable.
  }
  return summary.length > 100 ? `${summary.slice(0, 100)}…` : summary;
}

function eventSummary(e: AgentEvent): string {
  switch (e.type) {
    case 'tool_start':
      return `${e.name}…`;
    case 'tool_end':
      return e.ok
        ? `ok${e.summary ? ` ${compactToolSummary(e.summary)}` : ''}`
        : `failed ${compactToolSummary(e.summary)}`;
    case 'verification_start':
      return `running ${e.command}`;
    case 'verification_end':
      return e.ok ? `passed ${e.command}` : `FAILED ${e.command}`;
    case 'repair_start':
      return `repair ${e.attempt}/${e.maxAttempts}: ${e.reason}`;
    case 'plan_ready':
      return `plan (${e.plan.steps.length} steps)`;
    case 'agent_start':
      return e.task;
    case 'agent_end':
      return e.status;
    case 'model_request':
      return '…';
    case 'model_response':
      return e.toolCalls > 0 ? `→ ${e.toolCalls} tool call(s)` : '';
    default:
      return '';
  }
}

function eventMarker(type: AgentEvent['type']): string {
  if (type === 'tool_start' || type === 'tool_end') return '◆';
  if (type === 'verification_start' || type === 'verification_end') return '◇';
  if (type === 'repair_start') return '!';
  if (type === 'agent_end') return '✓';
  return '·';
}

function toolLabel(event: AgentEvent): string | null {
  if (event.type === 'tool_start') {
    const input = event.input as Record<string, unknown>;
    const target = typeof input.path === 'string'
      ? input.path
      : typeof input.command === 'string'
        ? input.command
        : '';
    return `${event.name}${target ? ` ${target}` : ''}`;
  }
  return null;
}

function DiffBlock({ event }: { event: Extract<AgentEvent, { type: 'file_diff' }> }) {
  const removed = event.removed.slice(0, 8);
  const added = event.added.slice(0, 8);
  const removedMore = event.removed.length - removed.length;
  const addedMore = event.added.length - added.length;
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Text color="cyan" bold>  {event.path}</Text>
      {removed.map((line, index) => <Text key={`removed-${index}`} color="red">  - {line}</Text>)}
      {removedMore > 0 && <Text color="red">  - … {removedMore} more removed line(s)</Text>}
      {added.map((line, index) => <Text key={`added-${index}`} color="green">  + {line}</Text>)}
      {addedMore > 0 && <Text color="green">  + … {addedMore} more added line(s)</Text>}
    </Box>
  );
}

/** Live-scrolling feed of agent events. */
export function ActivityPane({ events }: { events: AgentEvent[] }) {
  const shown = events.slice(-20); // bound the live feed
  const tools = shown.filter((event) => event.type === 'tool_start');
  const nonToolEvents = shown.filter((event) => event.type !== 'tool_start' && event.type !== 'tool_end');
  const toolLabels = tools.map(toolLabel).filter((label): label is string => label !== null);
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="cyan">Activity</Text>
      {shown.length === 0 ? (
        <Text dimColor>waiting for a task</Text>
      ) : (
        <>
          {toolLabels.length > 0 && (
            <Text color="blue">
              <Text dimColor>◆ </Text>
              {toolLabels.length} tool call{toolLabels.length === 1 ? '' : 's'}
              {toolLabels.slice(0, 4).map((label, index) => <Text key={`${label}-${index}`} dimColor>{`  · ${label}`}</Text>)}
              {toolLabels.length > 4 && <Text dimColor>{`  · +${toolLabels.length - 4} more`}</Text>}
            </Text>
          )}
          {nonToolEvents.map((ev, i) => (
            ev.type === 'file_diff'
              ? <DiffBlock key={`${ev.type}-${i}`} event={ev} />
              : ev.type !== 'model_request' && ev.type !== 'model_response'
                ? <Text key={`${ev.type}-${i}`} color={EVENT_COLORS[ev.type]}>
                    <Text dimColor>{eventMarker(ev.type)} </Text>{eventSummary(ev)}
                  </Text>
                : null
          ))}
        </>
      )}
    </Box>
  );
}
