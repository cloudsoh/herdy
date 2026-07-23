import { execSync, spawnSync } from 'node:child_process';

export async function isTmuxAvailable(): Promise<boolean> {
  try {
    execSync('which tmux', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function createTmuxLogSession(
  sessionName: string,
  services: { name: string; logCommand: string }[]
): Promise<void> {
  if (services.length === 0) return;

  // Kill existing session
  run(`tmux kill-session -t ${sessionName}`);

  // Create session with first service
  const first = services[0];
  const result = runWithOutput(
    `tmux new-session -d -s ${sessionName} "${first.logCommand}"`
  );
  if (result.error) {
    throw new Error(`Failed to create tmux session: ${result.error}`);
  }
  run(`tmux select-pane -t ${sessionName} -T "${first.name}"`);

  // Split panes for remaining services
  for (let i = 1; i < services.length; i++) {
    const service = services[i];
    run(`tmux split-window -t ${sessionName} "${service.logCommand}"`);
    run(`tmux select-pane -t ${sessionName} -T "${service.name}"`);
    run(`tmux select-layout -t ${sessionName} tiled`);
  }

  // Final layout and pane config
  run(`tmux select-layout -t ${sessionName} tiled`);
  run(`tmux set-option -t ${sessionName} pane-border-status top`);
  run(`tmux set-option -t ${sessionName} pane-border-format " #{pane_title} "`);
  run(`tmux set-option -t ${sessionName} history-limit 10000`);
}

export function attachTmuxSession(sessionName: string): void {
  if (process.env.TMUX) {
    spawnSync('tmux', ['switch-client', '-t', sessionName], {
      stdio: 'inherit',
    });
  } else {
    // Use execSync with inherit to properly hand over the terminal to tmux
    try {
      execSync(`tmux attach-session -t ${sessionName}`, { stdio: 'inherit' });
    } catch {}
  }
}

export async function killTmuxSession(sessionName: string): Promise<void> {
  run(`tmux kill-session -t ${sessionName}`);
}


function run(cmd: string): void {
  try {
    execSync(cmd, { stdio: 'pipe' });
  } catch {}
}

function runWithOutput(cmd: string): { error?: string } {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return {};
  } catch (err: any) {
    return { error: err.stderr?.toString() || err.message };
  }
}
