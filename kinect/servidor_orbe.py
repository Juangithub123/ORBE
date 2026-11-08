# ORBE: callbacks del Web Server DAT (servidor WebSocket para el juego).
# Pegar todo este texto en el DAT de callbacks del Web Server DAT (el que se crea junto a él,
# por ejemplo "webserver1_callbacks"). Solo lleva la cuenta de qué juegos están conectados:
# los esqueletos los manda enviar_esqueletos.py en cada cuadro.

def onWebSocketOpen(webServerDAT, client, uri):
	clientes = webServerDAT.fetch('clientes', [], storeDefault=True)
	if client not in clientes:
		clientes.append(client)
	debug('ORBE: se conectó el juego', client)
	return

def onWebSocketClose(webServerDAT, client):
	clientes = webServerDAT.fetch('clientes', [], storeDefault=True)
	if client in clientes:
		clientes.remove(client)
	debug('ORBE: se desconectó el juego', client)
	return

def onWebSocketReceiveText(webServerDAT, client, data):
	return

def onWebSocketReceiveBinary(webServerDAT, client, data):
	return

def onWebSocketReceivePing(webServerDAT, client, data):
	webServerDAT.webSocketSendPong(client, data=data)
	return

def onWebSocketReceivePong(webServerDAT, client, data):
	return

def onHTTPRequest(webServerDAT, request, response):
	response['statusCode'] = 200
	response['statusReason'] = 'OK'
	response['data'] = 'ORBE: servidor del Kinect andando. El juego se conecta por WebSocket a este mismo puerto.'
	return response

def onServerStart(webServerDAT):
	webServerDAT.store('clientes', [])
	return

def onServerStop(webServerDAT):
	webServerDAT.store('clientes', [])
	return
