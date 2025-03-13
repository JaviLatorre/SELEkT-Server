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

  // Enviar el evento 'display-name' al dispositivo recién conectado
  ws.send(
    JSON.stringify({
      type: "display-name",
      displayName: ws.displayName
    })
  );

  // Notificar a todos los dispositivos en la misma IP sobre el nuevo dispositivo
  rooms[ip].forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== ws) {
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

  // Enviar el evento 'peer-joined' a todos los dispositivos en la IP
  setTimeout(() => {
    console.log("Ejecutando peer-joined para la IP:", ip);
    console.log(
      "Dispositivos en rooms[ip]:",
      rooms[ip].map((d) => d.deviceId)
    );

    rooms[ip].forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "peer-joined",
            peerId: ws.deviceId,
            displayName: ws.displayName,
            deviceName: ws.deviceName,
          })
        );
      }
    });
  }, 100);

  // Mantener las conexiones vivas
  ws.on("pong", () => {
    ws.isAlive = true;
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

  // Escuchar cuando un cliente se desconecta
  ws.on("close", () => {
    console.log("Un cliente se ha desconectado");

    rooms[ip] = rooms[ip].filter((client) => client !== ws);

    // Notificar a los demás dispositivos sobre la desconexión del peer
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

    // Si no quedan más dispositivos en la IP, eliminar la sala
    if (rooms[ip].length === 0) {
      delete rooms[ip];
    }
  });

  // Enviar un ping cada 30 segundos para mantener la conexión
  const interval = setInterval(() => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping(() => {});
  }, 30000);

  ws.on("close", () => {
    clearInterval(interval);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
