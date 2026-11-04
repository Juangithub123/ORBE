import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { CSS, PALETA } from '../palette';
import { ESTILOS } from '../ui/text';
import { crearRun } from '../game/RunState';
import { cambiarResolucion, mantenerPantallaEncendida } from '../pantalla';
import { datosDeEsteDispositivo, elegirPerfil, perfilActual, perfilRecomendado, type Perfil } from '../perfil';
import { ESCENAS, clicable, getInput, getNiveles, setRun, mostrarCamara } from './shared';
import { audio } from '../audio/AudioEngine';

// Pantalla de inicio: se elige el modo (liviano o completo) y ese clic arranca el juego.
// Los navegadores piden un gesto del usuario para iniciar el audio, la pantalla completa y la cámara.
// La cámara (permiso y modelo) carga en segundo plano: se pasa al menú enseguida y ahí se ve cómo va.
// ?perfil=liviano|completo preselecciona un modo (para probar sin tocar la pantalla).

const MODOS: { perfil: Perfil; titulo: string; detalle: string; tecla: string }[] = [
  {
    perfil: 'liviano',
    titulo: 'Modo liviano',
    detalle: 'Celulares y tablets\nmás fluido, menos efectos',
    tecla: '1',
  },
  {
    perfil: 'completo',
    titulo: 'Modo completo',
    detalle: 'Computadoras\nbrillo, más resolución y pose más precisa',
    tecla: '2',
  },
];
const ANCHO_CAJA = 460;
const ALTO_CAJA = 160;

export class StartScene extends Phaser.Scene {
  private arrancando = false;

  constructor() {
    super(ESCENAS.inicio);
  }

  create() {
    mostrarCamara(this, false);
    this.arrancando = false;
    const cx = CONFIG.ancho / 2;
    const recomendado = perfilRecomendado(datosDeEsteDispositivo());
    const pedido = new URLSearchParams(location.search).get('perfil');
    // Preseleccionado: el de la URL, el último elegido o el recomendado.
    const marcado: Perfil = pedido === 'liviano' || pedido === 'completo' ? pedido : getInput(this).config.perfil === 'auto' ? recomendado : perfilActual();

    this.add.text(cx, 150, 'ORBE', ESTILOS.titulo).setOrigin(0.5);
    this.add.text(cx, 270, 'Elegí el modo para este dispositivo', ESTILOS.subtitulo).setOrigin(0.5);

    const g = this.add.graphics();
    MODOS.forEach((m, i) => {
      const x = cx + (i === 0 ? -1 : 1) * (ANCHO_CAJA / 2 + 30);
      const y = 430;
      const esMarcado = m.perfil === marcado;
      g.lineStyle(esMarcado ? 4 : 2, PALETA.orbe, esMarcado ? 1 : 0.5);
      g.strokeRoundedRect(x - ANCHO_CAJA / 2, y - ALTO_CAJA / 2, ANCHO_CAJA, ALTO_CAJA, 16);
      this.add.text(x, y - 42, `${m.titulo}  [${m.tecla}]`, ESTILOS.boton).setOrigin(0.5);
      this.add.text(x, y + 22, m.detalle, { ...ESTILOS.ayuda, align: 'center', color: CSS.blanco }).setOrigin(0.5);
      if (m.perfil === recomendado) {
        this.add.text(x, y + ALTO_CAJA / 2 + 22, 'recomendado para este dispositivo', { ...ESTILOS.ayuda, color: CSS.meta }).setOrigin(0.5);
      }
      // pointerdown (no pointerup): así el mismo toque activa la pantalla completa, el audio y la cámara.
      const zona = this.add.zone(x, y, ANCHO_CAJA, ALTO_CAJA).setInteractive({ useHandCursor: true });
      zona.on('pointerdown', () => this.arrancar(m.perfil));
    });

    clicable(
      this.add.text(cx, CONFIG.alto - 40, 'Tocá un modo · [1] liviano · [2] completo · [Enter] el marcado', ESTILOS.ayuda).setOrigin(0.5),
      () => this.arrancar(marcado),
    );

    const kb = this.input.keyboard;
    kb?.on('keydown-ONE', () => this.arrancar('liviano'));
    kb?.on('keydown-TWO', () => this.arrancar('completo'));
    kb?.on('keydown-ENTER', () => this.arrancar(marcado));
    kb?.on('keydown-SPACE', () => this.arrancar(marcado));
  }

  private arrancar(perfilElegido: Perfil) {
    if (this.arrancando) return;
    this.arrancando = true;

    // Tiene que ser acá, durante el clic o la tecla: el navegador solo deja sonar después de un gesto.
    audio.iniciar();
    const input = getInput(this);
    if (input.config.pantallaCompleta && !this.scale.isFullscreen) {
      try {
        this.scale.startFullscreen();
      } catch {
        // Si el navegador no deja, se sigue en ventana.
      }
    }
    // Se juega con el cuerpo, sin tocar la pantalla: que la tablet no se apague sola.
    mantenerPantallaEncendida();

    // El perfil cambia la resolución automática: si cambió, el canvas se rehace antes del menú.
    const cambio = perfilElegido !== perfilActual();
    elegirPerfil(perfilElegido);
    input.aplicarAjustes({ perfil: perfilElegido });
    if (cambio) cambiarResolucion(this.game, input.config.resolucion);

    input.start();

    // Depuración: ?nivel=2 arranca directo en ese nivel con un dúo de prueba.
    const nivel = Number(new URLSearchParams(location.search).get('nivel'));
    if (nivel >= 1 && nivel <= getNiveles(this).length) {
      setRun(this, { ...crearRun('PRUEBA'), nivel: nivel - 1, prueba: true });
      this.scene.start(ESCENAS.juego);
      return;
    }

    this.scene.start(ESCENAS.menu);
  }
}
