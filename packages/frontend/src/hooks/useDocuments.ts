import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../utils/runtime-config';

export type DocumentRole = 'owner' | 'editor' | 'viewer';
export type ShareDocumentRole = Extract<DocumentRole, 'editor' | 'viewer'>;

export interface DocumentSummary {
  id: string;
  title: string;
  ownerId: string;
  role: DocumentRole;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMember {
  userId: string;
  email: string;
  name: string;
  color: string;
  role: DocumentRole;
  createdAt: string;
}

interface DocumentListResponse {
  documents: DocumentSummary[];
}

interface DocumentResponse {
  document: DocumentSummary;
}

interface DocumentMembersResponse {
  members: DocumentMember[];
}

interface DocumentMemberResponse {
  member: DocumentMember;
}

function getErrorMessage(payload: unknown) {
  return typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string'
    ? payload.error
    : '请求失败，请稍后重试';
}

async function documentRequest<T>(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as T;
}

export function canEditDocument(role: DocumentRole) {
  return role === 'owner' || role === 'editor';
}

export function canShareDocument(role: DocumentRole) {
  return role === 'owner';
}

export async function updateDocumentTitleRequest(
  token: string,
  documentId: string,
  title: string,
) {
  const response = await documentRequest<DocumentResponse>(
    `/api/documents/${encodeURIComponent(documentId)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    },
  );
  return response.document;
}

export async function listDocumentMembersRequest(token: string, documentId: string) {
  const response = await documentRequest<DocumentMembersResponse>(
    `/api/documents/${encodeURIComponent(documentId)}/members`,
    token,
  );
  return response.members;
}

export async function shareDocumentRequest(
  token: string,
  documentId: string,
  email: string,
  role: ShareDocumentRole,
) {
  const response = await documentRequest<DocumentMemberResponse>(
    `/api/documents/${encodeURIComponent(documentId)}/members`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    },
  );
  return response.member;
}

export function useDocuments(token: string) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      const response = await documentRequest<DocumentListResponse>('/api/documents', token);
      setDocuments(response.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : '文档列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    documentRequest<DocumentListResponse>('/api/documents', token)
      .then((response) => {
        if (cancelled) return;
        setDocuments(response.documents);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '文档列表加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const createDocument = useCallback(
    async (title: string) => {
      const response = await documentRequest<DocumentResponse>('/api/documents', token, {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      setDocuments((current) => [response.document, ...current]);
      return response.document;
    },
    [token],
  );

  const updateDocumentTitle = useCallback(
    async (documentId: string, title: string) => {
      const document = await updateDocumentTitleRequest(token, documentId, title);
      setDocuments((current) =>
        current.map((item) => (item.id === document.id ? document : item)),
      );
      return document;
    },
    [token],
  );

  return {
    documents,
    loading,
    error,
    refresh,
    createDocument,
    updateDocumentTitle,
  };
}
