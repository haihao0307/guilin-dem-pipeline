import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.dirname(base);
const corePath = path.join(base, 'src/production-knowledge-r09.js');
const cardsPath = path.join(base, 'data/production-cards-r09.json');
const require = createRequire(import.meta.url);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const usage = `Fish production stage R09
  --fish ID --stage identity|surface|spine|fins|cranial|behavior|verify
  --card PATH --stage STAGE
  --create ID [--label TEXT] [--out PATH]
  --list
  Aliases: source -> identity; cranial sub-stages: eyes, mouth, gills.
  JSON is printed; files are written only with --out and never overwritten.
  Exit codes: 0 ready/template/list, 2 invalid request/card, 3 local stage HOLD.
  readyToBuild is readiness for work, not acceptance or biological calibration.
`;

function parse(argv) {
  const result = {};
  const values = new Set(['--fish', '--stage', '--card', '--create', '--out', '--label']);
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '--list') {
      if (result[token.slice(2)]) throw new Error(`Duplicate option ${token}`);
      result[token.slice(2)] = true;
    } else if (values.has(token)) {
      const key = token.slice(2);
      if (Object.hasOwn(result, key)) throw new Error(`Duplicate option ${token}`);
      const next = argv[++i];
      if (!next || next.startsWith('--')) throw new Error(`Missing value for ${token}`);
      result[key] = next;
    } else throw new Error(`Unknown option ${token}`);
  }
  return result;
}

function emit(value, out) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (out) fs.writeFileSync(path.resolve(out), body, { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(body);
}

function validateEvidenceBindings(card) {
  const errors = [];
  const verified = [];
  if (!Array.isArray(card.evidenceBindings)) {
    const referenced = Object.values(card.measurements || {}).some(item => ['SOURCE_MEASURED', 'SOURCE_DERIVED', 'CONFIRMED_ABSENT'].includes(item.status));
    if (referenced || card.source?.entrySha256 || card.source?.payloadSha256) errors.push('EVIDENCE_BINDINGS_REQUIRED');
    return { valid: errors.length === 0, errors, verified };
  }
  const realRepo = fs.realpathSync(repo);
  const withinRepo = target => {
    const relative = path.relative(realRepo, target);
    return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
  };
  for (const binding of card.evidenceBindings) {
    try {
      if (typeof binding.path !== 'string' || path.isAbsolute(binding.path) || binding.path.split(/[\\/]/).includes('..') || !/^[a-f0-9]{64}$/.test(binding.sha256 || '')) throw new Error('INVALID_BINDING');
      const target = path.resolve(repo, binding.path);
      if (!withinRepo(target)) throw new Error('BINDING_OUTSIDE_REPOSITORY');
      const actual = fs.realpathSync(target);
      if (!withinRepo(actual) || !fs.statSync(actual).isFile()) throw new Error('BINDING_OUTSIDE_REPOSITORY');
      const hash = crypto.createHash('sha256');
      const buffer = Buffer.allocUnsafe(64 * 1024);
      const descriptor = fs.openSync(actual, 'r');
      try { let size; while ((size = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, size)); }
      finally { fs.closeSync(descriptor); }
      if (hash.digest('hex') !== binding.sha256) throw new Error('HASH_MISMATCH');
      verified.push(binding.path);
    } catch (error) { errors.push({ code: 'STALE_SOURCE_EVIDENCE', path: binding.path || null, reason: error.message }); }
  }
  return { valid: errors.length === 0, errors, verified };
}

try {
  const options = parse(process.argv.slice(2));
  if (options.help) {
    if (Object.keys(options).length !== 1) throw new Error('--help cannot be combined with other options');
    process.stdout.write(usage);
  } else {
    const modes = ['fish', 'card', 'create', 'list'].filter(key => Object.hasOwn(options, key));
    if (modes.length !== 1) throw new Error('Choose exactly one of --fish, --card, --create, or --list');
    if (options.label && !options.create) throw new Error('--label is supported only with --create');
    if ((options.create || options.list) && options.stage) throw new Error('--stage is supported only with --fish or --card');
    if ((options.fish || options.card) && !options.stage) throw new Error('--stage is required for stage evaluation');
    const K = require(corePath);
    if (options.create) {
      if (!/^[a-z][a-z0-9-]{0,79}$/.test(options.create)) throw new Error('Fish ID must start with a lowercase letter and contain lowercase letters, digits or hyphens (max 80 characters)');
      emit(K.createTemplate(options.create, options.label || options.create), options.out);
    } else if (options.list) {
      const data = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
      emit({ schema: 'fish.production-stage-list/1', version: K.version,
        stages: K.stages,
        cranialSubStages: ['eyes', 'mouth', 'gills'],
        fish: data.cards.map(card => ({ id: card.id, label: card.label })) }, options.out);
    } else {
      const dataBytes = fs.readFileSync(options.card ? path.resolve(options.card) : cardsPath);
      const data = JSON.parse(dataBytes.toString('utf8'));
      const card = options.card ? data : data.cards.find(item => item.id === options.fish);
      if (!card) throw new Error(`Unknown fish ${options.fish}; use --list or --create`);
      const validation = K.validateCard(card);
      if (!validation.valid) {
        emit({ schema: 'fish.production-stage-error/1', code: 'INVALID_CARD', errors: validation.errors,
          warnings: validation.warnings || [], readyToBuild: false, acceptanceState: 'NOT_EVALUATED' }, options.out);
        process.exitCode = 2;
      } else {
        const evidenceValidation = validateEvidenceBindings(card);
        if (!evidenceValidation.valid) {
          emit({ schema: 'fish.production-stage-error/1', code: 'STALE_SOURCE_EVIDENCE',
            errors: evidenceValidation.errors, readyToBuild: false, acceptanceState: 'NOT_EVALUATED' }, options.out);
          process.exitCode = 2;
        } else {
          const context = K.resolve(card, options.stage === 'source' ? 'identity' : options.stage);
          if (typeof context.readyToBuild !== 'boolean') throw new Error('Knowledge core returned no explicit stage readiness');
          emit({ schema: 'fish.production-stage-context/1', ...context,
            validation,
            evidenceValidation,
            knowledgeBinding: {
              knowledgeVersion: K.version,
              coreSha256: digest(fs.readFileSync(corePath)),
              cardSha256: digest(JSON.stringify(card)),
              inputSha256: digest(dataBytes),
              requestedStage: options.stage
            }
          }, options.out);
          if (!context.readyToBuild) process.exitCode = 3;
        }
      }
    }
  }
} catch (error) {
  process.stdout.write(`${JSON.stringify({ schema: 'fish.production-stage-error/1', code: 'INVALID_REQUEST',
    message: error.message, readyToBuild: false, acceptanceState: 'NOT_EVALUATED' }, null, 2)}\n`);
  process.exitCode = 2;
}
