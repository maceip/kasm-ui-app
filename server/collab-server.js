// ============================================================
// Collaborative Editing Server - WebSocket-based OT server
// Uses the `ws` package. Listens on port 4000.
// ============================================================

const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('crypto');

// ========================
// === Document Storage ===
// ========================

/** @type {Map<string, {version: number, snapshot: any, type: string, ops: Array<{op: any, version: number, clientId: string}>}>} */
const documents = new Map();

/**
 * Get or create a document.
 * @param {string} collection
 * @param {string} docId
 * @returns {{version: number, snapshot: any, type: string, ops: Array}}
 */
function getDocument(collection, docId) {
  const key = `${collection}:${docId}`;
  if (!documents.has(key)) {
    documents.set(key, {
      version: 0,
      snapshot: {},
      type: 'json0',
      ops: [], // history of applied ops for transform
    });
  }
  return documents.get(key);
}

// ========================
// === JSON OT (server) ===
// ========================

/**
 * Apply a json0-style op to a document snapshot.
 * Mirrors the client-side applyJsonOp.
 */
function applyJsonOp(doc, op) {
  const result = structuredClone(doc);
  const path = op.p;

  if (!path || path.length === 0) {
    if (op.oi !== undefined) return op.oi;
    return result;
  }

  // String ops
  if (op.si !== undefined || op.sd !== undefined) {
    if (path.length < 2) throw new Error('String ops require path of at least length 2');
    const parentPath = path.slice(0, -2);
    const stringKey = path[path.length - 2];
    const charPos = path[path.length - 1];

    let container = result;
    for (const seg of parentPath) {
      container = container[seg];
    }

    const str = String(container[stringKey]);
    if (op.si !== undefined) {
      container[stringKey] = str.slice(0, charPos) + op.si + str.slice(charPos);
    } else {
      container[stringKey] = str.slice(0, charPos) + str.slice(charPos + op.sd.length);
    }
    return result;
  }

  // Navigate to parent
  let current = result;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]];
  }
  const key = path[path.length - 1];

  if (op.oi !== undefined && op.od !== undefined) {
    current[key] = op.oi;
  } else if (op.oi !== undefined) {
    current[key] = op.oi;
  } else if (op.od !== undefined) {
    if (Array.isArray(current)) {
      current.splice(key, 1);
    } else {
      delete current[key];
    }
  } else if (op.li !== undefined && op.ld !== undefined) {
    current[key] = op.li;
  } else if (op.li !== undefined) {
    if (Array.isArray(current)) {
      current.splice(key, 0, op.li);
    }
  } else if (op.ld !== undefined) {
    if (Array.isArray(current)) {
      current.splice(key, 1);
    }
  } else if (op.na !== undefined) {
    current[key] = (current[key] ?? 0) + op.na;
  }

  return result;
}

// ============================
// === Server-side Transform ===
// ============================

/**
 * Transform op1 against op2 on the server (simplified but correct for common cases).
 * Returns transformed op1 or null if it becomes a no-op.
 */
