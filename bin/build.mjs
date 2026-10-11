#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const USAGE = `usage: build.mjs --spec review.json [--diff file.diff | --base <ref>] [--out review.html]`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) throw new Error(USAGE);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  if (!args.spec) throw new Error(USAGE);
  return args;
}

export function parseDiff(text) {
  const files = [];
  let file = null;
  let hunk = null;
  let o = 0;
  let n = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      file = { path: line.split(' b/').pop(), hunks: [] };
      files.push(file);
      hunk = null;
    } else if (file && line.startsWith('+++ ')) {
      if (line !== '+++ /dev/null') file.path = line.slice(4).replace(/^b\//, '');
    } else if (file && line.startsWith('@@')) {
      const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
      o = +m[1];
      n = +m[3];
      hunk = { header: line, newStart: n, newEnd: n + Math.max(+(m[4] ?? 1), 1) - 1, oldStart: o, lines: [] };
      file.hunks.push(hunk);
    } else if (hunk && /^[ +-]/.test(line)) {
      const t = line[0];
      hunk.lines.push({ t, s: line.slice(1), o: t === '+' ? null : o++, n: t === '-' ? null : n++ });
    }
  }
  return files;
}

function resolveRef(files, ref) {
  const file = files.find((f) => f.path === ref.file);
  if (!file) throw new Error(`hunk ref points at "${ref.file}", which is not in the diff`);
  const hunks = ref.lines
    ? file.hunks.filter((h) => h.newStart <= ref.lines[1] && h.newEnd >= ref.lines[0])
    : file.hunks;
  if (!hunks.length) throw new Error(`hunk ref ${ref.file}:${ref.lines} matches no changed lines`);
  return hunks.map((h) => ({ file: file.path, ...h }));
}

export function validate(spec, files) {
  const errors = [];
  const ids = new Set(spec.nodes.map((n) => n.id));
  if (ids.size !== spec.nodes.length) errors.push('node ids must be unique');
  for (const node of spec.nodes) {
    if (!SEVERITIES.includes(node.severity)) errors.push(`node ${node.id}: severity must be one of ${SEVERITIES}`);
    const qs = spec.questions.filter((q) => q.nodeId === node.id);
    const quizzed = node.severity === 'critical' || node.severity === 'high';
    if (quizzed && qs.length < 2) errors.push(`node ${node.id} (${node.severity}) needs >= 2 questions, has ${qs.length}`);
    if (!quizzed && qs.length) errors.push(`node ${node.id} (${node.severity}) has ${qs.length} question(s), but only critical and high areas are quizzed. Remove them`);
  }
  for (const e of spec.edges ?? []) {
    if (!ids.has(e.from) || !ids.has(e.to)) errors.push(`edge ${e.from} -> ${e.to} references an unknown node`);
  }
  for (const q of spec.questions) {
    if (!ids.has(q.nodeId)) errors.push(`question ${q.id}: unknown nodeId ${q.nodeId}`);
    if (!(q.answer >= 0 && q.answer < q.choices.length)) errors.push(`question ${q.id}: answer index out of range`);
    if (!q.explanation) errors.push(`question ${q.id}: missing explanation (shown when answered wrong)`);
  }
  const covered = new Set();
  for (const node of spec.nodes) {
    for (const ref of node.hunks ?? []) {
      try {
        for (const h of resolveRef(files, ref)) covered.add(`${h.file}${h.header}`);
      } catch (err) {
        errors.push(`node ${node.id}: ${err.message}`);
      }
    }
  }
  const uncovered = files.flatMap((f) => f.hunks.filter((h) => !covered.has(`${f.path}${h.header}`)).map((h) => `${f.path} ${h.header}`));
  return { errors, uncovered };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const spec = JSON.parse(readFileSync(args.spec, 'utf8'));
  const diffText = args.diff
    ? readFileSync(args.diff, 'utf8')
    : execFileSync('git', ['diff', args.base ? `${args.base}...HEAD` : 'HEAD'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const files = parseDiff(diffText);
  if (!files.length) throw new Error('diff is empty');

  const { errors, uncovered } = validate(spec, files);
  if (errors.length) {
    console.error(`spec invalid:\n  - ${errors.join('\n  - ')}`);
    process.exit(1);
  }
  if (uncovered.length) console.warn(`warning: ${uncovered.length} hunk(s) not mapped to any node:\n  - ${uncovered.join('\n  - ')}`);

  for (const node of spec.nodes) node.diff = (node.hunks ?? []).flatMap((ref) => resolveRef(files, ref));
  spec.uncovered = uncovered;
  spec.stats = {
    files: files.length,
    added: files.reduce((a, f) => a + f.hunks.reduce((b, h) => b + h.lines.filter((l) => l.t === '+').length, 0), 0),
    removed: files.reduce((a, f) => a + f.hunks.reduce((b, h) => b + h.lines.filter((l) => l.t === '-').length, 0), 0),
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const template = readFileSync(join(here, '..', 'template', 'review.html'), 'utf8');
  const json = JSON.stringify(spec).replace(/</g, '\\u003c');
  const out = args.out ?? 'review.html';
  writeFileSync(out, template.replace('"__SPEC__"', () => json));
  console.log(`wrote ${out}: ${spec.nodes.length} nodes, ${spec.questions.length} questions, ${spec.stats.files} files (+${spec.stats.added} -${spec.stats.removed})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
