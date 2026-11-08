// Punto de entrada. Con ?control en la dirección se abre la ventana de control del operador (parámetros,
// nombre, entrada y zona de juego, sin el juego); si no, el juego. Cada una se carga por separado, así la
// ventana de control no carga Phaser ni MediaPipe.

if (new URLSearchParams(location.search).has('control')) {
  void import('./control/VentanaControl').then((m) => m.iniciarVentanaControl());
} else {
  void import('./juego');
}
