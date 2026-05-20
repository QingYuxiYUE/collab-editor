import { WebSocketServer } from 'ws';
import http from 'http';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import {
  AuthError,
  createAuthToken,
  getBearerToken,
  inspectAuthToken,
  loginUser,
  registerUser,
  verifyAuthToken,
} from './auth.js';
import {
  appendDocumentUpdate,
  canEditRole,
  canShareRole,
  createDocumentForUser,
  getDocumentAccess,
  getDocumentStorageMode,
  listDocumentMembers,
  listDocumentsForUser,
  loadDocumentState,
  setDocumentMemberRole,
  updateDocumentTitleForUser,
} from './documentRepository.js';
import { checkDatabaseHealth } from './db.js';
import { findUserByEmail, getUserStorageMode } from './userRepository.js';

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

// Message types
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const JSON_BODY_LIMIT = 1024 * 1024;
const WS_OPEN = 1;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > JSON_BODY_LIMIT) {
      throw new AuthError('请求体过大', 413, 'payload_too_large');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AuthError('请求体必须是有效的 JSON', 400, 'invalid_json');
  }
}

async function handleAuthRequest(req, res, pathname) {
  try {
    if (req.method === 'POST' && pathname === '/api/auth/register') {
      const user = await registerUser(await readJsonBody(req));
      sendJson(res, 201, { user, token: createAuthToken(user) });
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const user = await loginUser(await readJsonBody(req));
      sendJson(res, 200, { user, token: createAuthToken(user) });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/auth/me') {
      const user = await verifyAuthToken(getBearerToken(req));
      if (!user) throw new AuthError('登录已失效，请重新登录', 401, 'unauthorized');
      sendJson(res, 200, { user });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/auth/debug-token') {
      const result = await inspectAuthToken(getBearerToken(req));
      sendJson(res, result?.ok ? 200 : 401, {
        ok: Boolean(result?.ok),
        reason: result?.reason || 'missing_token',
        user: result?.user
          ? {
              id: result.user.id,
              email: result.user.email,
              name: result.user.name,
            }
          : null,
        payload: result?.payload
          ? {
              sub: result.payload.sub,
              email: result.payload.email,
              exp: result.payload.exp,
            }
          : null,
      });
      return true;
    }

    sendJson(res, 404, { error: '认证接口不存在', code: 'not_found' });
    return true;
  } catch (err) {
    if (err instanceof AuthError) {
      sendJson(res, err.statusCode, { error: err.message, code: err.code });
      return true;
    }

    console.error('Auth route error:', err);
    sendJson(res, 500, { error: '认证服务暂时不可用', code: 'internal_error' });
    return true;
  }
}

async function authenticateRequest(req) {
  const user = await verifyAuthToken(getBearerToken(req));
  if (!user) throw new AuthError('登录已失效，请重新登录', 401, 'unauthorized');
  return user;
}

function readDocumentTitle(input) {
  const title = String(input?.title || '').trim();

  if (!title) {
    throw new AuthError('文档标题不能为空', 400, 'invalid_title');
  }
  if (title.length > 80) {
    throw new AuthError('文档标题不能超过 80 个字符', 400, 'invalid_title');
  }

  return title;
}

function readMemberShareInput(input) {
  const email = String(input?.email || '').trim().toLowerCase();
  const role = String(input?.role || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError('请输入要共享用户的有效邮箱', 400, 'invalid_email');
  }
  if (!canShareRole(role)) {
    throw new AuthError('共享权限只能是可编辑或只读', 400, 'invalid_role');
  }

  return { email, role };
}

