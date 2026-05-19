import { createElement, useCallback } from 'react';
import type { RenderElementProps, RenderLeafProps } from 'slate-react';
import EditorElement from '../components/EditorElement';
import EditorLeaf from '../components/EditorLeaf';

export function useRenderElement() {
  return useCallback(
    (props: RenderElementProps) => createElement(EditorElement, props),
    [],
  );
}

export function useRenderLeaf() {
  return useCallback((props: RenderLeafProps) => createElement(EditorLeaf, props), []);
}
