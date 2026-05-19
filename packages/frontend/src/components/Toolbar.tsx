import React from 'react';
import { useSlate } from 'slate-react';
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  CodeOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { isMarkActive, toggleMark, isBlockActive, toggleBlock } from '../utils/editor-helpers';
import type { MarkFormat, BlockFormat } from '../types';

/**
 * Mark button — toggles inline formatting
 */
const MarkButton: React.FC<{
  format: MarkFormat;
  icon: React.ReactNode;
  title: string;
}> = ({ format, icon, title }) => {
  const editor = useSlate();
  const active = isMarkActive(editor, format);

  return (
    <button
      className={`toolbar-btn ${active ? 'toolbar-btn--active' : ''}`}
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        toggleMark(editor, format);
      }}
    >
      {icon}
    </button>
  );
};

/**
 * Block button — toggles block-level formatting
 */
const BlockButton: React.FC<{
  format: BlockFormat;
  icon: React.ReactNode;
  title: string;
}> = ({ format, icon, title }) => {
  const editor = useSlate();
  const active = isBlockActive(editor, format);

  return (
    <button
      className={`toolbar-btn ${active ? 'toolbar-btn--active' : ''}`}
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        toggleBlock(editor, format);
      }}
    >
      {icon}
    </button>
  );
};

/**
 * Editor Toolbar with mark and block format buttons
 */
const Toolbar: React.FC = () => {
  return (
    <div className="editor-toolbar">
      {/* Inline Marks */}
      <div className="toolbar-group">
        <MarkButton format="bold" icon={<BoldOutlined />} title="粗体 (⌘B)" />
        <MarkButton format="italic" icon={<ItalicOutlined />} title="斜体 (⌘I)" />
        <MarkButton format="underline" icon={<UnderlineOutlined />} title="下划线 (⌘U)" />
        <MarkButton
          format="strikethrough"
          icon={<StrikethroughOutlined />}
          title="删除线"
        />
        <MarkButton format="code" icon={<CodeOutlined />} title="行内代码 (⌘`)" />
      </div>

      <div className="toolbar-divider" />

      {/* Block Formats */}
      <div className="toolbar-group">
        <BlockButton
          format="heading-one"
          icon={<span style={{ fontWeight: 700, fontSize: 14 }}>H1</span>}
          title="标题 1"
        />
        <BlockButton
          format="heading-two"
          icon={<span style={{ fontWeight: 700, fontSize: 13 }}>H2</span>}
          title="标题 2"
        />
        <BlockButton
          format="heading-three"
          icon={<span style={{ fontWeight: 600, fontSize: 12 }}>H3</span>}
          title="标题 3"
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <BlockButton
          format="block-quote"
          icon={<span style={{ fontSize: 16, fontWeight: 700 }}>"</span>}
          title="引用"
        />
        <BlockButton
          format="bulleted-list"
          icon={<UnorderedListOutlined />}
          title="无序列表"
        />
        <BlockButton
          format="numbered-list"
          icon={<OrderedListOutlined />}
          title="有序列表"
        />
        <BlockButton
          format="code-block"
          icon={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>&lt;/&gt;</span>}
          title="代码块"
        />
      </div>
    </div>
  );
};

export default Toolbar;
