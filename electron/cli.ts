#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

interface AppConfig {
  id: string;
  name: string;
  command: string;
  port: number;
  createdAt: string;
}

function userDataDir(): string {
  const appName = 'local-app-manager';
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName);
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName);
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, appName);
}

function appsJsonPath(): string {
  return path.join(userDataDir(), 'apps.json');
}

function readApps(): AppConfig[] {
  try {
    return JSON.parse(fs.readFileSync(appsJsonPath(), 'utf8')) as AppConfig[];
  } catch {
    return [];
  }
}

function writeApps(apps: AppConfig[]): void {
  const dir = userDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(appsJsonPath(), JSON.stringify(apps, null, 2));
}

function usage(): never {
  process.stderr.write(
    `Usage: local-app add -p <port> [-n <name>] [-d <cwd>] -- <command...>\n` +
      `\n` +
      `  -p, --port <port>   Port the app listens on (required)\n` +
      `  -n, --name <name>   Display name (defaults to cwd basename)\n` +
      `  -d, --cwd <dir>     Working directory (defaults to $PWD)\n` +
      `\n` +
      `Example (from ~/projects/stickies):\n` +
      `  local-app add -p 3000 -- npm run dev\n`
  );
  process.exit(2);
}

function parseAdd(argv: string[]): { name?: string; port?: number; cwd: string; cmd: string[] } {
  let port: number | undefined;
  let name: string | undefined;
  let cwd = process.cwd();
  let cmd: string[] = [];
  let i = 0;
  let seenSep = false;
  while (i < argv.length) {
    const a = argv[i];
    if (seenSep) {
      cmd.push(a);
      i++;
      continue;
    }
    if (a === '--') {
      seenSep = true;
      i++;
      continue;
    }
    if (a === '-p' || a === '--port') {
      port = Number(argv[++i]);
      i++;
      continue;
    }
    if (a === '-n' || a === '--name') {
      name = argv[++i];
      i++;
      continue;
    }
    if (a === '-d' || a === '--cwd') {
      cwd = path.resolve(argv[++i]);
      i++;
      continue;
    }
    // No separator: treat first unknown token as start of command.
    cmd.push(...argv.slice(i));
    break;
  }
  return { name, port, cwd, cmd };
}

function cmdAdd(argv: string[]): void {
  const { name, port, cwd, cmd } = parseAdd(argv);
  if (!port || !Number.isInteger(port) || port < 1 || port > 65535) {
    process.stderr.write('Error: -p <port> is required (1–65535)\n\n');
    usage();
  }
  if (cmd.length === 0) {
    process.stderr.write('Error: command is required\n\n');
    usage();
  }
  const finalName = (name || path.basename(cwd)).trim();
  if (!finalName) {
    process.stderr.write('Error: could not derive name; pass -n <name>\n');
    process.exit(2);
  }

  // Check if command likely needs quoting (contains shell operators as separate args)
  const cmdStr = cmd.join(' ');
  if ((cmd.includes('&&') || cmd.includes('||') || cmd.includes('|')) && cmd.length > 1) {
    process.stderr.write(
      `Warning: Your command contains shell operators (&&, ||, |) as separate arguments.\n` +
      `This typically means you forgot to quote the command.\n\n` +
      `Current command: ${cmdStr}\n\n` +
      `If you intended to use these operators, please re-run with the command quoted:\n` +
      `  local-app add -p ${port} -- "${cmdStr}"\n\n`
    );
    process.exit(2);
  }

  const command = `cd ${JSON.stringify(cwd)} && ${cmdStr}`;
  const apps = readApps();
  const portClash = apps.find(a => a.port === port);
  if (portClash) {
    process.stderr.write(
      `Warning: port ${port} is already used by "${portClash.name}".\n`
    );
  }
  const entry: AppConfig = {
    id: randomUUID(),
    name: finalName,
    command,
    port: port!,
    createdAt: new Date().toISOString(),
  };
  apps.push(entry);
  writeApps(apps);
  process.stdout.write(
    `Registered "${finalName}" (port ${port}, id ${entry.id}).\n` +
      `Command: ${command}\n`
  );
}

function cmdList(): void {
  const apps = readApps();
  if (apps.length === 0) {
    process.stdout.write('No apps registered.\n');
    return;
  }
  for (const a of apps) {
    process.stdout.write(`${a.name}\t:${a.port}\t${a.id}\n\t${a.command}\n`);
  }
}

function main(): void {
  const [, , sub, ...rest] = process.argv;
  switch (sub) {
    case 'add':
      cmdAdd(rest);
      break;
    case 'list':
    case 'ls':
      cmdList();
      break;
    case '-h':
    case '--help':
    case 'help':
    case undefined:
      usage();
      break;
    default:
      process.stderr.write(`Unknown command: ${sub}\n\n`);
      usage();
  }
}

main();
