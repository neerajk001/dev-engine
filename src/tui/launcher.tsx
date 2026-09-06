import React from 'react';
import { render } from 'ink';
import { TuiApp } from './app.js';
import type { Agent } from '../agent/agent.js';
import type { OptimizeEngine } from '../optimizer/optimizer.js';

/** Mount the Ink TUI and resolve when the app exits. */
export async function launchTui(opts: {
  agent: Agent;
  optimizer?: OptimizeEngine;
  workspace: string;
  model: string;
}): Promise<void> {
  await new Promise<void>((resolve) => {
    render(
      <TuiApp
        agent={opts.agent}
        workspace={opts.workspace}
        model={opts.model}
        {...(opts.optimizer !== undefined ? { optimizer: opts.optimizer } : {})}
      />,
    );
    // Ink keeps the process alive; resolve when the process exits
    // (TuiApp calls useApp().exit() on /exit).
    process.once('exit', resolve);
  });
}
