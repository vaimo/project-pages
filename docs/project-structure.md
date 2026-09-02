# Project Structure

```
project-pages/
├── app/
│   ├── layout.tsx                     # Root layout: sidebar + top nav
│   ├── page.tsx                       # Home / index page
│   ├── auth/
│   │   ├── signin/page.tsx            # Passphrase login form
│   │   └── error/page.tsx             # Auth error page
│   ├── view/
│   │   └── [...path]/page.tsx         # Dynamic route for any file path
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── content/
│       │   ├── tree/route.ts          # Filtered file tree for the session branch
│       │   └── file/route.ts          # File metadata + content
│       ├── download/
│       │   ├── route.ts               # Raw file download
│       │   ├── with-comments/route.ts # File + embedded comments
│       │   └── with-media/route.ts    # Markdown + images as ZIP
│       ├── raw/route.ts               # Image proxy (for Markdown inline images)
│       ├── comments/
│       │   ├── route.ts               # GET + POST comments
│       │   └── [id]/route.ts          # PATCH + DELETE comments
│       └── webhook/
│           └── github/route.ts        # GitHub push webhook handler
│
├── components/
│   ├── Sidebar.tsx                # Nav tree: pretty-names, auto-expand, drag-resize
│   ├── TopNav.tsx                 # Logo + site title + branch switcher + sign out
│   ├── BranchSwitcher.tsx         # Searchable branch dropdown
│   ├── FileView/
│   │   ├── MarkdownView.tsx
│   │   ├── Frontmatter.tsx        # YAML frontmatter "At a glance" block
│   │   ├── MermaidBlock.tsx       # Inline diagram + fullscreen zoom overlay
│   │   ├── OutlinePanel.tsx       # Hover-to-expand headings panel
│   │   ├── CsvView.tsx
│   │   ├── ImageView.tsx
│   │   ├── ExcalidrawView.tsx
│   │   └── SubtitleView.tsx
│   ├── Comments/
│   │   ├── CommentPanel.tsx
│   │   ├── CommentThread.tsx
│   │   └── CommentForm.tsx
│   ├── DownloadButton.tsx
│   ├── ExcalidrawPngButton.tsx
│   ├── ConfigError.tsx
│   ├── SectionTabs.tsx
│   └── ClientLayout.tsx
│
├── lib/
│   ├── github.ts          # GitHub API client, config loader (with local override + branch discovery)
│   ├── supabase.ts        # Supabase client, comment CRUD
│   ├── config.ts          # projectpages.config parser + glob filter + discoverBranches flag
│   ├── auth.ts            # NextAuth options (per-user-group passphrase, env override, DEV_AUTH_BYPASS)
│   ├── nav.ts             # File tree → sidebar nav builder
│   ├── markdown.ts        # Markdown + frontmatter (gray-matter) + comment annotation
│   ├── chat.ts            # LightRAG chat backend adapter
│   └── docx.ts            # DOCX preview support
│
├── types/
│   └── next-auth.d.ts     # Session type extension (branchName, userGroupName, accessibleBranches)
│
├── app/globals.css        # Palette tokens, prose styles, editorial fonts wired via next/font
│
├── public/
│   ├── vaimo-logo-dark.png      # Dark wordmark + ochre X — top nav
│   ├── vaimo-logo-white.svg     # White logo — sign-in cover
│   ├── vaimo-logo.svg           # Legacy (white fill, keep for reference)
│   ├── vaimo-logo.webp          # Legacy raster
│   ├── vaimo-logo-white.png     # Legacy raster
│   └── google-mark.svg          # Google sign-in button
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_add_branch_to_comments.sql
│
├── docs/                  # This documentation
│
├── projectpages.config.example   # Config template for knowledge-base repos
├── .env.local.example
├── vercel.json
└── package.json
```

## Key Files

| File | Purpose |
|---|---|
| `lib/config.ts` | Parses `projectpages.config` YAML; defines `ParsedConfig`, `ParsedBranch` types; carries `discoverBranches` flag |
| `lib/github.ts` | All GitHub API calls; per-branch content fetching; local-config override via `PROJECTPAGES_LOCAL_CONFIG`; auto-branch discovery when `discoverBranches: true` |
| `lib/auth.ts` | NextAuth options; per-user-group passphrase matching with `PROJECTPAGES_PASSPHRASE_<GROUP>` env override; optional `DEV_AUTH_BYPASS`; stores `userGroupName` + `branchName` + `accessibleBranches` in the JWT |
| `lib/markdown.ts` | Markdown pipeline (remark → rehype → highlight). Parses YAML frontmatter via `gray-matter` and returns it separately from the rendered HTML |
| `lib/supabase.ts` | Comment CRUD; all queries are scoped by `(file_path, branch)` |
| `components/FileView/Frontmatter.tsx` | Renders parsed frontmatter as the "At a glance" block |
| `components/FileView/MermaidBlock.tsx` | Mermaid rendering + fullscreen zoom overlay + per-participant colouring |
| `components/BranchSwitcher.tsx` | Searchable dropdown of accessible branches |
| `types/next-auth.d.ts` | Extends `Session` with `branchName`, `userGroupName`, `accessibleBranches` |
