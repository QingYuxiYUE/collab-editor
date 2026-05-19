import { Editor, Transforms, Element as SlateElement } from 'slate';
import type { MarkFormat, BlockFormat } from '../types';

const LIST_TYPES: BlockFormat[] = ['bulleted-list', 'numbered-list'];

/**
 * Check if a mark format is currently active at the cursor
 */
export function isMarkActive(editor: Editor, format: MarkFormat): boolean {
  const marks = Editor.marks(editor);
  return marks ? (marks as Record<string, boolean>)[format] === true : false;
}

/**
 * Toggle a mark format at the cursor
 */
export function toggleMark(editor: Editor, format: MarkFormat): void {
  const isActive = isMarkActive(editor, format);
  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
}

/**
 * Check if a block format is currently active
 */
export function isBlockActive(editor: Editor, format: BlockFormat): boolean {
  const { selection } = editor;
  if (!selection) return false;

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format,
    }),
  );

  return !!match;
}

/**
 * Toggle a block format
 */
export function toggleBlock(editor: Editor, format: BlockFormat): void {
  const isActive = isBlockActive(editor, format);
  const isList = LIST_TYPES.includes(format);

  Transforms.unwrapNodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && LIST_TYPES.includes(n.type as BlockFormat),
    split: true,
  });

  const newType = isActive ? 'paragraph' : isList ? 'list-item' : format;

  Transforms.setNodes(editor, { type: newType } as Partial<SlateElement>);

  if (!isActive && isList) {
    const block = { type: format, children: [] };
    Transforms.wrapNodes(editor, block as SlateElement);
  }
}

/**
 * Handle keyboard shortcuts
 */
export function handleHotkey(event: React.KeyboardEvent, editor: Editor): void {
  const isMod = event.metaKey || event.ctrlKey;
  if (!isMod) return;

  switch (event.key.toLowerCase()) {
    case 'b':
      event.preventDefault();
      toggleMark(editor, 'bold');
      break;
    case 'i':
      event.preventDefault();
      toggleMark(editor, 'italic');
      break;
    case 'u':
      event.preventDefault();
      toggleMark(editor, 'underline');
      break;
    case '`':
      event.preventDefault();
      toggleMark(editor, 'code');
      break;
  }
}
