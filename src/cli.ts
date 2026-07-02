#!/usr/bin/env node

import { check, generatePromptBlock } from './checker.js';
import { DEFAULT_EXCUSES } from './defaults.js';
import { recordSighting, loadCustomExcuses, listSightings } from './learner.js';
import { CATEGORY_LABELS } from './types.js';
import type { ExcuseCategory, Excuse } from './types.js';
import fs from 'node:fs';

const ANSI_RED = '\x1b[31m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_CYAN = '\x1b[36m';
const ANSI_DIM = '\x1b[2m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_RESET = '\x1b[0m';

const CONFIDENCE_HIGH = 0.7;
const CONFIDENCE_MEDIUM = 0.4;

function getAllExcuses(): Excuse[] {
  const custom = loadCustomExcuses();
  const projectCustom = loadCustomExcuses('.');
  return [...DEFAULT_EXCUSES, ...custom, ...projectCustom];
}

function colorConfidence(confidence: number): string {
  if (confidence >= CONFIDENCE_HIGH) return `${ANSI_RED}${(confidence * 100).toFixed(0)}%${ANSI_RESET}`;
  if (confidence >= CONFIDENCE_MEDIUM) return `${ANSI_YELLOW}${(confidence * 100).toFixed(0)}%${ANSI_RESET}`;
  return `${ANSI_DIM}${(confidence * 100).toFixed(0)}%${ANSI_RESET}`;
}

const HELP = `${ANSI_BOLD}rationguard${ANSI_RESET} — Detect and rebut rationalization patterns in AI agent output

${ANSI_BOLD}USAGE${ANSI_RESET}

  ${ANSI_CYAN}rationguard check${ANSI_RESET} <text>           Check text for excuse patterns
  ${ANSI_CYAN}rationguard check${ANSI_RESET} --file=<path>    Check file contents
  echo "..." | ${ANSI_CYAN}rationguard check${ANSI_RESET}     Check piped input

  ${ANSI_CYAN}rationguard prompt${ANSI_RESET}                 Generate a defense table for agent prompts
  ${ANSI_CYAN}rationguard prompt${ANSI_RESET} --format=yaml   Output as YAML block

  ${ANSI_CYAN}rationguard add${ANSI_RESET}                    Record a new excuse sighting (auto-promotes after 3)
    --excuse="<text>"                  The excuse pattern
    --rebuttal="<text>"                How to counter it
    --category=<category>              One of: false-completion, complexity-dodge,
                                       deferral, lane-confusion, partial-credit

  ${ANSI_CYAN}rationguard list${ANSI_RESET}                   Show all known excuses (built-in + custom)
  ${ANSI_CYAN}rationguard sightings${ANSI_RESET}              Show recorded sightings and their counts

  ${ANSI_CYAN}rationguard help${ANSI_RESET}                   Show this help

${ANSI_BOLD}AUTO-LEARNING${ANSI_RESET}

  When ${ANSI_CYAN}rationguard check${ANSI_RESET} finds no match but the text looks like an excuse,
  use ${ANSI_CYAN}rationguard add${ANSI_RESET} to record a sighting. After ${ANSI_BOLD}3 sightings${ANSI_RESET} of the
  same pattern, it auto-promotes to a custom excuse in .rationguard/.

${ANSI_BOLD}MODES${ANSI_RESET}

  ${ANSI_BOLD}Post-response (detection):${ANSI_RESET}  Pipe agent output through ${ANSI_CYAN}rationguard check${ANSI_RESET}
  ${ANSI_BOLD}System prompt (prevention):${ANSI_RESET} Inject ${ANSI_CYAN}rationguard prompt${ANSI_RESET} output into agent instructions

${ANSI_BOLD}OUTPUT${ANSI_RESET}

  --json    Output results as JSON
`;

async function readStdin(): Promise<string> {
  const STDIN_TIMEOUT_MS = 100;
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => resolve(''), STDIN_TIMEOUT_MS);
    process.stdin.on('data', (chunk) => {
      clearTimeout(timer);
      chunks.push(chunk as Buffer);
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString('utf-8').trim());
    });
  });
}

function parseFlags(args: string[]): { command: string; positional: string[]; flags: Record<string, string> } {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  let command = '';

  for (const arg of args) {
    if (!command && !arg.startsWith('-')) {
      command = arg;
    } else if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx > 0) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        flags[arg.slice(2)] = 'true';
      }
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

