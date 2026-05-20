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
  authToken?: string;
  userName?: string;
  userColor?: string;
  canInitialize?: boolean;
}

interface UseCollabEditorReturn {
  editor: CustomEditor;
  provider: WebsocketProvider | null;
  connected: boolean;
  synced: boolean;
  ready: boolean;
  connectionError: string | null;
}

/**
 * Hook to create a collaborative Slate editor backed by Yjs
 * Handles Y.Doc creation, WebSocket provider setup, and cleanup
 */
export function useCollabEditor({
  documentId,
  wsUrl = 'ws://192.168.100.18:3001/',
  authToken,
  userName,
  userColor,
  canInitialize = true,
}: UseCollabEditorOptions): UseCollabEditorReturn {
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [ready, setReady] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
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
    const wsProvider = new WebsocketProvider(wsUrl, documentId, ydoc, {
      connect: false,
      params: authToken ? { token: authToken } : {},
    });

    // Create the editor with Yjs and cursor plugins
    const editor = withCursors(
      withYjs(withHistory(withReact(createEditor())), sharedType),
      wsProvider.awareness,
      {
        data: { name, color } as CursorData,
      },
    );

    return { editor, provider: wsProvider, ydoc };
  }, [authToken, documentId, wsUrl, name, color]);

  // Lifecycle: connect/disconnect
  useEffect(() => {
    if (!provider) return;

    if (destroyTimerRef.current?.provider === provider) {
      clearTimeout(destroyTimerRef.current.timer);
      destroyTimerRef.current = null;
    }

    const onStatus = ({ status }: { status: string }) => {
      setConnected(status === 'connected');
      if (status === 'connected') {
        setConnectionError(null);
      }
    };
    const onSync = (isSynced: boolean) => {
      setSynced(isSynced);
      if (!isSynced || YjsEditor.connected(editor)) return;

      if (canInitialize && editor.sharedRoot.toDelta().length === 0) {
        editor.sharedRoot.applyDelta(slateNodesToInsertDelta(createEmptyDocument()), {
          sanitize: false,
        });
      }

      YjsEditor.connect(editor);
      setReady(true);
    };
    const onConnectionClose = (event: CloseEvent | null) => {
      if (!event) {
        setConnectionError('连接已断开，正在重试');
        return;
      }

      if (event.code === 1008) {
        setConnectionError('连接被拒绝，请重新登录');
        return;
      }

      if (event.code === 1011) {
        setConnectionError('后端初始化文档失败，请检查数据库和迁移');
        return;
      }

      if (event.reason) {
        setConnectionError(`${event.reason} (${event.code})`);
        return;
      }

      setConnectionError(`连接已关闭 (${event.code})`);
    };

    provider.on('status', onStatus);
    provider.on('sync', onSync);
    provider.on('connection-close', onConnectionClose);

    provider.connect();

    return () => {
      provider.off('status', onStatus);
      provider.off('sync', onSync);
      provider.off('connection-close', onConnectionClose);
      setReady(false);

      const timer = setTimeout(() => {
        if (YjsEditor.connected(editor)) {
          YjsEditor.disconnect(editor);
        }
        provider.disconnect();
        provider.destroy();
        ydoc.destroy();

        if (destroyTimerRef.current?.timer === timer) {
          destroyTimerRef.current = null;
        }
      }, 0);

      destroyTimerRef.current = { provider, timer };
    };
  }, [canInitialize, editor, provider, ydoc]);

  return { editor, provider, connected, synced, ready, connectionError };
}
