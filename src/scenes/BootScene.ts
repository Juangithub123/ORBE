import * as Phaser from 'phaser';
import { CONFIG } from '../config';
import { PALETA } from '../palette';
import { InputManager } from '../input/InputManager';
import { cargarAjustes } from '../storage/settings';
import { ESCENAS } from './shared';

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

    this.load.json('niveles', 'levels/niveles.json');
    // Fase 2: acá se cargan también los .tmj de cada nivel.
  }

  create() {
    const ajustes = cargarAjustes();
    this.registry.set('ajustes', ajustes);
    this.registry.set('niveles', this.cache.json.get('niveles') as string[]);
    this.registry.set('input', new InputManager(ajustes));
    this.scene.start(ESCENAS.inicio);
  }
}
