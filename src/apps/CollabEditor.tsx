// ============================================================
// Collaborative Editor - ShareJS-style real-time editing
// Uses OT engine for conflict resolution with textarea binding
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCollabDoc } from '../collab/CollabProvider';
import { useTheme } from '../theme/ThemeProvider';
import type { AppProps } from '../core/types';
import './apps.css';

interface DocState {
  content: string;
  cursors: Record<string, { pos: number; name: string; color: string }>;
}

/**
 * ShareJS textarea binding pattern: compute minimal insert/delete ops
 * by diffing the old and new string values.
 */
function computeTextDiff(
  oldVal: string,
  newVal: string,
): { pos: number; deleteCount: number; insert: string } | null {
  if (oldVal === newVal) return null;

  // Find common prefix
  let prefixLen = 0;
  const minLen = Math.min(oldVal.length, newVal.length);
  while (prefixLen < minLen && oldVal[prefixLen] === newVal[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix (not overlapping with prefix)
  let suffixLen = 0;
  while (
    suffixLen < (oldVal.length - prefixLen) &&
    suffixLen < (newVal.length - prefixLen) &&
    oldVal[oldVal.length - 1 - suffixLen] === newVal[newVal.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const deleteCount = oldVal.length - prefixLen - suffixLen;
  const insert = newVal.slice(prefixLen, newVal.length - suffixLen);

  if (deleteCount === 0 && insert.length === 0) return null;

  return { pos: prefixLen, deleteCount, insert };
}

export function CollabEditor({ windowId }: AppProps) {
  const theme = useTheme();

  const { snapshot, submitOp, doc, connectionState, clientId } = useCollabDoc<DocState>(
    'documents', 'shared-doc',
    { content: '# Collaborative Document\n\nEdit this document collaboratively.\nChanges sync in real-time via OT.\n', cursors: {} }
  );

  // Track previous value for ShareJS diff pattern
  const prevContentRef = useRef(snapshot.content);

  // Keep prev ref in sync when snapshot changes from remote ops
  useEffect(() => {
    prevContentRef.current = snapshot.content;
  }, [snapshot.content]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const oldContent = prevContentRef.current;

    const diff = computeTextDiff(oldContent, newContent);
    if (!diff) return;

    // Build minimal ops: delete then insert at the string level
    // Using json0 string ops (si/sd) on the 'content' field
    if (diff.deleteCount > 0) {
      const deleted = oldContent.slice(diff.pos, diff.pos + diff.deleteCount);
      submitOp({ p: ['content', diff.pos], sd: deleted });
    }

    if (diff.insert.length > 0) {
      submitOp({ p: ['content', diff.pos], si: diff.insert });
    }

    prevContentRef.current = newContent;
  }, [submitOp]);

  // Connection status display
  const statusConfig = connectionState === 'connected'
    ? { label: 'Connected', color: theme.colors.success }
    : connectionState === 'connecting'
      ? { label: 'Reconnecting...', color: theme.colors.warning }
      : { label: 'Local only', color: theme.colors.warning };

  const version = doc.getVersion();

  return (
    <div className="kasm-app kasm-collab-editor">
      <div className="kasm-collab-editor__toolbar">
        <span className="kasm-collab-editor__status" style={{ color: statusConfig.color }}>
          ● {statusConfig.label}
        </span>
        <span className="kasm-collab-editor__version">v{version}</span>
        <span className="kasm-collab-editor__client">Client: {clientId.slice(0, 8)}</span>
      </div>
      <textarea
        className="kasm-collab-editor__textarea"
        value={snapshot.content}
        onChange={handleChange}
        spellCheck={false}
        placeholder="Start typing..."
      />
      <div className="kasm-collab-editor__footer">
        <span>ShareJS OT Engine</span>
        <span>{snapshot.content.length} chars</span>
      </div>
    </div>
  );
}
