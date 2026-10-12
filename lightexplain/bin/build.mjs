#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve, relative, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const IMPORTANCE = ['core', 'key', 'supporting', 'background'];
const QUIZZED = new Set(['core', 'key']);
const LONG_SNIPPET = 60;
const USAGE = `usage: build.mjs --spec explain.json [--root <repo dir>] [--out explain.html]`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) throw new Error(USAGE);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  if (!args.spec) throw new Error(USAGE);
  return args;
}

function git(root, ...argv) {
  try {
    return execFileSync('git', ['-C', root, ...argv], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

// Reads one snippet from disk and checks that it says what the spec claims it says.
export function resolveSnippet(root, ref, readFile = (p) => readFileSync(p, 'utf8')) {
  const abs = resolve(root, ref.file);
  const rel = relative(root, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`"${ref.file}" is outside the root`);
  if (!existsSync(abs) || !statSync(abs).isFile()) throw new Error(`"${ref.file}" does not exist under the root`);
  const all = readFile(abs).replace(/\n$/, '').split('\n');
  const [start, end] = ref.lines ?? [1, all.length];
  if (!(start >= 1 && end >= start && end <= all.length)) {
    throw new Error(`${ref.file}:${start}-${end} is out of range (file has ${all.length} lines)`);
  }
  const text = all.slice(start - 1, end);
  if (ref.anchor && !text.some((l) => l.includes(ref.anchor))) {
    const found = all.findIndex((l) => l.includes(ref.anchor));
    const where = found < 0 ? 'it is not in the file' : `it is on line ${found + 1}`;
    throw new Error(`${ref.file}:${start}-${end} does not contain anchor ${JSON.stringify(ref.anchor)}; ${where}`);
  }
  const [fs, fe] = ref.focus ?? [0, -1];
  if (ref.focus && !(fs >= start && fe <= end && fe >= fs)) {
    throw new Error(`${ref.file}: focus ${fs}-${fe} is outside lines ${start}-${end}`);
  }
  return {
    file: rel,
    start,
    end,
    note: ref.note ?? '',
    lines: text.map((s, i) => ({ n: start + i, s, f: start + i >= fs && start + i <= fe })),
  };
}

export function validate(spec, root) {
  const errors = [];
  const warnings = [];
  const ids = new Set(spec.sections.map((s) => s.id));
  if (ids.size !== spec.sections.length) errors.push('section ids must be unique');
  for (const sec of spec.sections) {
    if (!IMPORTANCE.includes(sec.importance)) errors.push(`section ${sec.id}: importance must be one of ${IMPORTANCE}`);
    if (!sec.explanation) errors.push(`section ${sec.id}: missing explanation`);
    const qs = spec.questions.filter((q) => q.sectionId === sec.id);
    const quizzed = QUIZZED.has(sec.importance);
    if (quizzed && qs.length < 2) errors.push(`section ${sec.id} (${sec.importance}) needs >= 2 questions, has ${qs.length}`);
    if (!quizzed && qs.length) errors.push(`section ${sec.id} (${sec.importance}) has ${qs.length} question(s), but only core and key sections are quizzed. Remove them`);
    sec.code = [];
    for (const ref of sec.snippets ?? []) {
      try {
        const snip = resolveSnippet(root, ref);
        if (snip.lines.length > LONG_SNIPPET) warnings.push(`section ${sec.id}: ${snip.file}:${snip.start}-${snip.end} is ${snip.lines.length} lines. Trim it to the part that matters`);
        sec.code.push(snip);
      } catch (err) {
        errors.push(`section ${sec.id}: ${err.message}`);
      }
    }
    if (!sec.code.length && sec.kind !== 'concept') warnings.push(`section ${sec.id} has no snippets. Give it kind "concept" if that is intended`);
  }
  for (const e of spec.edges ?? []) {
    if (!ids.has(e.from) || !ids.has(e.to)) errors.push(`edge ${e.from} -> ${e.to} references an unknown section`);
  }
  for (const q of spec.questions) {
    if (!ids.has(q.sectionId)) errors.push(`question ${q.id}: unknown sectionId ${q.sectionId}`);
    if (!(q.answer >= 0 && q.answer < q.choices.length)) errors.push(`question ${q.id}: answer index out of range`);
    if (!q.explanation) errors.push(`question ${q.id}: missing explanation`);
  }
  return { errors, warnings };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const spec = JSON.parse(readFileSync(args.spec, 'utf8'));
  const root = resolve(args.root ?? git(process.cwd(), 'rev-parse', '--show-toplevel') ?? process.cwd());

  const { errors, warnings } = validate(spec, root);
  if (errors.length) {
    console.error(`spec invalid:\n  - ${errors.join('\n  - ')}`);
    process.exit(1);
  }
  if (warnings.length) console.warn(`warning:\n  - ${warnings.join('\n  - ')}`);

  const files = new Set(spec.sections.flatMap((s) => s.code.map((c) => c.file)));
  spec.source = {
    repo: basename(git(root, 'rev-parse', '--show-toplevel') ?? root),
    commit: git(root, 'rev-parse', '--short', 'HEAD'),
    dirty: Boolean(git(root, 'status', '--porcelain', '--', ...files)),
    files: files.size,
    lines: spec.sections.reduce((a, s) => a + s.code.reduce((b, c) => b + c.lines.length, 0), 0),
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const template = readFileSync(join(here, '..', 'template', 'explain.html'), 'utf8');
  const json = JSON.stringify(spec).replace(/</g, '\\u003c');
  const out = args.out ?? 'explain.html';
  writeFileSync(out, template.replace('"__SPEC__"', () => json));
  console.log(`wrote ${out}: ${spec.sections.length} sections, ${spec.questions.length} questions, ${spec.source.files} files, ${spec.source.lines} lines of code`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
