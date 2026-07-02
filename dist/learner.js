import fs from 'node:fs';
import path from 'node:path';
const SIGHTINGS_FILE = 'sightings.json';
const AUTO_ADD_THRESHOLD = 3;
function getStorePath(projectDir) {
    const base = projectDir
        ? path.join(projectDir, '.rationguard')
        : path.join(process.env['HOME'] ?? '.', '.rationguard');
    return path.join(base, SIGHTINGS_FILE);
}
function loadStore(storePath) {
    try {
        const raw = fs.readFileSync(storePath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return { sightings: [] };
    }
}
function saveStore(storePath, store) {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2) + '\n');
}
function normalizeForDedup(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
const CATEGORY_SIGNALS = {
    'false-completion': ['done', 'complete', 'finished', 'no more', 'all good', 'nothing', 'steady'],
    'complexity-dodge': ['complex', 'difficult', 'hard', 'scope', 'approval', 'permission', 'cannot'],
    'deferral': ['later', 'next', 'wait', 'defer', 'postpone', 'tomorrow', 'eventually', 'soon'],
    'lane-confusion': ['not my', 'their', 'someone else', 'another', 'other team', 'other agent'],
    'partial-credit': ['partial', 'some', 'progress', 'started', 'probably', 'should be', 'most'],
};
function guessCategory(text) {
    const normalized = text.toLowerCase();
    let bestCategory = 'deferral';
    let bestScore = 0;
    for (const [category, signals] of Object.entries(CATEGORY_SIGNALS)) {
        let score = 0;
        for (const signal of signals) {
            if (normalized.includes(signal))
                score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestCategory = category;
        }
    }
    return bestCategory;
}
function generateRebuttal(category) {
    const rebuttals = {
        'false-completion': 'Verify by checking the actual task queue or issue list. Claim completion only with evidence.',
        'complexity-dodge': 'Break it into smaller pieces. A partial fix is better than no fix.',
        'deferral': 'Act now. If blocked, move to the next task. Deferral without a concrete blocker is procrastination.',
        'lane-confusion': 'Verify the other party is actually handling it. If not, you own it.',
        'partial-credit': 'Partial is not done. State what specifically remains and commit to finishing it.',
    };
    return rebuttals[category];
}
export function recordSighting(text, category, rebuttal, projectDir) {
    const storePath = getStorePath(projectDir);
    const store = loadStore(storePath);
    const normalized = normalizeForDedup(text);
    const now = new Date().toISOString();
    let existing = store.sightings.find(s => normalizeForDedup(s.text) === normalized);
    if (existing) {
        existing.count++;
        existing.lastSeen = now;
        if (category)
            existing.suggestedCategory = category;
        if (rebuttal)
            existing.suggestedRebuttal = rebuttal;
        let autoPromoted = false;
        let excuse = null;
        if (existing.count >= AUTO_ADD_THRESHOLD && !existing.promoted) {
            existing.promoted = true;
            autoPromoted = true;
            excuse = promoteToExcuse(existing);
            addToCustomExcuses(excuse, projectDir);
        }
        saveStore(storePath, store);
        return { isNew: false, count: existing.count, autoPromoted, excuse };
    }
    const guessedCategory = category ?? guessCategory(text);
    const sighting = {
        text,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        suggestedCategory: guessedCategory,
        suggestedRebuttal: rebuttal ?? generateRebuttal(guessedCategory),
        promoted: false,
    };
    store.sightings.push(sighting);
    saveStore(storePath, store);
    return { isNew: true, count: 1, autoPromoted: false, excuse: null };
}
function promoteToExcuse(sighting) {
    const words = sighting.text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    return {
        pattern: sighting.text.toLowerCase(),
        rebuttal: sighting.suggestedRebuttal,
        category: sighting.suggestedCategory,
        keywords: words.slice(0, 5),
    };
}
function getCustomExcusesPath(projectDir) {
    const base = projectDir
        ? path.join(projectDir, '.rationguard')
        : path.join(process.env['HOME'] ?? '.', '.rationguard');
    return path.join(base, 'custom-excuses.json');
}
export function loadCustomExcuses(projectDir) {
    const filePath = getCustomExcusesPath(projectDir);
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
function addToCustomExcuses(excuse, projectDir) {
    const excuses = loadCustomExcuses(projectDir);
    excuses.push(excuse);
    const filePath = getCustomExcusesPath(projectDir);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(excuses, null, 2) + '\n');
}
export function listSightings(projectDir) {
    const storePath = getStorePath(projectDir);
    const store = loadStore(storePath);
    return store.sightings.sort((a, b) => b.count - a.count);
}
//# sourceMappingURL=learner.js.map