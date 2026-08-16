'use strict';

// The margin CLI (ADR-0001): the single agent-facing surface, driven through
// any harness's bash tool. This ticket ships `serve` and `open`; `list`,
// `locate`, `dismiss`, and `install-skill` arrive with later tickets.
const { marginHome } = require('./paths');
const { ensureDaemon } = require('./ensure');
const { cmdServe } = require('./commands/serve');
const { cmdOpen } = require('./commands/open');

const VERSION = require('../package.json').version;

const USAGE = `margin ${VERSION} — a local feedback loop between visual docs and coding agents

Usage:
  margin serve [--ensure]            Start the daemon. Idempotent: reports the
                                     running daemon if one is already up.
                                     --ensure detaches it into the background
                                     (safe for agents to call at any time).
  margin open <file.html> [options]  Register a doc and print its margin URL.
      --doc <id>                     Doc id (default: derived from file + project;
                                     lowercase letters, digits, '.', '_', '-').
      --agent <name>                 Agent identity stamped on the doc.
      --session <id>                 Agent session id stamped on the doc.
  margin help                        Show this text.
  margin --version                   Print the version.

Environment:
  MARGIN_HOME   State directory (default ~/.margin): daemon.json, journal.jsonl,
                daemon.log. One daemon serves all projects (ADR-0003).
`;

function parseArgs(argv, spec) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      const name = eq === -1 ? a.slice(2) : a.slice(2, eq);
      if (spec.booleans.includes(name)) {
        if (eq !== -1) throw new Error(`--${name} does not take a value`);
        flags[name] = true;
      } else if (spec.values.includes(name)) {
        const value = eq === -1 ? argv[++i] : a.slice(eq + 1);
        if (value == null) throw new Error(`--${name} requires a value`);
        flags[name] = value;
      } else {
        throw new Error(`unknown option: --${name}`);
      }
    } else {
      positionals.push(a);
    }
  }
  return { flags, positionals };
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(USAGE);
      return 0;
    case '--version':
    case '-v':
      console.log(VERSION);
      return 0;
    case undefined:
      process.stderr.write(USAGE);
      return 1;
    case 'serve': {
      const { flags, positionals } = parseArgs(rest, { booleans: ['ensure'], values: [] });
      if (positionals.length) throw new Error(`unexpected argument: ${positionals[0]}`);
      if (flags.ensure) {
        const d = await ensureDaemon(marginHome());
        if (d.alreadyRunning) {
          console.log(`margin daemon already running at http://127.0.0.1:${d.port} (pid ${d.pid})`);
        } else {
          console.log(`margin daemon started at http://127.0.0.1:${d.port} (pid ${d.pid})`);
        }
        return 0;
      }
      return cmdServe(marginHome());
    }
    case 'open': {
      const { flags, positionals } = parseArgs(rest, { booleans: [], values: ['doc', 'agent', 'session'] });
      if (positionals.length === 0) throw new Error('open requires a file argument');
      if (positionals.length > 1) throw new Error(`unexpected argument: ${positionals[1]}`);
      await cmdOpen(marginHome(), {
        file: positionals[0],
        docId: flags.doc ?? null,
        agent: flags.agent ?? null,
        session: flags.session ?? null,
      });
      return 0;
    }
    default:
      process.stderr.write(`margin: unknown command: ${cmd}\n\n`);
      process.stderr.write(USAGE);
      return 1;
  }
}

module.exports = { main, parseArgs, USAGE };
