# Vectorbench — SVG Viewer

A Docker Compose app for storing, viewing, tagging, searching, and downloading SVG files.

## Stack

- **frontend** — React 18 + Vite, served by nginx (port 8080), proxies `/api` to the backend
- **backend** — Node 20 + Express + Multer, JSON-file metadata store
- **svg_data** — named Docker volume that persists uploaded files and metadata

## Run

```bash
docker compose up --build
```

Open http://localhost:8080

## Features

- Drag & drop or browse to upload one or many `.svg` files (5 MB / file limit)
- Attach comma-separated tags to each upload batch
- Dashboard grid with transparency-checkerboard previews
- Live search across file names and tags
- Clickable tag filters with counts (multiple tags combine as AND)
- Per-file download, rename, re-tag, and delete
- SVGs are sanitized on upload (scripts and event handlers stripped) and served
  with `script-src 'none'` for safe inline preview

## API

| Method | Path                      | Description                          |
| ------ | ------------------------- | ------------------------------------ |
| GET    | `/api/svgs`               | List all SVGs (metadata)             |
| POST   | `/api/svgs`               | Upload files (`files[]`, `tags`)     |
| GET    | `/api/svgs/:id/raw`       | Raw SVG for preview                  |
| GET    | `/api/svgs/:id/download`  | Download as attachment               |
| PATCH  | `/api/svgs/:id`           | Update `name` and/or `tags`          |
| DELETE | `/api/svgs/:id`           | Delete file                          |
| GET    | `/api/tags`               | All tags with usage counts           |

## Local development (without Docker)

```bash
# terminal 1
cd backend && npm install && npm start        # API on :4000

# terminal 2
cd frontend && npm install && npm run dev     # Vite on :5173, proxies /api
```

## Reset all data

```bash
docker compose down -v
```
