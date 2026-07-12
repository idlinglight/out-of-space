import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc-channels'
import {
  handleSelectFolder,
  handleScanFolder,
  handleShowInFinder,
  handleOpenInTerminal
} from './ipc-handlers'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Out Of Space',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Open links in the system browser instead of spawning new Electron windows
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' } // deny = don't create an Electron window
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Build identity in "Out Of Space" → "About": marketing version plus
  // git describe + build time in the parenthesized CFBundleVersion slot,
  // so a smoke tester can tell which build is running (issue #49)
  app.setAboutPanelOptions({
    applicationName: 'Out Of Space',
    applicationVersion: app.getVersion(),
    version: `${__GIT_SHA__}, built ${__BUILD_TIME__}`
  })

  ipcMain.handle(IpcChannels.SELECT_FOLDER, handleSelectFolder)
  ipcMain.handle(IpcChannels.SCAN_FOLDER, handleScanFolder)
  ipcMain.handle(IpcChannels.SHOW_IN_FINDER, handleShowInFinder)
  ipcMain.handle(IpcChannels.OPEN_IN_TERMINAL, handleOpenInTerminal)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
