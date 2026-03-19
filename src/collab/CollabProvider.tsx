// ============================================================
// Collaboration Provider - ShareJS-style real-time context
// Manages collaborative documents with OT sync
// ============================================================

import { createContext, useContext, createSignal, onCleanup, createMemo, type JSX } from 'solid-js';
import { CollabDoc, CollabConnection, type JsonOp } from './ot';
import type { CollabPresence } from '../core/types';
import { v4 as uuid } from 'uuid';

type ConnectionState = 'connected' | 'disconnected' | 'connecting';

interface CollabContextValue {
  clientId: string;
  getDoc: <T>(collection: string, docId: string, initial: T) => CollabDoc<T>;
  presence: Map<string, CollabPresence>;
  updatePresence: (data: Partial<CollabPresence>) => void;
  connectionState: () => ConnectionState;
  connection: () => CollabConnection | null;
}

const CollabContext = createContext<CollabContextValue | null>(null);

const PRESENCE_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#e91e63', '#00bcd4', '#ff5722',
];

export function CollabProvider(props: { children: JSX.Element }) {
  const clientId = uuid();
  const docs = new Map<string, CollabDoc<unknown>>();
  const presence = new Map<string, CollabPresence>();
  let connectionRef: CollabConnection | null = null;
  const [connectionState, setConnectionState] = createSignal<ConnectionState>('disconnected');
  const colorIdx = Math.floor(Math.random() * PRESENCE_COLORS.length);

  function ensureConnection(): CollabConnection {
    if (connectionRef) return connectionRef;
    const conn = new CollabConnection({
      url: 'ws://localhost:4000',
      clientId,
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 3,
    });
    connectionRef = conn;
    conn.onStateChange((s) => setConnectionState(s as ConnectionState));
    try { conn.connect(); } catch { /* ignore */ }
    return conn;
  }

  onCleanup(() => {
    if (connectionRef) {
      connectionRef.disconnect();
      connectionRef = null;
    }
  });

  function getDoc<T>(collection: string, docId: string, initial: T): CollabDoc<T> {
    const key = `${collection}:${docId}`;
    if (!docs.has(key)) {
      const conn = ensureConnection();
      const doc = new CollabDoc<T>({
        initial,
        clientId,
        type: 'json0',
        connection: conn,
        collection,
        docId,
      });
      docs.set(key, doc as CollabDoc<unknown>);
      conn.subscribe(collection, docId, doc as CollabDoc<unknown>);
    }
    return docs.get(key)! as CollabDoc<T>;
  }

  function updatePresence(data: Partial<CollabPresence>): void {
    const current = presence.get(clientId) ?? {
      clientId,
      color: PRESENCE_COLORS[colorIdx],
      name: `User ${clientId.slice(0, 4)}`,
    };
    presence.set(clientId, { ...current, ...data } as CollabPresence);
  }

  const value: CollabContextValue = {
    clientId,
    getDoc,
    presence,
    updatePresence,
    connectionState,
    connection: () => connectionRef,
  };

  return (
    <CollabContext.Provider value={value}>
      {props.children}
    </CollabContext.Provider>
  );
}

export function useCollab(): CollabContextValue {
  const ctx = useContext(CollabContext);
  if (!ctx) throw new Error('useCollab must be within CollabProvider');
  return ctx;
}

// Hook for subscribing to a collaborative document
export function useCollabDoc<T>(collection: string, docId: string, initial: T) {
  const { getDoc, clientId, connectionState } = useCollab();
  const doc = getDoc<T>(collection, docId, initial);

  const [snapshot, setSnapshot] = createSignal<T>(doc.getSnapshot());

  const unsub = doc.onChange(() => setSnapshot(() => doc.getSnapshot()));
  onCleanup(() => unsub());

  function submitOp(op: JsonOp): void {
    doc.submitOp(op);
  }

  return {
    get snapshot() { return snapshot(); },
    submitOp,
    doc,
    connectionState,
    get version() { return doc.getVersion(); },
    clientId,
  };
}
