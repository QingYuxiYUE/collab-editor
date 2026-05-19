# Collaborative Editor

A real-time collaborative rich text editor built with React, Slate, Yjs, and a lightweight WebSocket backend.

## Features

- Rich text editing with headings, lists, quotes, code blocks, and inline marks
- Yjs-backed CRDT document synchronization
- Remote cursors and collaborator presence
- Monorepo workspace powered by pnpm

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the frontend and backend together:

```bash
pnpm run dev
```

The frontend starts with Vite, and the collaboration backend listens on `ws://localhost:3001`.

## Useful Scripts

```bash
pnpm run dev
pnpm run build:frontend
pnpm --filter frontend lint
pnpm --filter backend start
```

## Project Structure

```text
packages/
  backend/    WebSocket + Yjs sync server
  frontend/   React + Slate editor
```
