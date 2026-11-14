# User guide

Out Of Space scans a folder and draws its contents as a treemap: every file is a rectangle, and the bigger the file, the bigger the rectangle. This guide describes the interface as it is.

The screenshots show a generated demo folder, not real data, and were taken on macOS. [Regenerating the screenshots](#regenerating-the-screenshots) explains how they are made.

## Opening a folder

The app starts with one button. **Open Folder** shows the system folder dialog, and choosing a folder starts the scan at once. While the scan runs, the window shows how many entries it has found and the path it is working on.

| Start | Scan in progress |
|---|---|
| ![Welcome screen with the Open Folder button](user-guide/welcome.png) | ![Scan in progress: entry count and current path](user-guide/scanning.png) |

What the scan counts:

- **Size** is the length of each file as the file system reports it. A folder's size is the sum of the files below it.
- **Symbolic links** are skipped, so nothing is counted twice through a link and a link cycle cannot trap the scan.
- **Folders that cannot be read** appear empty. The app shows no message about them.

## The main window

![The scanned demo folder](user-guide/overview.png)

From top to bottom:

| Part | What it holds |
|---|---|
| Header | The app name and the colour palette menu. |
| Root bar | **Open**, **Rescan**, and the path of the folder in view. |
| Selection bar | The selected item as a trail of names, and the buttons that act on it. |
| Treemap | The folder in view. |
| Status bar | One line of context: a hint, a path or a size. |

## Reading the treemap

- **Area is size.** A file's rectangle is proportional to its size within the folder in view.
- **Folders are frames.** A folder is the rectangle around its contents; only a thin border of it shows. Its files sit together inside that frame, so a folder reads as one block whatever mix of file types it holds. The border's shade changes with depth, over three levels.
- **Colour is file type**, taken from the file extension:

  | Type | Extensions |
  |---|---|
  | Code | ts, tsx, js, jsx, vue, py, rb, go, rs, java, c, cpp, h, hpp, cs, swift, kt, php, sh, zsh, bash, css, scss, less, html, svg, sql |
  | Image | png, jpg, jpeg, gif, webp, ico, bmp, tiff |
  | Document | pdf, md, txt, doc, docx, rtf, odt |
  | Archive | zip, tar, gz, bz2, xz, rar, 7z, dmg |
  | Media | mp4, mkv, avi, mov, mp3, wav, flac, ogg, m4a, aac |
  | Config | json, yaml, yml, toml, xml, ini, env |
  | Data | csv, tsv, parquet, sqlite, db |
  | Other | everything else |

- **Names** appear on files whose rectangle is at least about 40 by 16 points. Folders carry no name.
- **Very small items are not drawn.** Anything that would cover less than 16 square points is left out, which shows as empty folder background. Drilling into the folder gives its contents more room.

## Pointing and selecting

Moving the pointer over a rectangle shows a tooltip with its name, type and size. The status bar shows its full path.

![Tooltip over a file, path in the status bar](user-guide/hover.png)

A click selects. The selected rectangle gets an outline, and the selection bar shows where it sits below the folder in view. Clicking one of the earlier names in that trail selects that folder.

![A selected file](user-guide/selection-file.png)

The buttons on the right act on the selection:

| Button | Shown for | What it does |
|---|---|---|
| **Reveal** | any selection | Shows the item in the system's file manager: Finder on macOS, Explorer on Windows. |
| **Terminal** | folders | Opens a terminal in that folder: Terminal on macOS, a Command Prompt on Windows. |
| **Drill Into** | folders | Makes that folder the one in view. |
| **Select Parent** | anything but the scanned folder itself | Moves the selection to the enclosing folder. |

Resting the pointer on a button explains it in the status bar.

![A selected folder, with the pointer on Drill Into](user-guide/selection-directory.png)

The status bar shows one thing at a time, in this order: the hint for the button under the pointer, the path of the item a context menu is open for, the path of the item under the pointer, the size of the selection.

## Moving through folders

**Into a folder**, three ways:

- Select the folder and click **Drill Into**. To select a folder, click a file inside it and use **Select Parent**.
- Select the folder and press Cmd+Down.
- Double-click the folder's border.

**Back out:**

- **Up** in the root bar moves one level. It appears only below the scanned folder.
- The names in the root bar's path are links. The grey part is the scanned folder; each name after it jumps to that level.
- Cmd+Up moves one level.

![Two levels down, inside video-course/assets](user-guide/drilled.png)

**Rescan** reads the scanned folder again. **Open** scans a different one. During a scan the previous picture stays visible under an overlay and both buttons are disabled. When the scan finishes, the view returns to the top of the scanned folder and the selection is cleared.

![Rescan in progress](user-guide/rescan.png)

## Context menu

A right-click on a rectangle opens a menu for that item. It acts on the item under the pointer, not on the selection, and leaves the selection as it is.

![Context menu on a folder](user-guide/context-menu.png)

- **Reveal in File Manager** does what the **Reveal** button does.
- **Open Terminal Here** does what the **Terminal** button does. Files don't have this entry.

The entries name no particular program, because the app runs on Windows as well as on macOS.

Escape, or a click anywhere else, closes the menu.

## Keyboard

| Key | With a selection | Without a selection |
|---|---|---|
| Arrow Down | Selects the largest item inside the selected folder. | Selects the largest item in view. |
| Arrow Up | Selects the enclosing folder. Stops at the folder in view. | Selects the folder in view. |
| Arrow Right | Selects the next smaller item in the same folder; after the smallest comes the largest. | Selects the largest item in view. |
| Arrow Left | Selects the next larger item in the same folder; before the largest comes the smallest. | Selects the folder in view. |
| Cmd+Down | Drills into the selected folder. | |
| Cmd+Up | Moves the view up one level. | Same. |
| Escape | Closes the context menu. | Same. |

Ctrl works in place of Cmd.

## Appearance

The window follows the system's light or dark appearance.

![Light appearance](user-guide/light.png)

The treemap has its own colours, chosen in the palette menu in the header. There are four palettes; the choice lasts until the app quits. The same folder in each:

| | |
|---|---|
| ![Solarized palette](user-guide/palette-solarized.png) | ![Legacy palette](user-guide/palette-legacy.png) |
| ![First HSL Radial palette](user-guide/palette-hslRad8_1.png) | ![Second HSL Radial palette](user-guide/palette-hslRad9_1.png) |

## Window and menus

- **One window**, 1200 by 800 points at start, at least 800 by 600.
- **The menu bar is Electron's standard one.** It has no entries of the app's own, so opening a folder and rescanning are available only as buttons.
- **About Out Of Space**, in the application menu, shows the version together with the commit and the build time.
- **Closing the window does not quit the app** on macOS. A click on the Dock icon opens a new, empty window. On Windows, closing the window quits.

## Regenerating the screenshots

```sh
npm run build
node docs/user-guide/capture.mts /Users/Shared/Projects
```

[`capture.mts`](user-guide/capture.mts) generates the demo folder at the given path, drives the built app with Playwright's Electron driver, writes the pictures next to itself and removes the folder again. The path must not exist beforehand. It appears in the pictures, so pick a neutral one.

- The demo files are sparse, so the folder takes almost no disk space.
- For the two pictures of a running scan, the script slows file access down; the scan would otherwise be over before the picture is taken. What the app shows is unchanged by that.
- The folder dialog, the menu bar and the window frame are drawn by macOS and are not in the pictures.
