// ============================================================
// Collaboration Provider - ShareJS-style real-time context
// Manages collaborative documents with OT sync
// ============================================================

import { createContext, useContext, useRef, useMemo, useState, useSyncExternalStore, useCallback, useEffect } from 'react';
import { CollabDoc, CollabConnection, type JsonOp } from './ot';
import type { CollabPresence } from '../core/types';
import { v4 as uuid } from 'uuid';

type ConnectionState = 'connected' | 'disconnected' | 'connecting';

interface CollabContextValue {
  clientId: string;
  getDoc: <T>(collection: string, docId: string, initial: T) => CollabDoc<T>;
  presence: Map<string, CollabPresence>;
  updatePresence: (data: Partial<CollabPresence>) => void;
  connectionState: ConnectionState;
  connection: CollabConnection | null;
}

const CollabContext = createContext<CollabContextValue | null>(null);

const PRESENCE_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#e91e63', '#00bcd4', '#ff5722',
];

export function CollabProvider({ children }: { children: React.ReactNode }) {
  const clientId = useRef(uuid()).current;
  const docs = useRef(new Map<string, CollabDoc>()).current;
  const presence = useRef(new Map<string, CollabPresence>()).current;
  const connectionRef = useRef<CollabConnection | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  const colorIdx = useRef(Math.floor(Math.random() * PRESENCE_COLORS.length)).current;

  // Connection is lazy - only created when a doc is first requested.
  // This avoids WebSocket connection attempts on page load which
  // trigger Chrome's "site wants to access other apps" permission prompt.

  // Lazily create the connection on first doc request
  const ensureConnection = useCallback(() => {
    if (connectionRef.current) return connectionRef.current;
    const conn = new CollabConnection({
      url: 'ws://localhost:4000',
      clientId,
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 3,
    });
    connectionRef.current = conn;
    conn.onStateChange((state) => setConnectionState(state));
    try { conn.connect(); } catch {}
    return conn;
  }, [clientId]);

  // Disconnect on unmount to prevent leaked WebSocket connections
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.disconnect();
        connectionRef.current = null;
      }
    };
  }, []);

  const getDoc = useCallback(<T,>(collection: string, docId: string, initial: T): CollabDoc<T> => {
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
      docs.set(key, doc as CollabDoc<any>);
      conn.subscribe(collection, docId, doc as CollabDoc<any>);
    }
    return docs.get(key)! as CollabDoc<T>;
  }, [clientId, docs, ensureConnection]);

  const updatePresence = useCallback((data: Partial<CollabPresence>) => {
    const current = presence.get(clientId) ?? {
      clientId,
      color: PRESENCE_COLORS[colorIdx],
      name: `User ${clientId.slice(0, 4)}`,
    };
    presence.set(clientId, { ...current, ...data } as CollabPresence);
  }, [clientId, presence, colorIdx]);

  const value = useMemo<CollabContextValue>(() => ({
    clientId,
    getDoc,
    presence,
    updatePresence,
    connectionState,
    connection: connectionRef.current,
  }), [clientId, getDoc, presence, updatePresence, connectionState]);

  return (
    <CollabContext.Provider value={value}>
      {children}
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
  const doc = useMemo(() => getDoc<T>(collection, docId, initial), [getDoc, collection, docId, initial]);

  const subscribe = useCallback((callback: () => void) => {
    return doc.onChange(() => callback());
  }, [doc]);

  const getSnapshot = useCallback(() => doc.getSnapshot(), [doc]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  const submitOp = useCallback((op: JsonOp) => {
    doc.submitOp(op);
  }, [doc]);

  return { snapshot, submitOp, doc, connectionState, version: doc.getVersion(), clientId };
}
