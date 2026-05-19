# Collaborative Editor

A real-time collaborative rich text editor built with React, Slate, Yjs, and a lightweight WebSocket backend.

## Features

- Rich text editing with headings, lists, quotes, code blocks, and inline marks
- Yjs-backed CRDT document synchronization
- Remote cursors and collaborator presence
- User authentication with PostgreSQL-backed persistence
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

## Database

The backend can run in two modes:

- Without `DATABASE_URL`: users and documents stay in memory for quick local development.
- With `DATABASE_URL`: users, document membership, and Yjs document updates are stored in PostgreSQL.

Create a local database, then configure the backend:

```bash
cp packages/backend/.env.example packages/backend/.env
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/collab_editor"
export AUTH_SECRET="replace-with-a-long-random-secret"
pnpm --filter backend db:migrate
```

The document body is stored as Yjs binary updates in `document_updates.update_data`; optional snapshots are represented by `document_snapshots.state`.

## Useful Scripts

```bash
pnpm run dev
pnpm run build:frontend
pnpm --filter frontend lint
pnpm --filter backend start
pnpm --filter backend db:migrate
```

## Project Structure

```text
packages/
  backend/    WebSocket + Yjs sync server
  frontend/   React + Slate editor
```
