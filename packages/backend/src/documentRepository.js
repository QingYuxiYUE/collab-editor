import { randomUUID } from 'crypto';
import { isDatabaseEnabled, query, withTransaction } from './db.js';
import { findUserById } from './userRepository.js';

const documentsById = new Map();
const membersByDocumentId = new Map();

function toIsoString(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function normalizeTitle(title) {
  const normalized = String(title || '').trim();
  return normalized || 'Untitled';
}

function mapDocumentRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    ownerId: row.owner_id,
    role: row.role,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapMemberRow(row) {
  if (!row) return null;

  return {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    color: row.color,
    role: row.role,
    createdAt: toIsoString(row.created_at),
  };
}

function getMemoryMembers(documentId) {
  let members = membersByDocumentId.get(documentId);
  if (!members) {
    members = new Map();
    membersByDocumentId.set(documentId, members);
  }
  return members;
}

export function getDocumentStorageMode() {
  return isDatabaseEnabled() ? 'postgres' : 'memory';
}

export function canEditRole(role) {
  return role === 'owner' || role === 'editor';
}

export function canShareRole(role) {
  return role === 'editor' || role === 'viewer';
}

export async function createDocumentForUser(user, input = {}) {
  const now = new Date().toISOString();
  const document = {
    id: randomUUID(),
    title: normalizeTitle(input.title),
    ownerId: user.id,
    role: 'owner',
    createdAt: now,
    updatedAt: now,
  };

  if (!isDatabaseEnabled()) {
    documentsById.set(document.id, document);
    getMemoryMembers(document.id).set(user.id, 'owner');
    return document;
  }

  return withTransaction(async (client) => {
    const documentResult = await client.query(
      `INSERT INTO documents (id, title, owner_id)
       VALUES ($1, $2, $3)
       RETURNING id, title, owner_id, created_at, updated_at`,
      [document.id, document.title, user.id],
    );

    await client.query(
      `INSERT INTO document_members (document_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [document.id, user.id],
    );

    return mapDocumentRow({ ...documentResult.rows[0], role: 'owner' });
  });
}

export async function listDocumentsForUser(userId) {
  if (!isDatabaseEnabled()) {
    return Array.from(documentsById.values())
      .filter((document) => membersByDocumentId.get(document.id)?.has(userId))
      .map((document) => ({
        ...document,
        role: membersByDocumentId.get(document.id).get(userId),
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const result = await query(
    `SELECT d.id, d.title, d.owner_id, d.created_at, d.updated_at, dm.role
     FROM documents d
     JOIN document_members dm ON dm.document_id = d.id
     WHERE dm.user_id = $1
     ORDER BY d.updated_at DESC, d.created_at DESC`,
    [userId],
  );

  return result.rows.map(mapDocumentRow);
}

export async function getDocumentAccess(documentId, userId) {
  if (!isDatabaseEnabled()) {
    const document = documentsById.get(documentId);
    const role = membersByDocumentId.get(documentId)?.get(userId);
    return document && role ? { ...document, role } : null;
  }

  const result = await query(
    `SELECT d.id, d.title, d.owner_id, d.created_at, d.updated_at, dm.role
     FROM documents d
     JOIN document_members dm ON dm.document_id = d.id
     WHERE d.id = $1 AND dm.user_id = $2`,
    [documentId, userId],
  );

  return mapDocumentRow(result.rows[0]);
}

export async function updateDocumentTitleForUser(documentId, userId, title) {
  const normalizedTitle = normalizeTitle(title);

  if (!isDatabaseEnabled()) {
    const document = documentsById.get(documentId);
    const role = membersByDocumentId.get(documentId)?.get(userId);
    if (!document || !canEditRole(role)) return null;

    const updatedDocument = {
      ...document,
      title: normalizedTitle,
      updatedAt: new Date().toISOString(),
    };
    documentsById.set(documentId, updatedDocument);
    return { ...updatedDocument, role };
  }

  const result = await query(
    `UPDATE documents d
     SET title = $3, updated_at = now()
     WHERE d.id = $1
       AND EXISTS (
         SELECT 1
         FROM document_members dm
         WHERE dm.document_id = d.id
           AND dm.user_id = $2
           AND dm.role IN ('owner', 'editor')
       )
     RETURNING d.id, d.title, d.owner_id, d.created_at, d.updated_at,
       (
         SELECT role
         FROM document_members
         WHERE document_id = d.id AND user_id = $2
       ) AS role`,
    [documentId, userId, normalizedTitle],
  );

  return mapDocumentRow(result.rows[0]);
}

export async function listDocumentMembers(documentId) {
  if (!isDatabaseEnabled()) {
    const members = membersByDocumentId.get(documentId);
    if (!members) return [];

    const document = documentsById.get(documentId);
    const rows = await Promise.all(
      Array.from(members.entries()).map(async ([userId, role]) => {
        const user = await findUserById(userId);
        if (!user) return null;

        return {
          user_id: user.id,
          email: user.email,
          name: user.name,
          color: user.color,
          role,
          created_at: document?.createdAt,
        };
      }),
    );

    return rows.filter(Boolean).map(mapMemberRow);
  }

  const result = await query(
    `SELECT dm.user_id, u.email, u.name, u.color, dm.role, dm.created_at
     FROM document_members dm
     JOIN users u ON u.id = dm.user_id
     WHERE dm.document_id = $1
     ORDER BY
       CASE dm.role
         WHEN 'owner' THEN 0
         WHEN 'editor' THEN 1
         ELSE 2
       END,
       dm.created_at ASC`,
    [documentId],
  );

  return result.rows.map(mapMemberRow);
}

export async function setDocumentMemberRole(documentId, user, role) {
  if (!isDatabaseEnabled()) {
    if (!documentsById.has(documentId)) return null;

    getMemoryMembers(documentId).set(user.id, role);
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      color: user.color,
      role,
      createdAt: new Date().toISOString(),
    };
  }

  const result = await query(
    `WITH upserted AS (
       INSERT INTO document_members (document_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (document_id, user_id)
       DO UPDATE SET role = EXCLUDED.role
       RETURNING user_id, role, created_at
     )
     SELECT upserted.user_id, u.email, u.name, u.color, upserted.role, upserted.created_at
     FROM upserted
     JOIN users u ON u.id = upserted.user_id`,
    [documentId, user.id, role],
  );

  return mapMemberRow(result.rows[0]);
}

export async function loadDocumentState(documentId) {
  if (!isDatabaseEnabled()) {
    return { snapshot: null, updates: [] };
  }

  const snapshotResult = await query(
    `SELECT state, update_id
     FROM document_snapshots
     WHERE document_id = $1
     ORDER BY id DESC
     LIMIT 1`,
    [documentId],
  );
  const snapshot = snapshotResult.rows[0] || null;

  const updatesResult = await query(
    `SELECT update_data
     FROM document_updates
     WHERE document_id = $1
       AND ($2::bigint IS NULL OR id > $2)
     ORDER BY id ASC`,
    [documentId, snapshot?.update_id || null],
  );

  return {
    snapshot: snapshot ? new Uint8Array(snapshot.state) : null,
    updates: updatesResult.rows.map((row) => new Uint8Array(row.update_data)),
  };
}

export async function appendDocumentUpdate(documentId, actorId, update) {
  if (!isDatabaseEnabled()) return;

  await query(
    `INSERT INTO document_updates (document_id, actor_id, update_data)
     VALUES ($1, $2, $3)`,
    [documentId, actorId, Buffer.from(update)],
  );
}
