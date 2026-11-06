// Puente entre el juego y la ventana de escritorio. El juego lo ve como window.orbeEscritorio
// (ver src/escritorio.ts); en la web no existe.

const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('orbe:info');
let pantallaCompleta = info.pantallaCompleta;
ipcRenderer.on('orbe:pantalla-completa', (_evento, completa) => {
  pantallaCompleta = completa;
});

contextBridge.exposeInMainWorld('orbeEscritorio', {
  kiosco: info.kiosco,
  version: info.version,
  plataforma: info.plataforma,
  estaEnPantallaCompleta: () => pantallaCompleta,
  ponerPantallaCompleta: (completa) => ipcRenderer.send('orbe:poner-pantalla-completa', completa),
  salir: () => ipcRenderer.send('orbe:salir'),
});
