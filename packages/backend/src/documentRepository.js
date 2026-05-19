import { isDatabaseEnabled, query, withTransaction } from './db.js';

export function getDocumentStorageMode() {
  return isDatabaseEnabled() ? 'postgres' : 'memory';
}

export async function ensureDocumentForUser(documentId, user) {
  if (!isDatabaseEnabled()) return;

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO documents (id, title, owner_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [documentId, documentId, user.id],
    );

    await client.query(
      `INSERT INTO document_members (document_id, user_id, role)
       SELECT $1, $2, CASE WHEN owner_id = $2 THEN 'owner' ELSE 'editor' END
       FROM documents
       WHERE id = $1
       ON CONFLICT (document_id, user_id) DO NOTHING`,
      [documentId, user.id],
    );
  });
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
