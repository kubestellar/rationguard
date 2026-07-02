# rationguard 🛡️

**Detect and rebut rationalization patterns in AI agent output.**

AI agents make excuses. "Standing by for instructions." "Too complex to fix." "I'll handle it next pass." These sound reasonable but mean the agent stopped working.

rationguard catches these patterns and provides rebuttals — either injected into the agent's system prompt (prevention) or checked against agent output after each response (detection).

---

## Install

```bash
npm install -g @kubestellar/rationguard
```

Or just run it:

```bash
npx @kubestellar/rationguard help
```

---

## Quick Start

### Check agent output for excuses

```bash
rationguard check "Standing by for further instructions. Nothing to do."
```

```
✗ Found 2 rationalization pattern(s):

  45% False Completion
     Pattern:  "no work found"
     Matched:  "nothing to do"
     Rebuttal: Verify by checking the issue queue, task list, or backlog.
               "No work" requires proof, not a claim.

  45% False Completion
     Pattern:  "standing by / awaiting instructions"
     Matched:  "standing by"
     Rebuttal: You are not a receptionist. Check your task queue,
               scan for issues, or find work proactively.
```

### Clean output passes through

```bash
rationguard check "Fixed null pointer in auth.go line 42. PR #567 opened."
```

```
✓ Clean — no rationalization patterns detected.
```

---

## Two Modes

### Mode 1: Post-response detection

Pipe agent output through `rationguard check` after each response. If an excuse matches, inject the rebuttal as a follow-up.

```bash
# Check agent output
echo "$AGENT_RESPONSE" | rationguard check

# Or check a file
rationguard check --file=agent-output.txt

# JSON output for programmatic use
rationguard check --json "I will defer this to next pass"
```

### Mode 2: System prompt prevention

Generate a defense table and inject it into your agent's system prompt. The agent self-polices against known excuses.

```bash
rationguard prompt
```

Outputs a markdown table:

```markdown
## Rationalization Defense — Known Excuses

Before responding, check your output against these patterns...

| Excuse Pattern | Rebuttal |
|----------------|----------|
| no work found  | Verify by checking the issue queue... |
| standing by    | You are not a receptionist...         |
| too complex    | Open a PR with a partial fix...       |
...
```

Paste this into your agent's CLAUDE.md, system prompt, or instructions file.

---

## The 5 Excuse Categories

Every rationalization falls into one of these:

| Category | What it sounds like | What's really happening |
|----------|-------------------|----------------------|
| **False Completion** | "All done", "steady state", "checks are green" | Agent stopped checking without verifying |
| **Complexity Dodge** | "Too complex", "needs approval", "not actionable" | Agent avoiding hard work |
| **Deferral** | "Next pass", "waiting for CI", "filed an issue" | Agent procrastinating |
| **Lane Confusion** | "Not my job", "another agent handles that" | Agent deflecting responsibility |
| **Partial Credit** | "Made progress", "partially addresses it", "probably fine" | Agent claiming done when it isn't |

---

## Auto-Learning

rationguard learns new excuse patterns from your agents over time.

### Record a sighting

When you spot an excuse that isn't in the defaults:

```bash
rationguard add --excuse="synergizing the deliverables" \
  --rebuttal="That is not an action. State what you actually did." \
  --category=false-completion
```

```
+ Recorded new sighting (1/3 for auto-promotion)
```

### Auto-promotion

After the same excuse is seen **3 times**, it's automatically promoted to a custom excuse in `.rationguard/custom-excuses.json`. From then on, `rationguard check` and `rationguard prompt` include it.

```bash
# See what's been recorded
rationguard sightings
```

```
Recorded Sightings (sorted by frequency)

  5× "synergizing the deliverables" [False Completion] promoted
  2× "aligning on priorities"       [Deferral]         2/3
  1× "exploring options"            [Partial Credit]   1/3
```

---

## Custom Excuses

### Per-project

Custom excuses live in `.rationguard/custom-excuses.json` in your project root. Auto-learned excuses land here. You can also edit the file directly:

```json
[
  {
    "pattern": "waiting for the sprint to end",
    "rebuttal": "Sprints are a planning construct, not a blocker. Ship when ready.",
    "category": "deferral",
    "keywords": ["sprint", "waiting for sprint", "end of sprint"]
  }
]
```

### Global

Put the file in `~/.rationguard/custom-excuses.json` for excuses that apply across all your projects.

---

## Programmatic Use

```typescript
import { check, generatePromptBlock, recordSighting } from '@kubestellar/rationguard';

// Check text
const result = check('Standing by for instructions.');
if (!result.clean) {
  for (const match of result.matches) {
    console.log(`${match.excuse.category}: ${match.excuse.rebuttal}`);
  }
}

// Generate prompt block
const block = generatePromptBlock();
// Inject `block` into your agent's system prompt

// Record a new excuse sighting
recordSighting('exploring the solution space', 'deferral', 'Exploring is not delivering.');
```

---

## Origin

rationguard was extracted from the [Hive](https://github.com/kubestellar/hive) multi-agent orchestration system. Hive runs 5+ AI agents continuously and discovered that agents rationalize inaction with predictable patterns. The original excuse-rebuttal tables (49 excuses across 5 agents) were built empirically — every excuse was observed in production before it was catalogued.

The 15 default excuses in rationguard are the universal patterns that apply to any AI agent, not just Hive's.

---

## Cheat Sheet

| Command | What it does |
|---------|-------------|
| `rationguard check <text>` | Check for excuse patterns |
| `rationguard check --file=<path>` | Check file contents |
| `echo ... \| rationguard check` | Check piped input |
| `rationguard check --json <text>` | JSON output |
| `rationguard prompt` | Generate defense table for system prompts |
| `rationguard prompt --format=yaml` | Defense table as YAML |
| `rationguard add --excuse=... --rebuttal=...` | Record an excuse sighting |
| `rationguard list` | Show all known excuses |
| `rationguard sightings` | Show recorded sightings and counts |

---

## License

Apache-2.0