function transformJsonOp(op1, op2, side = 'left') {
  const p1 = op1.p;
  const p2 = op2.p;

  if (!p1 || !p2) return op1;

  // Check path relationship
  const minLen = Math.min(p1.length, p2.length);
  let commonPrefix = 0;
  for (let i = 0; i < minLen; i++) {
    if (p1[i] === p2[i]) commonPrefix++;
    else break;
  }

  const samePath = commonPrefix === p1.length && commonPrefix === p2.length;
  const p2IsAncestor = commonPrefix === p2.length && p1.length > p2.length;

  // Numeric add is commutative
  if (op1.na !== undefined && op2.na !== undefined && samePath) {
    return op1;
  }

  // String ops on the same string
  if ((op1.si !== undefined || op1.sd !== undefined) &&
      (op2.si !== undefined || op2.sd !== undefined)) {
    if (p1.length >= 2 && p2.length >= 2) {
      const strKey1 = p1.slice(0, -1);
      const strKey2 = p2.slice(0, -1);
      const sameString = strKey1.length === strKey2.length &&
        strKey1.every((v, i) => v === strKey2[i]);

      if (sameString) {
        const pos1 = p1[p1.length - 1];
        const pos2 = p2[p2.length - 1];
        let newPos = pos1;

        if (op2.si !== undefined) {
          // op2 inserts text
          if (pos2 < pos1 || (pos2 === pos1 && side === 'right')) {
            newPos = pos1 + op2.si.length;
          }
        } else if (op2.sd !== undefined) {
          // op2 deletes text
          const delEnd = pos2 + op2.sd.length;
          if (pos2 < pos1) {
            if (delEnd <= pos1) {
              newPos = pos1 - op2.sd.length;
            } else {
              newPos = pos2; // inside deleted range
            }
          }
        }

        const newPath = [...p1.slice(0, -1), newPos];
        if (op1.si !== undefined) return { p: newPath, si: op1.si };
        if (op1.sd !== undefined) return { p: newPath, sd: op1.sd };
      }
    }
  }

  // List index shifting
  if (p1.length > 0 && p2.length > 0) {
    const parentLen = Math.min(p1.length, p2.length) - 1;

    if (parentLen >= 0 &&
        commonPrefix >= parentLen &&
        typeof p1[parentLen] === 'number' &&
        typeof p2[parentLen] === 'number') {

      const idx1 = p1[parentLen];
      const idx2 = p2[parentLen];

      // Same list, different indices
      if (p1.length >= parentLen + 1 && p2.length === parentLen + 1 && idx1 !== idx2) {
        let newIdx = idx1;

        if (op2.li !== undefined && op2.ld === undefined) {
          if (idx2 <= idx1) newIdx = idx1 + 1;
        } else if (op2.ld !== undefined && op2.li === undefined) {
          if (idx2 < idx1) newIdx = idx1 - 1;
          else if (idx2 === idx1 && p1.length > parentLen + 1) return null;
        }

        if (newIdx !== idx1) {
          const newPath = [...p1];
          newPath[parentLen] = newIdx;
          return { ...op1, p: newPath };
        }
      }

      // Same index, same depth
      if (idx1 === idx2 && p1.length === p2.length && p1.length === parentLen + 1) {
        if (op1.li !== undefined && op2.li !== undefined &&
            op1.ld === undefined && op2.ld === undefined) {
          if (side === 'left') return op1;
          return { ...op1, p: [...p1.slice(0, -1), idx1 + 1] };
        }

        if (op1.ld !== undefined && op2.ld !== undefined &&
            op1.li === undefined && op2.li === undefined) {
          return null; // already deleted
        }
      }
    }
  }

  // Object ops at the same path
  if (samePath) {
    if (op1.oi !== undefined && op2.oi !== undefined) {
      if (side === 'left') return { p: p1, oi: op1.oi, od: op2.oi };
      return null;
    }

    if (op1.od !== undefined && op2.od !== undefined &&
        op1.oi === undefined && op2.oi === undefined) {
      return null;
    }
  }

  // op2 deletes ancestor of op1's target
  if (p2IsAncestor) {
    if (op2.od !== undefined && op2.oi === undefined) return null;
    if (op2.ld !== undefined && op2.li === undefined) return null;
  }

  return op1;
}

// ========================
// === Client Tracking  ===
// ========================

/** @type {Map<WebSocket, {sessionId: string, clientId: string, subscriptions: Set<string>}>} */
const clients = new Map();

/** @type {Map<string, Set<WebSocket>>} */
const docSubscribers = new Map();

// ========================
// === WebSocket Server ===
// ========================

const PORT = parseInt(process.env.COLLAB_PORT || '4000', 10);

const wss = new WebSocketServer({ port: PORT }, () => {
  console.log(`[collab-server] Listening on ws://localhost:${PORT}`);
});

wss.on('connection', (ws) => {
  const sessionId = crypto.randomUUID();
  const clientInfo = {
    sessionId,
    clientId: '',
    subscriptions: new Set(),
  };
  clients.set(ws, clientInfo);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    handleMessage(ws, clientInfo, msg);
  });

  ws.on('close', () => {
    // Clean up subscriptions
    for (const key of clientInfo.subscriptions) {
      const subs = docSubscribers.get(key);
      if (subs) {
        subs.delete(ws);
        if (subs.size === 0) docSubscribers.delete(key);
      }
    }
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error(`[collab-server] WebSocket error for session ${sessionId}:`, err.message);
  });
});

/**
 * Handle an incoming message from a client.
 */
