import React, { useCallback, useEffect, useState } from 'react';
import {
  CloseOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import {
  listDocumentMembersRequest,
  shareDocumentRequest,
  type DocumentMember,
  type DocumentRole,
  type ShareDocumentRole,
} from '../hooks/useDocuments';

interface DocumentSharePanelProps {
  documentId: string;
  token: string;
  onClose(): void;
}

function getRoleLabel(role: DocumentRole) {
  if (role === 'owner') return '所有者';
  if (role === 'editor') return '可编辑';
  return '只读';
}

function sortMembers(members: DocumentMember[]) {
  const roleWeight: Record<DocumentRole, number> = {
    owner: 0,
    editor: 1,
    viewer: 2,
  };

  return [...members].sort((a, b) => {
    const weightDiff = roleWeight[a.role] - roleWeight[b.role];
    if (weightDiff !== 0) return weightDiff;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
}

const DocumentSharePanel: React.FC<DocumentSharePanelProps> = ({
  documentId,
  token,
  onClose,
}) => {
  const [members, setMembers] = useState<DocumentMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareDocumentRole>('editor');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const nextMembers = await listDocumentMembersRequest(token, documentId);
      setMembers(sortMembers(nextMembers));
    } catch (err) {
      setError(err instanceof Error ? err.message : '成员列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [documentId, token]);

  useEffect(() => {
    let cancelled = false;

    listDocumentMembersRequest(token, documentId)
      .then((nextMembers) => {
        if (cancelled) return;
        setMembers(sortMembers(nextMembers));
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '成员列表加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, token]);

  const handleShare = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError('');
      setNotice('');
      setSubmitting(true);

      try {
        const member = await shareDocumentRequest(token, documentId, email, role);
        setMembers((current) => {
          const nextMembers = current.some((item) => item.userId === member.userId)
            ? current.map((item) => (item.userId === member.userId ? member : item))
            : [...current, member];
          return sortMembers(nextMembers);
        });
        setEmail('');
        setNotice(`已共享给 ${member.name}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : '共享失败');
      } finally {
        setSubmitting(false);
      }
    },
    [documentId, email, role, token],
  );

  return (
    <section className="share-panel" aria-labelledby="share-panel-title">
      <div className="share-panel__inner">
        <div className="share-panel__header">
          <div>
            <h2 id="share-panel-title">
              <ShareAltOutlined />
              文档共享
            </h2>
            <p>{members.length} 个成员</p>
          </div>
          <div className="share-panel__actions">
            <button
              className="share-panel__icon-button"
              type="button"
              onClick={() => void loadMembers()}
              disabled={loading}
              aria-label="刷新成员"
              title="刷新成员"
            >
              <ReloadOutlined />
            </button>
            <button
              className="share-panel__icon-button"
              type="button"
              onClick={onClose}
              aria-label="关闭共享面板"
              title="关闭"
            >
              <CloseOutlined />
            </button>
          </div>
        </div>

        <form className="share-form" onSubmit={handleShare}>
          <label className="share-form__field">
            <span>用户邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
            />
          </label>
          <label className="share-form__field share-form__field--role">
            <span>权限</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as ShareDocumentRole)}
            >
              <option value="editor">可编辑</option>
              <option value="viewer">只读</option>
            </select>
          </label>
          <button className="share-form__submit" type="submit" disabled={submitting}>
            <UserAddOutlined />
            {submitting ? '共享中...' : '共享'}
          </button>
        </form>

        {(error || notice) && (
          <div
            className={error ? 'share-panel__error' : 'share-panel__notice'}
            role={error ? 'alert' : 'status'}
          >
            {error || notice}
          </div>
        )}

        <div className="share-member-list" aria-label="共享成员列表">
          {loading ? (
            <div className="share-member-list__empty">正在加载成员...</div>
          ) : members.length === 0 ? (
            <div className="share-member-list__empty">暂无成员</div>
          ) : (
            members.map((member) => (
              <div className="share-member" key={member.userId}>
                <div className="share-member__avatar" style={{ backgroundColor: member.color }}>
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="share-member__meta">
                  <span className="share-member__name">{member.name}</span>
                  <span className="share-member__email">{member.email}</span>
                </div>
                <span className={`share-member__role share-member__role--${member.role}`}>
                  {getRoleLabel(member.role)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default DocumentSharePanel;
