import './env.js';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';
import { createUser, findUserByEmail, findUserById } from './userRepository.js';

const scrypt = promisify(scryptCallback);

const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7);
const AUTH_SECRET = process.env.AUTH_SECRET || 'collab-editor-dev-secret';

const USER_COLORS = [
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#22c55e',
  '#3b82f6',
  '#f97316',
  '#06b6d4',
];

export class AuthError extends Error {
  constructor(message, statusCode = 400, code = 'auth_error') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function pickUserColor(email) {
  const digest = createHash('sha256').update(email).digest();
  return USER_COLORS[digest[0] % USER_COLORS.length];
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    color: user.color,
    createdAt: user.createdAt,
  };
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, passwordHash) {
  const [algorithm, salt, key] = passwordHash.split(':');
  if (algorithm !== 'scrypt' || !salt || !key) return false;

  const expected = Buffer.from(key, 'hex');
  const actual = await scrypt(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function encodePart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodePart(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function sign(value) {
  return createHmac('sha256', AUTH_SECRET).update(value).digest('base64url');
}

export function createAuthToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodePart({ alg: 'HS256', typ: 'JWT' });
  const payload = encodePart({
    sub: user.id,
    email: user.email,
    name: user.name,
    color: user.color,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  });
  const body = `${header}.${payload}`;
  return `${body}.${sign(body)}`;
}

export async function verifyAuthToken(token) {
  const result = await inspectAuthToken(token);
  return result.ok && result.user ? toPublicUser(result.user) : null;
}

export async function inspectAuthToken(token) {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing_token', user: null, payload: null };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'malformed_token', user: null, payload: null };
  }

  const [header, payload, signature] = parts;
  const body = `${header}.${payload}`;
  const expected = Buffer.from(sign(body), 'base64url');
  const actual = Buffer.from(signature, 'base64url');

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: 'invalid_signature', user: null, payload: null };
  }

  let decoded;
  try {
    decoded = decodePart(payload);
  } catch {
    return { ok: false, reason: 'invalid_payload', user: null, payload: null };
  }

  if (!decoded.sub) {
    return { ok: false, reason: 'missing_subject', user: null, payload: decoded };
  }
  if (decoded.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: 'expired_token', user: null, payload: decoded };
  }

  const user = await findUserById(decoded.sub);
  if (!user) {
    return { ok: false, reason: 'user_not_found', user: null, payload: decoded };
  }

  return { ok: true, reason: 'ok', user, payload: decoded };
}

export async function registerUser({ email, name, password }) {
  const normalizedEmail = normalizeEmail(email);
  const displayName = String(name || '').trim();
  const rawPassword = String(password || '');

  if (!validateEmail(normalizedEmail)) {
    throw new AuthError('请输入有效的邮箱地址', 400, 'invalid_email');
  }
  if (displayName.length < 2 || displayName.length > 24) {
    throw new AuthError('昵称长度需要在 2 到 24 个字符之间', 400, 'invalid_name');
  }
  if (rawPassword.length < 8) {
    throw new AuthError('密码至少需要 8 个字符', 400, 'weak_password');
  }
  if (await findUserByEmail(normalizedEmail)) {
    throw new AuthError('这个邮箱已经注册过了', 409, 'email_exists');
  }

  const now = new Date().toISOString();
  const user = await createUser({
    id: randomUUID(),
    email: normalizedEmail,
    name: displayName,
    color: pickUserColor(normalizedEmail),
    passwordHash: await hashPassword(rawPassword),
    createdAt: now,
    updatedAt: now,
  }).catch((err) => {
    if (err?.code === '23505') {
      throw new AuthError('这个邮箱已经注册过了', 409, 'email_exists');
    }
    throw err;
  });

  return toPublicUser(user);
}

export async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const rawPassword = String(password || '');
  const user = await findUserByEmail(normalizedEmail);

  if (!user || !(await verifyPassword(rawPassword, user.passwordHash))) {
    throw new AuthError('邮箱或密码不正确', 401, 'invalid_credentials');
  }

  return toPublicUser(user);
}

export function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}
