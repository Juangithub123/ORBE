// Abre la ventana de control (la misma página con ?control). En la web es una ventana emergente; en la
// versión de escritorio la abre Electron como una segunda ventana en la pantalla principal (no en la del
// proyector). Si ya está abierta, la trae al frente.

export function abrirVentanaControl() {
  const url = new URL(location.href);
  url.search = '?control';
  url.hash = '';
  const ventana = window.open(url.toString(), 'orbe-control', 'popup,width=1200,height=860');
  ventana?.focus();
}
