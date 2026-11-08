# ORBE: manda los esqueletos del Kinect al juego.
# Pegar todo este texto en un Execute DAT (con "Frame End" activado).
# Toma los canales del CHOP "kinect_orbe" (el Kinect CHOP, o un Select/Null después de él) y los manda como
# JSON: {"canales": {"p1/spine1:tx": 0.51, ...}} a cada juego conectado.
#
# Para pesar poco (TouchDesigner y el juego comparten la CPU):
# - solo manda cuando cambió algo (y cada medio segundo igual): el Kinect da 30 cuadros por segundo y
#   TouchDesigner suele ir a 60;
# - no manda los jugadores vacíos (todo en cero: el Kinect v1 reserva 6 lugares y sigue a 2).

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
	valores = {c.name: round(float(c[0]), 3) for c in chop.chans()}
	# Jugadores con algún valor distinto de cero (p1, p2…).
	con_datos = {nombre.split('/')[0].split(':')[0].split('_')[0] for nombre, v in valores.items() if v != 0}
	canales = {n: v for n, v in valores.items() if n.split('/')[0].split(':')[0].split('_')[0] in con_datos}
	mensaje = json.dumps({'canales': canales}, separators=(',', ':'))
	# Igual que el anterior: no se manda, salvo cada medio segundo (para que el juego sepa que sigue andando).
	ahora = absTime.seconds
	if mensaje == servidor.fetch('ultimo', '', storeDefault=True) and ahora - servidor.fetch('ultimoT', 0, storeDefault=True) < 0.5:
		return
	servidor.store('ultimo', mensaje)
	servidor.store('ultimoT', ahora)
	for cliente in list(clientes):
		try:
			servidor.webSocketSendText(cliente, mensaje)
		except Exception:
			clientes.remove(cliente)
	return
