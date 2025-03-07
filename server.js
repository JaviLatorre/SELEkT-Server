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

  const deviceId = `device-${Date.now()}`;
  devices.push(deviceId);

  // Enviar la lista de dispositivos conectados
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "update-devices", devices }));
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
    devices = devices.filter((id) => id !== deviceId);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "update-devices", devices }));
      }
    });
  });
});

// Inicia el servidor HTTP y WebSocket
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
