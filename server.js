const WebSocket = require("ws");
const http = require("http");
const { uniqueNamesGenerator } = require("unique-names-generator");

const colores = ["Rojo", "Verde", "Azul", "Amarillo", "Naranja"];
const animales = ["Perro", "Gato", "Pájaro", "Elefante", "Tigre"];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  return hash;
}

function generateName(seed) {
  const displayName = uniqueNamesGenerator({
    length: 2,
    separator: " ",
    dictionaries: [animales, colores],
    style: "capital",
    seed: hashCode(seed),
  });

  return { displayName, deviceName: "Dispositivo" };
}

const PORT = process.env.PORT || 80;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

let rooms = {}; // Agrupar dispositivos por IP

wss.on("connection", (ws, req) => {
  console.log("Un cliente se ha conectado");

  // Obtener la IP del cliente
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  if (!rooms[ip]) {
    rooms[ip] = [];
  }

  const deviceId = `device-${Date.now()}`;
  const { displayName, deviceName } = generateName(deviceId);

  ws.isAlive = true;
  ws.deviceId = deviceId;
  ws.displayName = displayName;
  ws.deviceName = deviceName;
  ws.ip = ip;

  rooms[ip].push(ws);

  // Notificar a todos los dispositivos en la misma IP
  rooms[ip].forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "update-devices",
          devices: rooms[ip].map((d) => ({
            peerId: d.deviceId,
            displayName: d.displayName,
            deviceName: d.deviceName,
          })),
        })
      );
    }
  });

  ws.on("message", (message) => {
    try {
      if (Buffer.isBuffer(message)) {
        const separatorIndex = message.indexOf(125) + 1;
        if (separatorIndex === 0) return;

        const jsonString = message.slice(0, separatorIndex).toString("utf-8");
        const data = JSON.parse(jsonString);

        if (data.type === "send-file") {
          const fileBuffer = message.slice(separatorIndex);

          const recipient = rooms[ip].find((d) => d.deviceId === data.peerId);
          if (recipient && recipient.readyState === WebSocket.OPEN) {
            recipient.send(
              Buffer.concat([
                Buffer.from(
                  JSON.stringify({
                    type: "receive-file",
                    fileName: data.fileName,
                  })
                ),
                fileBuffer,
              ])
            );
          }
        }
      }
    } catch (error) {
      console.error("Error procesando mensaje:", error);
    }
  });

  ws.on("close", () => {
    console.log("Un cliente se ha desconectado");

    rooms[ip] = rooms[ip].filter((client) => client !== ws);

    rooms[ip].forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "peer-left",
            peerId: deviceId,
          })
        );
      }
    });

    if (rooms[ip].length === 0) {
      delete rooms[ip];
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
