import React, { useCallback, useMemo, useState } from 'react';
import { Slate, Editable } from 'slate-react';
import { Node, type Descendant } from 'slate';
import Toolbar from './components/Toolbar';
import { RemoteCursorOverlay } from './components/RemoteCursors';
import UserPresence from './components/UserPresence';
import { useCollabEditor } from './hooks/useCollabEditor';
import { useRenderElement, useRenderLeaf } from './hooks/useEditorRenderers';
import { handleHotkey } from './utils/editor-helpers';
import { createEmptyDocument } from './utils/editor-value';

const DOCUMENT_ID = 'demo-document';

const App: React.FC = () => {
  const { editor, provider, connected, synced, ready } = useCollabEditor({
    documentId: DOCUMENT_ID,
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
          <UserPresence awareness={provider?.awareness ?? null} />
          <div className="connection-status">
            <span
              className={`connection-status__dot ${!connected ? 'connection-status__dot--disconnected' : ''}`}
            />
            {connected ? (synced ? '已同步' : '同步中...') : '未连接'}
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

export default App;
