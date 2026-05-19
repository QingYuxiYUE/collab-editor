import type { Descendant } from 'slate';

export function createEmptyDocument(): Descendant[] {
  return [
    {
      type: 'paragraph',
      children: [{ text: '' }],
    },
  ];
}