function handleMessage(ws, clientInfo, msg) {
  switch (msg.type) {
    case 'init': {
      clientInfo.clientId = msg.clientId || clientInfo.sessionId;
      ws.send(JSON.stringify({
        type: 'init',
        sessionId: clientInfo.sessionId,
        clientId: clientInfo.clientId,
      }));
      break;
    }

    case 'sub': {
      const { collection, docId } = msg;
      if (!collection || !docId) {
        ws.send(JSON.stringify({ type: 'error', error: 'Missing collection or docId' }));
        return;
      }

      const key = `${collection}:${docId}`;
      clientInfo.subscriptions.add(key);

      if (!docSubscribers.has(key)) {
        docSubscribers.set(key, new Set());
      }
      docSubscribers.get(key).add(ws);

      // Send current snapshot
      const doc = getDocument(collection, docId);
      ws.send(JSON.stringify({
        type: 'snapshot',
        collection,
        docId,
        snapshot: doc.snapshot,
        version: doc.version,
      }));
      break;
    }

    case 'op': {
      const { collection, docId, op, version } = msg;
      if (!collection || !docId || !op) {
        ws.send(JSON.stringify({ type: 'error', error: 'Missing collection, docId, or op' }));
        return;
      }

      const key = `${collection}:${docId}`;
      const doc = getDocument(collection, docId);

      // Validate version
      if (typeof version !== 'number' || version < 0 || version > doc.version) {
        ws.send(JSON.stringify({
          type: 'error',
          error: `Invalid version: client=${version}, server=${doc.version}`,
          collection,
          docId,
        }));
        return;
      }

      // Transform the op against all ops that happened since the client's version
      let transformedOp = op;
      if (version < doc.version) {
        // Get all ops between client version and current version
        const concurrentOps = doc.ops.filter(entry => entry.version >= version);
        for (const entry of concurrentOps) {
          if (entry.clientId === clientInfo.clientId) continue; // skip own ops
          transformedOp = transformJsonOp(transformedOp, entry.op, 'left');
          if (transformedOp === null) break; // op became a no-op
        }
      }

      if (transformedOp !== null) {
        // Apply the transformed op to the document
        try {
          doc.snapshot = applyJsonOp(doc.snapshot, transformedOp);
        } catch (err) {
          ws.send(JSON.stringify({
            type: 'error',
            error: `Failed to apply op: ${err.message}`,
            collection,
            docId,
          }));
          return;
        }
      }

      doc.version++;

      // Store op in history (keep last 1000 ops for transform)
      doc.ops.push({
        op: transformedOp || op,
        version: doc.version - 1, // version the op was applied at
        clientId: clientInfo.clientId,
      });
      if (doc.ops.length > 1000) {
        doc.ops = doc.ops.slice(-500);
      }

      // Send ack to the sender
      ws.send(JSON.stringify({
        type: 'ack',
        collection,
        docId,
        version: doc.version,
      }));

      // Broadcast the transformed op to all other subscribers
      if (transformedOp !== null) {
        const subscribers = docSubscribers.get(key);
        if (subscribers) {
          const broadcastMsg = JSON.stringify({
            type: 'op',
            collection,
            docId,
            op: transformedOp,
            version: doc.version,
            clientId: clientInfo.clientId,
          });

          for (const subscriber of subscribers) {
            if (subscriber !== ws && subscriber.readyState === WebSocket.OPEN) {
              subscriber.send(broadcastMsg);
            }
          }
        }
      }
      break;
    }

    case 'presence': {
      const { collection, docId, data } = msg;
      if (!collection || !docId) return;

      const key = `${collection}:${docId}`;
      const subscribers = docSubscribers.get(key);
      if (!subscribers) return;

      const broadcastMsg = JSON.stringify({
        type: 'presence',
        collection,
        docId,
        data: { ...data, clientId: clientInfo.clientId },
        clientId: clientInfo.clientId,
      });

      for (const subscriber of subscribers) {
        if (subscriber !== ws && subscriber.readyState === WebSocket.OPEN) {
          subscriber.send(broadcastMsg);
        }
      }
      break;
    }

    default: {
      ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${msg.type}` }));
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[collab-server] Shutting down...');
  wss.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('[collab-server] Shutting down...');
  wss.close(() => {
    process.exit(0);
  });
});

module.exports = { wss, documents, getDocument, applyJsonOp, transformJsonOp };
