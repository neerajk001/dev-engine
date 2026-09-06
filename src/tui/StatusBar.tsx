import React from 'react';
import { Box, Text } from 'ink';

export interface StatusBarProps {
  workspace: string;
  model: string;
  phase: string;
}

/** Header status bar: workspace, model, current phase. */
export function StatusBar({ workspace, model, phase }: StatusBarProps) {
  return (
    <Box justifyContent="space-between" paddingX={1} borderStyle="single" borderColor="gray">
      <Text>
        <Text color="green" bold>
          ●
        </Text>
        {'  '}
        <Text bold>dev-engine</Text>
        <Text dimColor>  {workspace}</Text>
      </Text>
      <Text>
        <Text color={phase === 'running' ? 'yellow' : 'gray'}>{phase}</Text>
        <Text dimColor>  {model}</Text>
      </Text>
    </Box>
  );
}
