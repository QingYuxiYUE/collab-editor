import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { Slate, Editable } from 'slate-react';
import { Node, type Descendant } from 'slate';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  LogoutOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import AuthPanel from './components/AuthPanel';
import DocumentList from './components/DocumentList';
import Toolbar from './components/Toolbar';
import { RemoteCursorOverlay } from './components/RemoteCursors';
import UserPresence from './components/UserPresence';
import ThemeToggle from './components/ThemeToggle';
import { useAuth, type AuthUser } from './hooks/useAuth';
import { useCollabEditor } from './hooks/useCollabEditor';
import {
  canEditDocument,
  canShareDocument,
  updateDocumentTitleRequest,
  type DocumentSummary,
} from './hooks/useDocuments';
import { useRenderElement, useRenderLeaf } from './hooks/useEditorRenderers';
import { handleHotkey } from './utils/editor-helpers';
import { createEmptyDocument } from './utils/editor-value';
import { WS_URL } from './utils/runtime-config';

const DocumentSharePanel = React.lazy(() => import('./components/DocumentSharePanel'));

interface EditorShellProps {
  user: AuthUser;
  token: string;
  document: DocumentSummary;
  onDocumentChange(document: DocumentSummary): void;
  onBack(): void;
  onLogout(): void;
}

const EditorShell: React.FC<EditorShellProps> = ({
  user,
  token,
  document,
  onDocumentChange,
  onBack,
  onLogout,
}) => {
  const canEdit = canEditDocument(document.role);
  const canShare = canShareDocument(document.role);
  const { editor, provider, connected, synced, ready, connectionError } = useCollabEditor({
    documentId: document.id,
    wsUrl: WS_URL,
    authToken: token,
    userName: user.name,
    userColor: user.color,
    canInitialize: canEdit,
  });

  const renderElement = useRenderElement();
  const renderLeaf = useRenderLeaf();
  const initialValue = useMemo(() => createEmptyDocument(), []);

  const [wordCount, setWordCount] = useState(0);
  const [titleDraft, setTitleDraft] = useState(document.title);
  const [renaming, setRenaming] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [sharingOpen, setSharingOpen] = useState(false);

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
      if (!canEdit) return;
      handleHotkey(event, editor);
    },
    [canEdit, editor],
  );

  const handleTitleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextTitle = titleDraft.trim();

      if (!nextTitle) {
        setTitleError('标题不能为空');
        return;
      }
      if (nextTitle === document.title) {
        setRenaming(false);
        return;
      }

      setTitleError('');
      setSavingTitle(true);

      try {
        const updatedDocument = await updateDocumentTitleRequest(token, document.id, nextTitle);
        onDocumentChange(updatedDocument);
        setRenaming(false);
      } catch (err) {
        setTitleError(err instanceof Error ? err.message : '标题保存失败');
      } finally {
        setSavingTitle(false);
      }
    },
    [document.id, document.title, onDocumentChange, titleDraft, token],
  );

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="app-header__left">
          <button className="editor-back" type="button" onClick={onBack}>
            <ArrowLeftOutlined />
          </button>
          <div className="app-header__logo">C</div>
          <div className="document-title-block">
            {renaming ? (
              <form className="document-title-editor" onSubmit={handleTitleSubmit}>
                <input
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  aria-label="文档标题"
                  maxLength={80}
                  autoFocus
                />
                <button
                  className="document-title-editor__button"
                  type="submit"
                  disabled={savingTitle}
                  aria-label="保存标题"
                  title="保存标题"
                >
                  <CheckOutlined />
                </button>
                <button
                  className="document-title-editor__button"
                  type="button"
                  onClick={() => {
                    setTitleDraft(document.title);
                    setTitleError('');
                    setRenaming(false);
                  }}
                  aria-label="取消修改标题"
                  title="取消"
                >
                  <CloseOutlined />
                </button>
              </form>
            ) : (
              <div className="document-title-view">
                <span className="app-header__title" title={document.title}>
                  {document.title}
                </span>
                {canEdit && (
                  <button
                    className="document-title-view__button"
                    type="button"
                    onClick={() => {
                      setTitleDraft(document.title);
                      setTitleError('');
                      setRenaming(true);
                    }}
                    aria-label="修改文档标题"
                    title="修改标题"
                  >
                    <EditOutlined />
                  </button>
                )}
              </div>
            )}
            {titleError && <span className="document-title-block__error">{titleError}</span>}
          </div>
          <span className="app-header__subtitle">
            {canEdit ? '可编辑' : '只读'}
          </span>
        </div>
        <div className="app-header__right">
          {canShare && (
            <button
              className={`header-action ${sharingOpen ? 'header-action--active' : ''}`}
              type="button"
              onClick={() => setSharingOpen((current) => !current)}
            >
              <ShareAltOutlined />
              分享
            </button>
          )}
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

      {sharingOpen && canShare && (
        <Suspense fallback={null}>
          <DocumentSharePanel
            documentId={document.id}
            token={token}
            onClose={() => setSharingOpen(false)}
          />
        </Suspense>
      )}

      {/* Editor */}
      <Slate editor={editor} initialValue={initialValue} onChange={handleChange}>
        {canEdit && <Toolbar />}
        <div className="editor-container">
          <div className="editor-wrapper">
            <RemoteCursorOverlay className="editor-content">
              <Editable
                key={ready ? 'ready' : 'pending'}
                renderElement={renderElement}
                renderLeaf={renderLeaf}
                placeholder={canEdit ? '开始输入内容，邀请他人协同编辑...' : '只读模式'}
                onKeyDown={onKeyDown}
                spellCheck
                autoFocus={ready}
                readOnly={!ready || !canEdit}
              />
            </RemoteCursorOverlay>
          </div>
        </div>
      </Slate>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-stats">
          <span>字数: {wordCount}</span>
          <span>文档: {document.title}</span>
        </div>
        <span>React + Slate.js + Yjs</span>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  const { user, token, loading, login, register, logout } = useAuth();
  const [selectedDocument, setSelectedDocument] = useState<DocumentSummary | null>(null);

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

  if (!selectedDocument) {
    return (
      <DocumentList
        user={user}
        token={token}
        onOpen={setSelectedDocument}
        onLogout={logout}
      />
    );
  }

  return (
    <EditorShell
      key={selectedDocument.id}
      user={user}
      token={token}
      document={selectedDocument}
      onDocumentChange={setSelectedDocument}
      onBack={() => setSelectedDocument(null)}
      onLogout={logout}
    />
  );
};

export default App;
