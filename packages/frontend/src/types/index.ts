import type { BaseEditor, Descendant } from 'slate';
import type { ReactEditor } from 'slate-react';
import type { HistoryEditor } from 'slate-history';
import type { YjsEditor } from '@slate-yjs/core';

// ===== Custom Element Types =====
export type ParagraphElement = { type: 'paragraph'; children: Descendant[] };
export type HeadingOneElement = { type: 'heading-one'; children: Descendant[] };
export type HeadingTwoElement = { type: 'heading-two'; children: Descendant[] };
export type HeadingThreeElement = { type: 'heading-three'; children: Descendant[] };
export type BlockQuoteElement = { type: 'block-quote'; children: Descendant[] };
export type BulletedListElement = { type: 'bulleted-list'; children: Descendant[] };
export type NumberedListElement = { type: 'numbered-list'; children: Descendant[] };
export type ListItemElement = { type: 'list-item'; children: Descendant[] };
export type CodeBlockElement = { type: 'code-block'; children: Descendant[] };

export type CustomElement =
  | ParagraphElement
  | HeadingOneElement
  | HeadingTwoElement
  | HeadingThreeElement
  | BlockQuoteElement
  | BulletedListElement
  | NumberedListElement
  | ListItemElement
  | CodeBlockElement;

// ===== Custom Text =====
export type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};

// ===== Mark Types =====
export type MarkFormat = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code';

// ===== Block Types =====
export type BlockFormat = CustomElement['type'];

// ===== Editor Type =====
export type CustomEditor = BaseEditor & ReactEditor & HistoryEditor & YjsEditor;

// ===== Cursor Data =====
export interface CursorData {
  [key: string]: unknown;
  name: string;
  color: string;
}

// ===== Module Augmentation =====
declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
