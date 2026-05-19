import { isDatabaseEnabled, query } from './db.js';

const usersById = new Map();
const usersByEmail = new Map();

function toIsoString(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapUserRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    color: row.color,
    passwordHash: row.password_hash,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export function getUserStorageMode() {
  return isDatabaseEnabled() ? 'postgres' : 'memory';
}

export async function findUserById(id) {
  if (!isDatabaseEnabled()) {
    return usersById.get(id) || null;
  }

  const result = await query(
    `SELECT id, email, name, color, password_hash, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [id],
  );

  return mapUserRow(result.rows[0]);
}

export async function findUserByEmail(email) {
  if (!isDatabaseEnabled()) {
    return usersByEmail.get(email) || null;
  }

  const result = await query(
    `SELECT id, email, name, color, password_hash, created_at, updated_at
     FROM users
     WHERE email = $1`,
    [email],
  );

  return mapUserRow(result.rows[0]);
}

export async function createUser(user) {
  if (!isDatabaseEnabled()) {
    usersById.set(user.id, user);
    usersByEmail.set(user.email, user);
    return user;
  }

  const result = await query(
    `INSERT INTO users (id, email, name, color, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, email, name, color, password_hash, created_at, updated_at`,
    [
      user.id,
      user.email,
      user.name,
      user.color,
      user.passwordHash,
      user.createdAt,
      user.updatedAt,
    ],
  );

  return mapUserRow(result.rows[0]);
}
