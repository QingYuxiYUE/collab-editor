import React, { useCallback, useMemo, useState } from 'react';
import { Slate, Editable } from 'slate-react';
import { Node, type Descendant } from 'slate';
import { LogoutOutlined } from '@ant-design/icons';
import AuthPanel from './components/AuthPanel';
import Toolbar from './components/Toolbar';
import { RemoteCursorOverlay } from './components/RemoteCursors';
import UserPresence from './components/UserPresence';
import ThemeToggle from './components/ThemeToggle';
import { useAuth, type AuthUser } from './hooks/useAuth';
import { useCollabEditor } from './hooks/useCollabEditor';
import { useRenderElement, useRenderLeaf } from './hooks/useEditorRenderers';
import { handleHotkey } from './utils/editor-helpers';
import { createEmptyDocument } from './utils/editor-value';
import { WS_URL } from './utils/runtime-config';

const DOCUMENT_ID = 'demo-document';

interface EditorShellProps {
  user: AuthUser;
  token: string;
  onLogout(): void;
}

const EditorShell: React.FC<EditorShellProps> = ({ user, token, onLogout }) => {
  const { editor, provider, connected, synced, ready, connectionError } = useCollabEditor({
    documentId: DOCUMENT_ID,
    wsUrl: WS_URL,
    authToken: token,
    userName: user.name,
    userColor: user.color,
  });

  const renderElement = useRenderElement();
  const renderLeaf = useRenderLeaf();
  const initialValue = useMemo(() => createEmptyDocument(), []);

  const [wordCount, setWordCount] = useState(0);

  const handleChange = useCallback(
    (value: Descendant[]) => {
      // Calculate word count
      const text = value.map((n) => Node.string(n)).join('\n');
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      setWordCount(words);
    },
    [],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      handleHotkey(event, editor);
    },
    [editor],
  );

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="app-header__left">
          <div className="app-header__logo">C</div>
          <span className="app-header__title">协同编辑器</span>
          <span className="app-header__subtitle">Collaborative Editor</span>
        </div>
        <div className="app-header__right">
          <ThemeToggle />
          <div className="account-menu">
            <div className="account-menu__avatar" style={{ backgroundColor: user.color }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="account-menu__meta">
              <span className="account-menu__name">{user.name}</span>
              <span className="account-menu__email">{user.email}</span>
            </div>
            <button className="account-menu__logout" type="button" onClick={onLogout}>
              <LogoutOutlined />
              退出
            </button>
          </div>
          <UserPresence awareness={provider?.awareness ?? null} />
          <div className="connection-status">
            <span
              className={`connection-status__dot ${!connected ? 'connection-status__dot--disconnected' : ''}`}
            />
            {connectionError || (connected ? (synced ? '已同步' : '同步中...') : '未连接')}
          </div>
        </div>
      </header>

      {/* Editor */}
      <Slate editor={editor} initialValue={initialValue} onChange={handleChange}>
        <Toolbar />
        <div className="editor-container">
          <div className="editor-wrapper">
            <RemoteCursorOverlay className="editor-content">
              <Editable
                key={ready ? 'ready' : 'pending'}
                renderElement={renderElement}
                renderLeaf={renderLeaf}
                placeholder="开始输入内容，邀请他人协同编辑..."
                onKeyDown={onKeyDown}
                spellCheck
                autoFocus={ready}
                readOnly={!ready}
              />
            </RemoteCursorOverlay>
          </div>
        </div>
      </Slate>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-stats">
          <span>字数: {wordCount}</span>
          <span>文档: {DOCUMENT_ID}</span>
        </div>
        <span>React + Slate.js + Yjs</span>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  const { user, token, loading, login, register, logout } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading__mark">C</div>
        <span>正在恢复登录状态...</span>
      </div>
    );
  }

  if (!user || !token) {
    return <AuthPanel onLogin={login} onRegister={register} />;
  }

  return <EditorShell user={user} token={token} onLogout={logout} />;
};

export default App;
