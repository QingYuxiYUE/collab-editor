import React, { useRef, type PropsWithChildren, Component, type ReactNode } from 'react';
import { useRemoteCursorOverlayPositions } from '@slate-yjs/react';
import type { CursorData } from '../types';

type CursorOverlayProps = PropsWithChildren<{
  className?: string;
}>;

/**
 * Error boundary to prevent cursor rendering errors from crashing the editor
 */
class CursorErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[RemoteCursors] Rendering error:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Inner component that uses the cursor overlay hook
 */
const CursorOverlayInner: React.FC<CursorOverlayProps> = ({ children, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursors] = useRemoteCursorOverlayPositions<CursorData>({
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
  });

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative' }}>
      {children}
      {cursors.map((cursor, index) => {
        // Defensive: skip cursors with missing data
        if (!cursor) return null;
        const rects = Array.isArray(cursor.selectionRects) ? cursor.selectionRects : [];
        const caret = cursor.caretPosition || null;

        return (
          <RemoteCursor
            key={cursor.clientId ?? `cursor-${index}`}
            name={cursor.data?.name ?? '匿名用户'}
            color={cursor.data?.color ?? '#888'}
            caretPosition={caret}
            selectionRects={rects}
          />
        );
      })}
    </div>
  );
};

/**
 * Renders remote user cursors and selections as an overlay on the editor.
 * Wrapped in an error boundary to prevent cursor issues from crashing the editor.
 */
export const RemoteCursorOverlay: React.FC<CursorOverlayProps> = ({ children, className }) => {
  const fallback = (
    <div className={className} style={{ position: 'relative' }}>
      {children}
    </div>
  );

  return (
    <CursorErrorBoundary fallback={fallback}>
      <CursorOverlayInner className={className}>{children}</CursorOverlayInner>
    </CursorErrorBoundary>
  );
};

/**
 * Individual remote cursor with caret line and label
 */
const RemoteCursor: React.FC<{
  name: string;
  color: string;
  caretPosition: { top: number; left: number; height: number } | null;
  selectionRects: Array<{ top: number; left: number; width: number; height: number }>;
}> = ({ name, color, caretPosition, selectionRects }) => {
  return (
    <>
      {selectionRects.map((rect, i) => (
        <div
          key={`sel-${i}`}
          className="remote-cursor__selection"
          style={{
            position: 'absolute',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            backgroundColor: color,
          }}
        />
      ))}

      {caretPosition && (
        <div
          className="remote-cursor"
          style={{
            top: caretPosition.top,
            left: caretPosition.left,
            height: caretPosition.height,
          }}
        >
          <div
            className="remote-cursor__caret"
            style={{ backgroundColor: color }}
          />
          <div
            className="remote-cursor__label"
            style={{ backgroundColor: color }}
          >
            {name}
          </div>
        </div>
      )}
    </>
  );
};

export default RemoteCursorOverlay;
