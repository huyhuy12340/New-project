# Design Changelog Web

Next.js app for the Design Changelog v2.5 architecture.

## What it does

- Pulls page-level Figma updates into a Git-backed data store
- Shows a home dashboard with pinned pages, recent activity, and folder groups
- Browses a folder view at `/[folderSlug]`
- Browses page history at `/[folderSlug]/[pageId]`
- Opens diff detail at `/[folderSlug]/[pageId]/[date]`

## Data model

- `data/pages.json` holds the tracked page registry
- `data/index.json` holds the daily diff manifest
- `data/entries/` holds the full diff payloads
- `data/baselines/` holds the last known stable snapshot per page

## Jobs

- `GET /api/cron/poll-figma`
- `GET /api/cron/reset-baseline`

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

- `FIGMA_TOKEN`
- `DATA_REPO_PATH`
- `GITHUB_DATA_REPO` and `GITHUB_DATA_BRANCH` only matter if you want GitHub as a read fallback

