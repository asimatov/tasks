# Task List

A private, browser-based task tracker built with plain HTML, CSS and JavaScript. It has no backend and stores all application data locally in IndexedDB.

## Features

- Create, edit, complete, reopen and delete cards
- Assign colors, priorities and up to six tags
- Filter by tag and sort by priority, tag or creation date
- Reorder cards with drag and drop
- Write card content using Markdown
- Keep an always-visible Markdown note in the header for important text and links
- Store immutable card versions and activity history for future browsing and search
- Automatically migrate earlier `localStorage` data to IndexedDB
- Responsive layout, reduced-motion support and a distinct `T` favicon

## Run locally

The application can be opened directly from `index.html`. Using a local HTTP server is recommended because browser storage is scoped to the exact protocol, host and port.

```powershell
python -m http.server 8080
```

Open http://localhost:8080.

## Run with Docker

Build the image from the project directory:

```powershell
docker build -t task-list .
```

Start the container and publish the application on port 8080:

```powershell
docker run --name task-list -d -p 8080:80 task-list
```

Open http://localhost:8080.

View the running container and its logs:

```powershell
docker ps
docker logs task-list
```

Stop and remove the container:

```powershell
docker stop task-list
docker rm task-list
```

After changing the application files, rebuild the image and recreate the container:

```powershell
docker stop task-list
docker rm task-list
docker build -t task-list .
docker run --name task-list -d -p 8080:80 task-list
```

Cards, versions, activity history and the important note are stored in the browser's IndexedDB, not in the container. Rebuilding or removing the container does not delete them as long as the application continues to use the same protocol, host and port.

The image uses `nginx:alpine` and contains only the static application files.

## Local data storage

The application uses the `quiet-list-db` IndexedDB database with four object stores:

- `tasks` contains the current cards;
- `versions` contains immutable card snapshots;
- `history` contains activity records such as `created`, `updated`, `completed`, `reopened` and `deleted`;
- `settings` contains the important note and migration metadata.

History records retain the card text and tags as they appeared when the event occurred. Indexes are available for card ID, event type, timestamp and normalized search text. This provides the foundation for a future history search interface, including renamed or deleted cards. Versions and history remain available after a card is deleted.

Existing cards and the important note are automatically migrated once from the earlier `localStorage` format. The old entries are removed only after the IndexedDB transaction completes successfully.

IndexedDB belongs to the current browser origin. Changing the protocol, hostname or port creates a different storage context. Clearing site data removes the database, and data is not synchronized between browsers or devices.

Versions and history are currently recorded in the database but do not yet have a dedicated viewer in the interface.

## Supported Markdown

Markdown works in cards and in the important note. Source text is stored unchanged and rendered only for display.

- Headings from `# Heading` through `###### Heading`
- Bold text: `**bold**` or `__bold__`
- Italic text: `*italic*` or `_italic_`
- Strikethrough text: `~~done~~`
- Inline code: `` `const value = 1` ``
- Fenced code blocks using three backticks
- Blockquotes: `> Quoted text`
- Bulleted lists using `-`, `+`, or `*`
- Numbered lists such as `1. First item`
- Interactive task lists:
  - `- [ ] Not completed`
  - `- [x] Completed`
- Links: `[OpenAI](https://openai.com)`
- Images: `![Description](https://example.com/image.png)`
- Tables with optional column alignment
- Horizontal rules using `---`, `***`, or `___`
- Paragraphs and line breaks

Table example:

```markdown
| Name | Link | Status |
| :--- | :--- | ---: |
| OpenAI | [Open](https://openai.com) | Ready |
```

Clicking a task-list checkbox updates `[ ]` to `[x]` (or back again) in the saved Markdown source and creates a card version.

Raw HTML is escaped rather than rendered. Links and images support only `http://` and `https://` URLs, including names and addresses containing underscores.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Application structure and metadata |
| `styles.css` | Layout, card styles and responsive behavior |
| `app.js` | UI, Markdown rendering, IndexedDB and history logic |
| `favicon.svg` | Browser tab icon |
| `Dockerfile` | Static nginx image |
