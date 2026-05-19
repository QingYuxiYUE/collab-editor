import React from 'react';
import type { RenderLeafProps } from 'slate-react';

/**
 * Renders Slate leaf nodes with inline formatting
 */
const EditorLeaf: React.FC<RenderLeafProps> = ({ attributes, children, leaf }) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }
  if (leaf.italic) {
    children = <em>{children}</em>;
  }
  if (leaf.underline) {
    children = <u>{children}</u>;
  }
  if (leaf.strikethrough) {
    children = <s>{children}</s>;
  }
  if (leaf.code) {
    children = <code>{children}</code>;
  }

  return <span {...attributes}>{children}</span>;
};

export default EditorLeaf;
