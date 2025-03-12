const WebSocket = require("ws");
const http = require("http");
const { uniqueNamesGenerator } = require("unique-names-generator");

const colores = [
  "Rojo",
  "Verde",
  "Azul",
  "Amarillo",
  "Naranja",
  "Rosa",
  "Morado",
  "Feliz",
  "Marrón",
  "Gris",
];

const animales = [
  "Perro",
  "Gato",
  "Pájaro",
  "Elefante",
  "Tigre",
  "León",
  "Zorro",
  "Rana",
  "Serpiente",
  "Caballo",
];

function hashCode(str) {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash;
}

function generateName(seed) {
  if (!seed) {
    seed = "defaultSeed";
  }

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

let devices = [];

wss.on("connection", (ws) => {
  console.log("Un cliente se ha conectado");

  const deviceId = `device-${Date.now()}`;
  const { displayName, deviceName } = generateName(deviceId);

  ws.isAlive = true;
  ws.deviceId = deviceId;
  ws.displayName = displayName;
  ws.deviceName = deviceName;

  devices.push({ deviceId, ws, displayName, deviceName });

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "update-devices",
          devices: devices.map((d) => ({
            peerId: d.deviceId,
            displayName: d.displayName,
            deviceName: d.deviceName,
          })),
        })
      );
    }
  });

  ws.send(
    JSON.stringify({
      type: "display-name",
      displayName: displayName,
    })
  );

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "peer-joined",
          peerId: deviceId,
          displayName: displayName,
          deviceName: deviceName,
        })
      );
    }
  });

  ws.on("message", (message) => {
    console.log('Mensaje recibido en el servidor:', message)
    try {
      const data = JSON.parse(message);

      if (data.type === "send-file") {
        console.log("Recibiendo archivo...");

        // Identificar el peer al que se le enviará el archivo
        const recipientPeer = devices.find(
          (device) => device.deviceId === data.peerId
        );

        console.log("recipientPeer:", recipientPeer); // Verifica si está encontrando el peer
        console.log(
          "readyState de recipientPeer.ws:",
          recipientPeer.ws.readyState
        ); // Verifica el estado

        if (recipientPeer && recipientPeer.ws.readyState === WebSocket.OPEN) {
          // Verificar si data.fileData es un Buffer o ArrayBuffer
          const buffer = Buffer.isBuffer(data.fileData)
            ? data.fileData
            : Buffer.from(data.fileData); // Convierte el archivo en un Buffer si no lo es

          // Enviar el archivo al peer de destino como Buffer
          recipientPeer.ws.send(buffer, (error) => {
            if (error) {
              console.error("Error al enviar archivo al peer:", error);
            } else {
              console.log("Archivo enviado al Peer");
            }
          });
        }
      }
    } catch (error) {
      console.error("Error procesando mensaje:", error);
    }
  });


  ws.on("close", () => {
    console.log("Un cliente se ha desconectado");
    devices = devices.filter((device) => device.deviceId !== deviceId);

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "peer-left",
            peerId: deviceId,
          })
        );
      }
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "update-devices",
            devices: devices.map((d) => ({
              peerId: d.deviceId,
              displayName: d.displayName,
              deviceName: d.deviceName,
            })),
          })
        );
      }
    });
  });
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log(`Cliente ${ws.deviceId} no responde. Desconectando...`);
      ws.terminate();
      devices = devices.filter((device) => device.deviceId !== ws.deviceId);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "peer-left",
              peerId: ws.deviceId,
            })
          );
        }
      });
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 5000);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
