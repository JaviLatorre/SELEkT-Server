const WebSocket = require("ws");
const https = require("https");
const fs = require("fs");

// Definimos el puerto dinámico asignado por Railway
const PORT = process.env.PORT || 8080;

// Creamos un servidor HTTPS (pero Railway ya gestiona esto automáticamente en su dominio)
const server = https.createServer({
  // Si estuvieras utilizando un certificado SSL propio, lo añadirías aquí
  // key: fs.readFileSync("path/to/your/private.key"),
  // cert: fs.readFileSync("path/to/your/certificate.crt"),
});

// Creamos el servidor WebSocket, pero usando el servidor HTTPS
const wss = new WebSocket.Server({ server });

let devices = [];

wss.on("connection", (ws) => {
  console.log("Un cliente se ha conectado");

  // Asignamos un ID único al socket
  const deviceId = `device-${Date.now()}`;
  devices.push(deviceId);
  console.log("Dispositivos conectados:", devices);

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

// Iniciamos el servidor HTTPS
server.listen(PORT, () => {
  console.log(
    `Servidor WebSocket seguro escuchando en wss://localhost:${PORT}`
  );
});
