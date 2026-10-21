import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = resolve(projectRoot, 'frontend');
const input = resolve(frontendRoot, 'coverage', 'lcov.info');
const artifacts = resolve(projectRoot, 'artifacts');
const coverage = readFileSync(input, 'utf8');
const normalized = coverage.split(/\r?\n/u).map((line) => {
  if (!line.startsWith('SF:')) return line;
  const source = resolve(frontendRoot, line.slice(3).replaceAll('\\', '/'));
  const relativeSource = relative(projectRoot, source);
  if (relativeSource.startsWith(`..${sep}`) || !existsSync(source)) {
    throw new Error(`LCOV references an invalid source path: ${line.slice(3)}`);
  }
  return `SF:${relativeSource.replaceAll('\\', '/')}`;
}).join('\n');
mkdirSync(artifacts, { recursive: true });
writeFileSync(resolve(artifacts, 'frontend-lcov.info'), normalized, 'utf8');
console.log('Prepared artifacts/frontend-lcov.info without changing coverage counts.');
