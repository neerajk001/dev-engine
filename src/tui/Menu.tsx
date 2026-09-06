import React from 'react';
import { Box, Text } from 'ink';

export interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
}

interface MenuProps {
  items: MenuItem[];
  selectedIndex: number;
  focused: boolean;
}

/** Selectable menu with arrow key navigation. */
export function Menu({ items, selectedIndex, focused }: MenuProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={focused ? 'cyan' : 'gray'} bold>Actions</Text>
      {items.map((item, i) => {
        const isSelected = i === selectedIndex && focused;
        const prefix = isSelected ? '▸ ' : '  ';
        const label = `${prefix}${item.label}`;
        const shortcut = item.shortcut ? ` (${item.shortcut})` : '';
        if (isSelected) {
          return (
            <Text key={item.id} color="cyan" bold>
              {label}
              <Text dimColor>{shortcut}</Text>
            </Text>
          );
        }
        return (
          <Text key={item.id}>
            {label}
            <Text dimColor>{shortcut}</Text>
          </Text>
        );
      })}
    </Box>
  );
}
