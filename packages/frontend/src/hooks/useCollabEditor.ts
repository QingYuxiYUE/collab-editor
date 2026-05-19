import { useMemo, useEffect, useRef, useState } from 'react';
import { createEditor } from 'slate';
import { withReact } from 'slate-react';
import { withHistory } from 'slate-history';
import { withYjs, YjsEditor, withCursors, slateNodesToInsertDelta } from '@slate-yjs/core';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { CustomEditor, CursorData } from '../types';
import { createEmptyDocument } from '../utils/editor-value';

// Randomly assigned user colors
const CURSOR_COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6',
  '#ef4444', '#22c55e', '#3b82f6', '#f97316', '#06b6d4',
];

function getRandomColor() {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}

function getRandomName() {
  const names = ['用户A', '用户B', '用户C', '用户D', '用户E', '张三', '李四', '王五'];
  return names[Math.floor(Math.random() * names.length)];
}

interface UseCollabEditorOptions {
  documentId: string;
  wsUrl?: string;
  userName?: string;
  userColor?: string;
}

interface UseCollabEditorReturn {
  editor: CustomEditor;
  provider: WebsocketProvider | null;
  connected: boolean;
  synced: boolean;
  ready: boolean;
}

/**
 * Hook to create a collaborative Slate editor backed by Yjs
 * Handles Y.Doc creation, WebSocket provider setup, and cleanup
 */
export function useCollabEditor({
  documentId,
  wsUrl = 'ws://192.168.100.18:3001/',
  userName,
  userColor,
}: UseCollabEditorOptions): UseCollabEditorReturn {
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [ready, setReady] = useState(false);
  const destroyTimerRef = useRef<{
    provider: WebsocketProvider;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const name = useMemo(() => userName || getRandomName(), [userName]);
  const color = useMemo(() => userColor || getRandomColor(), [userColor]);

  const { editor, provider, ydoc } = useMemo(() => {
    const ydoc = new Y.Doc();
    const sharedType = ydoc.get('content', Y.XmlText) as Y.XmlText;

    // Create the WebSocket provider
    const wsProvider = new WebsocketProvider(wsUrl, documentId, ydoc, { connect: false });

    // Create the editor with Yjs and cursor plugins
    const editor = withCursors(
      withYjs(withHistory(withReact(createEditor())), sharedType),
      wsProvider.awareness,
      {
        data: { name, color } as CursorData,
      },
    );

    return { editor, provider: wsProvider, ydoc };
  }, [documentId, wsUrl, name, color]);

  // Lifecycle: connect/disconnect
  useEffect(() => {
    if (!provider) return;

    if (destroyTimerRef.current?.provider === provider) {
      clearTimeout(destroyTimerRef.current.timer);
      destroyTimerRef.current = null;
    }

    const onStatus = ({ status }: { status: string }) => {
      setConnected(status === 'connected');
    };
    const onSync = (isSynced: boolean) => {
      setSynced(isSynced);
      if (!isSynced || YjsEditor.connected(editor)) return;

      if (editor.sharedRoot.toDelta().length === 0) {
        editor.sharedRoot.applyDelta(slateNodesToInsertDelta(createEmptyDocument()), {
          sanitize: false,
        });
      }

      YjsEditor.connect(editor);
      setReady(true);
    };

    provider.on('status', onStatus);
    provider.on('sync', onSync);

    provider.connect();

    return () => {
      if (YjsEditor.connected(editor)) {
        YjsEditor.disconnect(editor);
      }
      provider.off('status', onStatus);
      provider.off('sync', onSync);
      provider.disconnect();
      setReady(false);

      const timer = setTimeout(() => {
        provider.destroy();
        ydoc.destroy();

        if (destroyTimerRef.current?.timer === timer) {
          destroyTimerRef.current = null;
        }
      }, 0);

      destroyTimerRef.current = { provider, timer };
    };
  }, [editor, provider, ydoc]);

  return { editor, provider, connected, synced, ready };
}
