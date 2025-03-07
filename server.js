const WebSocket = require("ws");
const https = require("https");

// Definimos el puerto dinámico asignado por Railway
const PORT = process.env.PORT || 8080;

// Creamos el servidor HTTPS vacío (Railway se encarga del certificado SSL)
const server = https.createServer();

// Creamos el servidor WebSocket sobre el servidor HTTPS
const wss = new WebSocket.Server({ server });

let devices = [];

// Cuando un cliente se conecta
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

  // Manejo de mensajes
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "send-file") {
        console.log("Recibiendo archivo...");
        // Reenviar el archivo a todos los clientes conectados
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

  // Manejo de desconexión
  ws.on("close", () => {
    console.log("Un cliente se ha desconectado");
    devices = devices.filter((id) => id !== deviceId);
    // Notificar la lista actualizada a los clientes conectados
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "update-devices", devices }));
      }
    });
  });
});

// Inicia el servidor HTTPS y mantiene la conexión abierta
server.listen(PORT, () => {
  console.log(
    `Servidor WebSocket seguro escuchando en wss://localhost:${PORT}`
  );
});