async function handleDocumentRequest(req, res, pathname) {
  try {
    const user = await authenticateRequest(req);

    if (req.method === 'GET' && pathname === '/api/documents') {
      sendJson(res, 200, { documents: await listDocumentsForUser(user.id) });
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/documents') {
      const document = await createDocumentForUser(user, await readJsonBody(req));
      sendJson(res, 201, { document });
      return true;
    }

    const membersMatch = pathname.match(/^\/api\/documents\/([^/]+)\/members$/);
    if (membersMatch) {
      const documentId = decodeURIComponent(membersMatch[1]);
      const document = await getDocumentAccess(documentId, user.id);
      if (!document) throw new AuthError('没有访问这个文档的权限', 403, 'forbidden');
      if (document.role !== 'owner') {
        throw new AuthError('只有文档所有者可以管理共享成员', 403, 'forbidden');
      }

      if (req.method === 'GET') {
        sendJson(res, 200, { members: await listDocumentMembers(documentId) });
        return true;
      }

      if (req.method === 'POST') {
        const { email, role } = readMemberShareInput(await readJsonBody(req));
        const targetUser = await findUserByEmail(email);
        if (!targetUser) {
          throw new AuthError('这个邮箱还没有注册账号', 404, 'user_not_found');
        }
        if (targetUser.id === user.id || targetUser.id === document.ownerId) {
          throw new AuthError('所有者已经拥有完整权限', 400, 'owner_role_locked');
        }

        const member = await setDocumentMemberRole(documentId, targetUser, role);
        sendJson(res, 200, { member });
        return true;
      }
    }

    const documentMatch = pathname.match(/^\/api\/documents\/([^/]+)$/);
    if (req.method === 'GET' && documentMatch) {
      const document = await getDocumentAccess(decodeURIComponent(documentMatch[1]), user.id);
      if (!document) throw new AuthError('没有访问这个文档的权限', 403, 'forbidden');
      sendJson(res, 200, { document });
      return true;
    }

    if (req.method === 'PATCH' && documentMatch) {
      const documentId = decodeURIComponent(documentMatch[1]);
      const access = await getDocumentAccess(documentId, user.id);
      if (!access) throw new AuthError('没有访问这个文档的权限', 403, 'forbidden');
      if (!canEditRole(access.role)) {
        throw new AuthError('只读用户不能修改文档标题', 403, 'read_only');
      }

      const document = await updateDocumentTitleForUser(
        documentId,
        user.id,
        readDocumentTitle(await readJsonBody(req)),
      );
      sendJson(res, 200, { document });
      return true;
    }

    sendJson(res, 404, { error: '文档接口不存在', code: 'not_found' });
    return true;
  } catch (err) {
    if (err instanceof AuthError) {
      sendJson(res, err.statusCode, { error: err.message, code: err.code });
      return true;
    }

    console.error('Document route error:', err);
    sendJson(res, 500, { error: '文档服务暂时不可用', code: 'internal_error' });
    return true;
  }
}

/**
 * In-memory document store
 * Each doc has: ydoc (Y.Doc), awareness (awarenessProtocol.Awareness), conns (Set<WebSocket>)
 */
const docs = new Map();
const docLoads = new Map();

function createSyncUpdateMessage(update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

async function createDoc(docName) {
  const ydoc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(ydoc);
  const persistedState = await loadDocumentState(docName);

  if (persistedState.snapshot) {
    Y.applyUpdate(ydoc, persistedState.snapshot, 'database-load');
  }

  for (const update of persistedState.updates) {
    Y.applyUpdate(ydoc, update, 'database-load');
  }

  const doc = { ydoc, awareness, conns: new Set() };

  // Listen for awareness changes and broadcast
  awareness.on('update', ({ added, updated, removed }, conn) => {
    if (conn && typeof conn === 'object' && conn.awarenessClientIds instanceof Set) {
      for (const clientId of added.concat(updated)) {
        conn.awarenessClientIds.add(clientId);
      }
      for (const clientId of removed) {
        conn.awarenessClientIds.delete(clientId);
      }
    }

    const changedClients = added.concat(updated, removed);
    const doc = docs.get(docName);
    if (!doc) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients),
    );
    const message = encoding.toUint8Array(encoder);

    for (const ws of doc.conns) {
      if (ws.readyState === WS_OPEN) {
        ws.send(message);
      }
    }
  });

  ydoc.on('update', (update, origin) => {
    const originInfo = typeof origin === 'object' && origin !== null ? origin : {};
    const sourceWs = originInfo.ws || null;
    const actorId = originInfo.userId || null;

    appendDocumentUpdate(docName, actorId, update).catch((err) => {
      console.error(`Failed to persist update for "${docName}":`, err);
    });

    const message = createSyncUpdateMessage(update);

    for (const conn of doc.conns) {
      if (conn !== sourceWs && conn.readyState === WS_OPEN) {
        conn.send(message);
      }
    }
  });

  docs.set(docName, doc);
  console.log(`📄 Created document: ${docName} (${persistedState.updates.length} updates loaded)`);
  return doc;
}

