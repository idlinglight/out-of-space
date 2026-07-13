# Goals — Out Of Space

High-level goals and progress tracking.

## Milestone Checklist

### Phase 0 — Scaffold
- [x] Project scaffold (README, DESIGN, GOALS, CLAUDE.md)
- [x] MIT License
- [x] Connect to GitHub remote

### Phase 1 — Tech Stack Setup
- [x] Initialise Electron + Vue 3 + D3 project
- [x] Build tooling configuration (electron-vite + electron-builder)
- [x] Dev workflow (hot reload, debugging)
- [x] Basic app window opens
- [x] TypeScript setup (3 tsconfigs, shared types)
- [x] Pinia store scaffold
- [x] Visualisation abstraction (treemap + sunburst stubs)

### Phase 2 — Core Features
- [x] Folder picker / drag-and-drop folder selection
- [x] Recursive directory scanning (async, off main thread)
- [x] Treemap visualisation with D3
- [x] Drill-down navigation (click into subdirectories)
- [x] Hover tooltips (file name, size, type)
- [x] "Show in Finder" context action
- [x] "Open in Terminal" context action

### Phase 3 — Polish
- [x] Progress indicator during scanning
- [x] Breadcrumb navigation
- [x] Keyboard navigation for selection (arrow keys)
- [x] Colour coding (by file type or directory depth)
- [x] Handle large trees gracefully (100k+ files)
- [x] Error handling (permission denied, broken symlinks)
- [x] Light/dark mode following OS preference (CSS custom properties)
- [x] App icon and basic branding

### Phase 4 — Release
- [x] macOS packaging (.dmg)
- [x] Signed + notarized builds via tag-gated CI (issue #55, docs/RELEASING.md)
- [x] GitHub release with binary (v0.1.0)
- [ ] README with screenshots and usage instructions
- [ ] Portfolio-ready state
