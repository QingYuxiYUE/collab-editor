import React, { useCallback, useState } from 'react';
import {
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import ThemeToggle from './ThemeToggle';
import type { AuthUser } from '../hooks/useAuth';
import {
  canEditDocument,
  type DocumentRole,
  type DocumentSummary,
  useDocuments,
} from '../hooks/useDocuments';

interface DocumentListProps {
  user: AuthUser;
  token: string;
  onOpen(document: DocumentSummary): void;
  onLogout(): void;
}

function getRoleLabel(role: DocumentRole) {
  if (role === 'owner') return '所有者';
  if (role === 'editor') return '可编辑';
  return '只读';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const DocumentList: React.FC<DocumentListProps> = ({ user, token, onOpen, onLogout }) => {
  const { documents, loading, error, refresh, createDocument } = useDocuments(token);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleCreate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setCreateError('');
      setCreating(true);

      try {
        const document = await createDocument(title);
        setTitle('');
        onOpen(document);
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : '创建文档失败');
      } finally {
        setCreating(false);
      }
    },
    [createDocument, onOpen, title],
  );

  return (
    <div className="workspace-layout">
      <header className="app-header">
        <div className="app-header__left">
          <div className="app-header__logo">C</div>
          <span className="app-header__title">协同编辑器</span>
          <span className="app-header__subtitle">Documents</span>
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
        </div>
      </header>

      <main className="document-list">
        <section className="document-list__header">
          <div>
            <h1>文档</h1>
            <p>{documents.length} 个可访问文档</p>
          </div>
          <button className="document-list__refresh" type="button" onClick={() => void refresh()}>
            <ReloadOutlined />
            刷新
          </button>
        </section>

        <form className="document-create" onSubmit={handleCreate}>
          <label className="document-create__field">
            <span>新建文档</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="输入文档标题"
              maxLength={80}
            />
          </label>
          <button className="document-create__button" type="submit" disabled={creating}>
            <PlusOutlined />
            {creating ? '创建中...' : '创建'}
          </button>
        </form>

        {(error || createError) && (
          <div className="auth-form__error" role="alert">
            {error || createError}
          </div>
        )}

        <section className="document-grid" aria-label="文档列表">
          {loading ? (
            <div className="document-empty">正在加载文档...</div>
          ) : documents.length === 0 ? (
            <div className="document-empty">还没有文档，创建一个开始编辑。</div>
          ) : (
            documents.map((document) => {
              const editable = canEditDocument(document.role);
              return (
                <button
                  key={document.id}
                  className="document-card"
                  type="button"
                  onClick={() => onOpen(document)}
                >
                  <span className="document-card__icon">
                    <FileTextOutlined />
                  </span>
                  <span className="document-card__body">
                    <span className="document-card__title">{document.title}</span>
                    <span className="document-card__meta">
                      更新于 {formatDate(document.updatedAt)}
                    </span>
                  </span>
                  <span
                    className={`document-card__role ${
                      editable ? 'document-card__role--editable' : ''
                    }`}
                  >
                    {editable ? <EditOutlined /> : <EyeOutlined />}
                    {getRoleLabel(document.role)}
                  </span>
                </button>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
};

export default DocumentList;