async function cmdCheck(positional: string[], flags: Record<string, string>): Promise<void> {
  let input = positional.join(' ');

  if (flags['file']) {
    const filePath = flags['file'];
    if (!fs.existsSync(filePath)) {
      console.error(`${ANSI_RED}Error:${ANSI_RESET} File not found: ${filePath}`);
      process.exit(1);
    }
    input = fs.readFileSync(filePath, 'utf-8');
  }

  if (!input) {
    input = await readStdin();
  }

  if (!input) {
    console.error(`${ANSI_RED}Error:${ANSI_RESET} No input. Provide text, --file=<path>, or pipe input.`);
    process.exit(1);
  }

  const allExcuses = getAllExcuses();
  const result = check(input, { excuses: allExcuses });

  if (flags['json'] === 'true') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.clean) {
    console.log(`${ANSI_GREEN}✓${ANSI_RESET} Clean — no rationalization patterns detected.`);
    return;
  }

  console.log(`${ANSI_RED}✗${ANSI_RESET} Found ${result.matches.length} rationalization pattern(s):\n`);

  for (const match of result.matches) {
    if (!match.excuse) continue;
    const category = CATEGORY_LABELS[match.excuse.category];
    console.log(`  ${colorConfidence(match.confidence)} ${ANSI_BOLD}${category}${ANSI_RESET}`);
    console.log(`     Pattern:  "${match.excuse.pattern}"`);
    console.log(`     Matched:  "${match.matchedText}"`);
    console.log(`     Rebuttal: ${match.excuse.rebuttal}`);
    console.log();
  }

  // Auto-record sightings for high-confidence matches
  for (const match of result.matches) {
    if (match.excuse && match.confidence >= CONFIDENCE_HIGH) {
      recordSighting(match.matchedText, match.excuse.category);
    }
  }
}

function cmdPrompt(flags: Record<string, string>): void {
  const allExcuses = getAllExcuses();
  const block = generatePromptBlock({ excuses: allExcuses });

  if (flags['format'] === 'yaml') {
    console.log('rationalization_defense: |');
    for (const line of block.split('\n')) {
      console.log(`  ${line}`);
    }
    return;
  }

  console.log(block);
}

function cmdAdd(positional: string[], flags: Record<string, string>): void {
  const excuse = positional.join(' ') || flags['excuse'];
  if (!excuse) {
    console.error(`${ANSI_RED}Error:${ANSI_RESET} Provide excuse text as an argument or --excuse="<text>".`);
    console.error(`  rationguard add "I already handled that" --category false-completion`);
    process.exit(1);
  }

  const category = (flags['category'] as ExcuseCategory) || undefined;
  const rebuttal = flags['rebuttal'] || undefined;

  const result = recordSighting(excuse, category, rebuttal);

  if (result.autoPromoted && result.excuse) {
    console.log(`${ANSI_GREEN}⬆${ANSI_RESET} Auto-promoted to custom excuse! (seen ${result.count} times)`);
    console.log(`   Category: ${CATEGORY_LABELS[result.excuse.category]}`);
    console.log(`   Rebuttal: ${result.excuse.rebuttal}`);
  } else if (result.isNew) {
    console.log(`${ANSI_YELLOW}+${ANSI_RESET} Recorded new sighting (${result.count}/3 for auto-promotion)`);
  } else {
    console.log(`${ANSI_YELLOW}↑${ANSI_RESET} Sighting count: ${result.count}/3 for auto-promotion`);
  }
}

function cmdList(flags: Record<string, string>): void {
  const allExcuses = getAllExcuses();

  if (flags['json'] === 'true') {
    console.log(JSON.stringify(allExcuses, null, 2));
    return;
  }

  const grouped = new Map<string, Excuse[]>();
  for (const excuse of allExcuses) {
    const cat = CATEGORY_LABELS[excuse.category];
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(excuse);
  }

  for (const [category, excuses] of grouped) {
    console.log(`\n${ANSI_BOLD}${category}${ANSI_RESET}`);
    for (const excuse of excuses) {
      console.log(`  ${ANSI_CYAN}•${ANSI_RESET} ${excuse.pattern}`);
      console.log(`    ${ANSI_DIM}→ ${excuse.rebuttal}${ANSI_RESET}`);
    }
  }
  console.log();
}

function cmdSightings(flags: Record<string, string>): void {
  const sightings = listSightings();

  if (sightings.length === 0) {
    console.log(`${ANSI_DIM}No sightings recorded yet. Use ${ANSI_CYAN}rationguard add${ANSI_RESET}${ANSI_DIM} to record excuses.${ANSI_RESET}`);
    return;
  }

  if (flags['json'] === 'true') {
    console.log(JSON.stringify(sightings, null, 2));
    return;
  }

  console.log(`\n${ANSI_BOLD}Recorded Sightings${ANSI_RESET} (sorted by frequency)\n`);
  for (const s of sightings) {
    const status = s.promoted
      ? `${ANSI_GREEN}promoted${ANSI_RESET}`
      : `${s.count}/3`;
    const category = CATEGORY_LABELS[s.suggestedCategory];
    console.log(`  ${ANSI_BOLD}${s.count}×${ANSI_RESET} "${s.text}" ${ANSI_DIM}[${category}]${ANSI_RESET} ${status}`);
  }
  console.log();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, positional, flags } = parseFlags(args);

  switch (command) {
    case 'check':
      await cmdCheck(positional, flags);
      break;
    case 'prompt':
      cmdPrompt(flags);
      break;
    case 'add':
      cmdAdd(positional, flags);
      break;
    case 'list':
      cmdList(flags);
      break;
    case 'sightings':
      cmdSightings(flags);
      break;
    case 'help':
    case '':
      console.log(HELP);
      break;
    default:
      // Treat unknown command as check input
      await cmdCheck([command, ...positional], flags);
      break;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
