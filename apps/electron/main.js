const { app, BrowserWindow } = require('electron')
const { spawn } = require('child_process')
const path = require('path')

let serverProcess = null
let webProcess = null
let mainWindow = null

function startServices() {
  const root = path.resolve(__dirname, '..', '..')
  
  serverProcess = spawn('pnpm', ['--filter', '@iomtea/server', 'dev'], {
    cwd: root, shell: true, stdio: 'pipe',
  })
  serverProcess.stdout.on('data', (d) => process.stdout.write(`[SERVER] ${d}`))
  serverProcess.stderr.on('data', (d) => process.stderr.write(`[SERVER] ${d}`))

  webProcess = spawn('pnpm', ['--filter', '@iomtea/web', 'dev'], {
    cwd: root, shell: true, stdio: 'pipe',
  })
  webProcess.stdout.on('data', (d) => process.stdout.write(`[WEB] ${d}`))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    title: 'IOMTea - 认知障碍老人监护系统',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  mainWindow.loadURL('http://localhost:5173')
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  startServices()
  setTimeout(createWindow, 8000)
})

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill()
  if (webProcess) webProcess.kill()
  app.quit()
})
