import { WebSocketServer } from 'ws';
import http from 'http';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

// Message types
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

/**
 * In-memory document store
 * Each doc has: ydoc (Y.Doc), awareness (awarenessProtocol.Awareness), conns (Set<WebSocket>)
 */
const docs = new Map();

function getOrCreateDoc(docName) {
  if (docs.has(docName)) return docs.get(docName);

  const ydoc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(ydoc);

  // Listen for awareness changes and broadcast
  awareness.on('update', ({ added, updated, removed }, conn) => {
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
      if (ws.readyState === 1) {
        ws.send(message);
      }
    }
  });

  const doc = { ydoc, awareness, conns: new Set() };
  docs.set(docName, doc);
  console.log(`📄 Created document: ${docName}`);
  return doc;
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
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
  const docName = req.url?.slice(1)?.split('?')[0] || 'default';
  const doc = getOrCreateDoc(docName);
  doc.conns.add(ws);

  console.log(`🔗 Client connected to "${docName}" (${doc.conns.size} total)`);

  // Send sync step 1 to new client
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

  ws.on('message', (data) => {
    try {
      const message = new Uint8Array(data);
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MSG_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, doc.ydoc, null);

          // If there's a reply (sync step 2), send it back
          if (encoding.length(encoder) > 1) {
            ws.send(encoding.toUint8Array(encoder));
          }

          // Broadcast update to other clients
          // The ydoc 'update' handler below takes care of this
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
  });

  // When ydoc updates, broadcast to all connected clients
  const onUpdate = (update, origin) => {
    if (origin === ws) return; // Don't echo back

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const conn of doc.conns) {
      if (conn !== ws && conn.readyState === 1) {
        conn.send(message);
      }
    }
  };
  doc.ydoc.on('update', onUpdate);

  ws.on('close', () => {
    doc.conns.delete(ws);
    doc.ydoc.off('update', onUpdate);

    // Remove awareness state for disconnected client
    awarenessProtocol.removeAwarenessStates(doc.awareness, [doc.ydoc.clientID], null);

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
});

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Collaborative editing server running on ws://${HOST}:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`\n💡 Features:`);
  console.log(`   ✅ Yjs document sync (CRDT)`);
  console.log(`   ✅ Awareness protocol (cursors, presence)`);
  console.log(`   ✅ Auto cleanup for empty documents\n`);
});
