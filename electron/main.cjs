const { app, BrowserWindow, Menu, nativeTheme } = require("electron");
const path = require("path");

function createWindow() {
  nativeTheme.themeSource = "dark";
  Menu.setApplicationMenu(null);

  const isDev = !app.isPackaged;

  const win = new BrowserWindow({
    width: 540,
    height: 900,
    minWidth: 400,
    minHeight: 600,
    backgroundColor: "#060d09",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