async function getOrCreateDoc(docName) {
  const existingDoc = docs.get(docName);
  if (existingDoc) {
    return existingDoc;
  }

  const existingLoad = docLoads.get(docName);
  if (existingLoad) {
    return existingLoad;
  }

  const load = createDoc(docName).finally(() => {
    docLoads.delete(docName);
  });

  docLoads.set(docName, load);
  return load;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/api/auth/')) {
    if (await handleAuthRequest(req, res, url.pathname)) return;
  }

  if (url.pathname.startsWith('/api/documents')) {
    if (await handleDocumentRequest(req, res, url.pathname)) return;
  }

  if (url.pathname === '/health') {
    const database = await checkDatabaseHealth();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        database,
        storage: {
          users: getUserStorageMode(),
          documents: getDocumentStorageMode(),
        },
        documents: docs.size,
        connections: Array.from(docs.values()).reduce((sum, d) => sum + d.conns.size, 0),
        timestamp: Date.now(),
      }),
    );
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Collaborative Editor - WebSocket Server');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  handleConnection(ws, req).catch((err) => {
    console.error('WebSocket connection failed:', err);
    if (ws.readyState === WS_OPEN) {
      ws.close(1011, 'Internal server error');
    }
  });
});

async function handleConnection(ws, req) {
  ws.awarenessClientIds = new Set();

  const pendingMessages = [];
  const queueMessage = (data) => {
    pendingMessages.push(data);
  };
  ws.on('message', queueMessage);

  const url = new URL(req.url || '/', `ws://${req.headers.host || 'localhost'}`);
  const user = await verifyAuthToken(url.searchParams.get('token'));

  if (!user) {
    ws.off('message', queueMessage);
    console.warn(`⚠️  Rejected WebSocket connection for "${url.pathname}": invalid token`);
    ws.close(1008, 'Unauthorized');
    return;
  }

  const docName = decodeURIComponent(url.pathname.slice(1)) || 'default';
  const documentAccess = await getDocumentAccess(docName, user.id);
  if (!documentAccess) {
    ws.off('message', queueMessage);
    console.warn(`⚠️  Rejected WebSocket connection for "${docName}": no document access`);
    ws.close(1008, 'Forbidden');
    return;
  }

  const canEdit = canEditRole(documentAccess.role);
  const doc = await getOrCreateDoc(docName);
  if (ws.readyState !== WS_OPEN) {
    ws.off('message', queueMessage);
    return;
  }

  doc.conns.add(ws);

  console.log(
    `🔗 ${user.email} connected to "${docName}" as ${documentAccess.role} (${doc.conns.size} total)`,
  );

  const handleMessage = (data) => {
    try {
      const message = new Uint8Array(data);
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MSG_SYNC: {
          const syncTypeDecoder = decoding.createDecoder(message);
          decoding.readVarUint(syncTypeDecoder);
          const syncMessageType = decoding.readVarUint(syncTypeDecoder);

          if (!canEdit && syncMessageType !== syncProtocol.messageYjsSyncStep1) {
            console.warn(`⚠️  Ignored read-only sync update from ${user.email} for "${docName}"`);
            break;
          }

          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, doc.ydoc, {
            ws,
            userId: user.id,
          });

          // If there's a reply (sync step 2), send it back
          if (encoding.length(encoder) > 1) {
            ws.send(encoding.toUint8Array(encoder));
          }

          // Broadcast update to other clients
          // The document-level ydoc 'update' handler takes care of this
          break;
        }
        case MSG_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(doc.awareness, update, ws);
          break;
        }
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  };

  ws.off('message', queueMessage);
  ws.on('message', handleMessage);

  for (const data of pendingMessages) {
    handleMessage(data);
  }

  // Send sync step 1 to new client after replaying early client messages.
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc.ydoc);
    ws.send(encoding.toUint8Array(encoder));
  }

  // Send current awareness state
  {
    const states = doc.awareness.getStates();
    if (states.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(states.keys())),
      );
      ws.send(encoding.toUint8Array(encoder));
    }
  }

  ws.on('close', () => {
    doc.conns.delete(ws);

    // Remove awareness state for disconnected client
    const awarenessClientIds = Array.from(ws.awarenessClientIds);
    if (awarenessClientIds.length > 0) {
      awarenessProtocol.removeAwarenessStates(doc.awareness, awarenessClientIds, null);
      ws.awarenessClientIds.clear();
    }

    console.log(`❌ Client disconnected from "${docName}" (${doc.conns.size} remaining)`);

    // Clean up empty documents after 30s
    if (doc.conns.size === 0) {
      setTimeout(() => {
        const d = docs.get(docName);
        if (d && d.conns.size === 0) {
          d.ydoc.destroy();
          docs.delete(docName);
          console.log(`🗑️  Cleaned up document: ${docName}`);
        }
      }, 30000);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
}

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Collaborative editing server running on ws://${HOST}:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`\n💡 Features:`);
  console.log(`   ✅ Yjs document sync (CRDT)`);
  console.log(`   ✅ ${getDocumentStorageMode()} document persistence`);
  console.log(`   ✅ Awareness protocol (cursors, presence)`);
  console.log(`   ✅ Auto cleanup for empty documents\n`);
});
