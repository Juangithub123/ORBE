# ORBE: manda los esqueletos del Kinect al juego en cada cuadro.
# Pegar todo este texto en un Execute DAT (con "Frame End" activado).
# Toma todos los canales del CHOP "kinect_orbe" (el Kinect CHOP, o un Select/Null después de él)
# y los manda como JSON: {"canales": {"p1/spine:u": 0.51, ...}} a cada juego conectado.

import json

CHOP = 'kinect_orbe'
SERVIDOR = 'servidor_orbe'

def onFrameEnd(frame):
	servidor = op(SERVIDOR)
	chop = op(CHOP)
	if servidor is None or chop is None:
		return
	clientes = servidor.fetch('clientes', [], storeDefault=True)
	if not clientes:
		return
	canales = {c.name: round(float(c[0]), 4) for c in chop.chans()}
	mensaje = json.dumps({'canales': canales})
	for cliente in list(clientes):
		try:
			servidor.webSocketSendText(cliente, mensaje)
		except Exception:
			clientes.remove(cliente)
	return
