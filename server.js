const WebSocket = require("ws");
const http = require("http");

// Definimos el puerto dinámico asignado por Railway
const PORT = process.env.PORT || 80;

// Creamos el servidor HTTP (Railway maneja HTTPS automáticamente)
const server = http.createServer();

// Creamos el servidor WebSocket sobre el servidor HTTP
const wss = new WebSocket.Server({ server });

let devices = [];

wss.on("connection", (ws) => {
  console.log("Un cliente se ha conectado");

  // Asignamos un ID único a cada dispositivo
  const deviceId = `device-${Date.now()}`;
  const peerId = `peer-${deviceId}`;
  
  devices.push({ deviceId, ws }); // Guardamos la referencia al WebSocket junto con el deviceId

  // Enviar la lista de dispositivos conectados junto con su peerId
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "update-devices",
          devices: devices.map((d) => ({ peerId: d.deviceId })), // Enviamos el peerId en lugar del deviceId
        })
      );
    }
  });

  // Enviar un mensaje de "peer-joined" a todos los clientes con el nuevo peerId
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "peer-joined",
          peerId, // Incluimos el peerId en el mensaje
          peer: deviceId, // Pasamos también el deviceId
        })
      );
    }
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "send-file") {
        console.log("Recibiendo archivo...");
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({ type: "receive-file", fileData: data.fileData })
            );
          }
        });
      }
    } catch (error) {
      console.error("Error procesando mensaje:", error);
    }
  });

  ws.on("close", () => {
    console.log("Un cliente se ha desconectado");
    // Eliminamos el dispositivo de la lista de dispositivos
    devices = devices.filter((device) => device.deviceId !== deviceId);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "update-devices",
            devices: devices.map((d) => ({ peerId: d.deviceId })), // Enviamos el peerId actualizado
          })
        );
      }
    });
  });
});

// Inicia el servidor HTTP y WebSocket
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
