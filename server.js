const WebSocket = require("http");

// Definimos el puerto dinámico asignado por Render
const PORT = process.env.PORT || 8080;

// Creamos el servidor WebSocket
const wss = new WebSocket.Server({ port: PORT });

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

console.log(`Servidor WebSocket escuchando en el puerto ${PORT}`);
