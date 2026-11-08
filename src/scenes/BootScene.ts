import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { PALETA } from '../palette';
import { InputManager } from '../input/InputManager';
import { cargarAjustes, guardarAjustes } from '../storage/settings';
import { ESCENAS, claveNivel } from './shared';

// Carga los recursos, lee los ajustes guardados y crea el InputManager (todavía sin cámara).

export class BootScene extends Phaser.Scene {
  constructor() {
    super(ESCENAS.boot);
  }

  preload() {
    const ancho = 480;
    const x = (CONFIG.ancho - ancho) / 2;
    const y = CONFIG.alto / 2;
    const barra = this.add.graphics();
    this.load.on('progress', (p: number) => {
      barra.clear();
      barra.lineStyle(2, PALETA.orbe, 0.6);
      barra.strokeRect(x, y - 6, ancho, 12);
      barra.fillStyle(PALETA.orbe, 1);
      barra.fillRect(x, y - 6, ancho * p, 12);
    });

    // Primero la lista de niveles; cuando llega, se encolan los .tmj en el orden de la lista.
    this.load.once('filecomplete-json-niveles', (_k: string, _t: string, lista: string[]) => {
      for (const archivo of lista) this.load.json(claveNivel(archivo), `levels/${archivo}`);
    });
    this.load.json('niveles', 'levels/niveles.json');
  }

  create() {
    // Textura chica y redonda para las partículas (roca rota, moneda).
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture('chispa', 16, 16);
    g.destroy();

    const ajustes = cargarAjustes();
    // ?entrada=pose | manos | kinect | teclado elige el modo de entrada y lo guarda
    // (útil en una tablet o en la instalación, donde no hay teclado para entrar a Ajustes).
    // ?kinect=servidor:puerto apunta a TouchDesigner en otro puerto (vacío: esta computadora, kinectPuerto).
    const params = new URLSearchParams(location.search);
    const entrada = params.get('entrada');
    if (entrada === 'pose' || entrada === 'manos' || entrada === 'teclado' || entrada === 'kinect') {
      ajustes.modoEntrada = entrada;
      guardarAjustes(ajustes);
    }
    if (params.has('kinect')) {
      ajustes.kinectServidor = params.get('kinect') ?? '';
      guardarAjustes(ajustes);
    }
    this.registry.set('ajustes', ajustes);
    this.registry.set('niveles', this.cache.json.get('niveles') as string[]);
    this.registry.set('input', new InputManager(ajustes));
    this.scene.start(ESCENAS.inicio);
  }
}
