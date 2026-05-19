import { readFileSync } from 'fs';

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

try {
  const source = readFileSync(new URL('../.env', import.meta.url), 'utf8');

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = stripQuotes(trimmed.slice(separator + 1).trim());

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
} catch (err) {
  if (err.code !== 'ENOENT') {
    console.warn('Failed to load backend .env file:', err);
  }
}
