import React, { useCallback, useEffect, useState } from 'react';
import { ReloadOutlined, ShareAltOutlined, UserAddOutlined } from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Button,
  ConfigProvider,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Select,
  Tag,
  Typography,
} from 'antd';
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

interface ShareFormValues {
  email: string;
  role: ShareDocumentRole;
}

const shareModalTheme = {
  token: {
    borderRadius: 8,
    colorBgContainer: 'var(--bg-surface)',
    colorBgElevated: 'var(--bg-elevated)',
    colorBorder: 'var(--border)',
    colorError: 'var(--danger)',
    colorPrimary: 'var(--primary)',
    colorPrimaryHover: 'var(--primary-hover)',
    colorSuccess: 'var(--success)',
    colorText: 'var(--text)',
    colorTextSecondary: 'var(--text-secondary)',
    colorTextTertiary: 'var(--text-muted)',
    controlHeight: 42,
    fontFamily: 'var(--font-sans)',
  },
};

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
  const [form] = Form.useForm<ShareFormValues>();
  const [members, setMembers] = useState<DocumentMember[]>([]);
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
    async (values: ShareFormValues) => {
      setError('');
      setNotice('');
      setSubmitting(true);

      try {
        const member = await shareDocumentRequest(
          token,
          documentId,
          values.email,
          values.role,
        );
        setMembers((current) => {
          const nextMembers = current.some((item) => item.userId === member.userId)
            ? current.map((item) => (item.userId === member.userId ? member : item))
            : [...current, member];
          return sortMembers(nextMembers);
        });
        form.resetFields(['email']);
        setNotice(`已共享给 ${member.name}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : '共享失败');
      } finally {
        setSubmitting(false);
      }
    },
    [documentId, form, token],
  );

  return (
    <ConfigProvider theme={shareModalTheme}>
      <Modal
        centered
        className="share-modal"
        destroyOnHidden
        footer={null}
        open
        rootClassName="share-modal-root"
        title={
          <div className="share-modal__title">
            <span className="share-modal__title-icon">
              <ShareAltOutlined />
            </span>
            <div>
              <Typography.Title level={2}>文档共享</Typography.Title>
              <Typography.Text type="secondary">{members.length} 个成员</Typography.Text>
            </div>
          </div>
        }
        width={640}
        onCancel={onClose}
      >
        <Form
          className="share-modal__form"
          form={form}
          initialValues={{ role: 'editor' }}
          layout="vertical"
          onFinish={handleShare}
        >
          <Form.Item
            label="用户邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入用户邮箱' },
              { type: 'email', message: '请输入有效邮箱' },
            ]}
          >
            <Input autoComplete="email" placeholder="name@example.com" />
          </Form.Item>

          <Form.Item label="权限" name="role" rules={[{ required: true, message: '请选择权限' }]}>
            <Select
              options={[
                { value: 'editor', label: '可编辑' },
                { value: 'viewer', label: '只读' },
              ]}
              popupClassName="share-modal__select-dropdown"
            />
          </Form.Item>

          <Button
            block
            className="share-modal__submit"
            htmlType="submit"
            icon={<UserAddOutlined />}
            loading={submitting}
            type="primary"
          >
            共享
          </Button>
        </Form>

        {(error || notice) && (
          <Alert
            className="share-modal__alert"
            message={error || notice}
            showIcon
            type={error ? 'error' : 'success'}
          />
        )}

        <div className="share-modal__members-header">
          <Typography.Text strong>成员列表</Typography.Text>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            size="small"
            type="text"
            onClick={() => void loadMembers()}
          >
            刷新
          </Button>
        </div>

        {loading ? (
          <div className="share-modal__loading">正在加载成员...</div>
        ) : members.length === 0 ? (
          <Empty className="share-modal__empty" description="暂无成员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            className="share-modal__member-list"
            dataSource={members}
            rowKey="userId"
            renderItem={(member) => (
              <List.Item
                actions={[
                  <Tag
                    className={`share-modal__role-tag share-modal__role-tag--${member.role}`}
                    key="role"
                    bordered={false}
                  >
                    {getRoleLabel(member.role)}
                  </Tag>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar className="share-modal__avatar" style={{ backgroundColor: member.color }}>
                      {member.name.charAt(0).toUpperCase()}
                    </Avatar>
                  }
                  description={<span className="share-modal__member-email">{member.email}</span>}
                  title={<span className="share-modal__member-name">{member.name}</span>}
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </ConfigProvider>
  );
};

export default DocumentSharePanel;
