# Content Rendering

## File Types

| Extension | Rendering |
|---|---|
| `.md`, `.mdx` | HTML via `remark` + `rehype` pipeline. Supports GFM (tables, task lists, strikethrough). Code blocks get syntax highlighting. |
| `.csv` | Sortable, filterable table (client-side, via TanStack Table). All columns sortable. A search input filters rows client-side. |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg` | Displayed inline as a full-width image with a download button. |
| `.docx`, `.vtt`, `.srt`, and all others | File detail page with metadata (name, size, last commit, last updated date) and a prominent download button. No preview. |

## File Metadata

Each file page shows:
- File name and path (breadcrumb)
- Last commit message that touched this file
- Last updated date (from GitHub commit history)
- Author of the last commit
- File size
- Download button

## Markdown Rendering Details

- Headings automatically generate anchor links.
- External links open in a new tab.
- Images referenced in Markdown are proxied through `/api/raw?path=...` so they respect the GitHub token for private repos.
- Comment references are injected at render time when comments exist (see [Comments](./comments.md)).
- **YAML frontmatter** at the top of a Markdown file is parsed out of the body and rendered above the article as an editorial "At a glance" block — serif title, italic description, metadata grid (with tag chips and formatted dates), and full-width sections for long arrays like `related` or `applies_to`. A leading `# Title` in the body that matches `title:` in the frontmatter is stripped so the title isn't rendered twice.
- **Mermaid diagrams** (` ```mermaid ` code blocks) render inline with two controls: **Source** flips to the raw code, **Zoom** opens a fullscreen overlay with wheel-zoom, drag-pan, and Escape-to-close. Actors in sequence diagrams and nodes in flowcharts are auto-coloured with a per-participant palette so multi-actor diagrams read at a glance.

## Navigation

### Layout

```
┌─────────────────────────────────────────────────────┐
│  [Vaimo Logo]   Site Title          [Sign out]       │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  Sidebar     │  Content Area                        │
│  (nav tree)  │                                      │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

### Sidebar

- Built from the filtered file tree (config `include`/`exclude` rules applied to the authenticated branch).
- Folder names are collapsible groups; the folder(s) containing the currently-viewed file auto-expand on load.
- Files and folders are pretty-named: `.md` extensions are stripped and `_`/`-`/`.` become spaces (`returns_lifecycle.md` → "Returns Lifecycle"). Words already containing uppercase are preserved so acronyms like `SAP` and `ECOM_FRONTEND` survive.
- The active file gets a full ochre-tint band, thicker accent border, and a checkmark; the sidebar auto-scrolls it into view.
- Folder rows are visually heavier than file rows so the hierarchy is easy to scan.
- The sidebar is drag-resizable via the right-hand grip.
- On mobile, the sidebar collapses to a hamburger menu.

### Home / Index Page

If the docs repo contains a `README.md` or `index.md` at the root (within the included paths), it is rendered as the landing page. Otherwise, the landing page shows cards for all exposed top-level folders and files.
