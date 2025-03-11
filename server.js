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

// Diccionario de animales en español.
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
    hash |= 0; // Fuerza a que sea un entero de 32 bits
  }
  return hash;
}

// Función para generar un nombre basado en una semilla
function generateName(seed) {
  if (!seed) {
    seed = "defaultSeed"; // Usa un valor por defecto si no se proporciona uno
  }

  // Generar el displayName con la lógica proporcionada
  const displayName = uniqueNamesGenerator({
    length: 2,
    separator: " ",
    dictionaries: [animales, colores],
    style: "capital",
    seed: hashCode(seed),
  });

  const deviceName = getDeviceName(); // Nombre del dispositivo basado en User Agent
  return { displayName, deviceName };
}

// Función para obtener el nombre del dispositivo basado en el User Agent
function getDeviceName() {
  const ua = navigator.userAgent;
  if (ua.indexOf("Android") > -1) return "Dispositivo Android";
  if (ua.indexOf("iPhone") > -1 || ua.indexOf("iPad") > -1)
    return "Dispositivo iOS";
  if (ua.indexOf("Windows") > -1) return "PC con Windows";
  if (ua.indexOf("Mac") > -1) return "Mac";
  return "Dispositivo Desconocido";
}

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
  const { displayName, deviceName } = generateName(deviceId);

  devices.push({ deviceId, ws, displayName, deviceName }); // Guardamos la referencia al WebSocket junto con el deviceId y displayName

  // Enviar la lista de dispositivos conectados junto con su peerId
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

  // Enviar un mensaje de "peer-joined" a todos los clientes con el nuevo peerId y su displayName
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "peer-joined",
          peerId: deviceId, // Incluimos el peerId en el mensaje
          displayName: displayName, // Pasamos el displayName
          deviceName: deviceName, // Pasamos el deviceName
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

    // Notificar a todos los clientes que un peer se ha desconectado
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "peer-left", // Enviamos el tipo "peer-left"
            peerId: deviceId, // El peerId del cliente que se desconectó
          })
        );
      }
    });

    // También actualizar la lista de dispositivos conectados
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "update-devices",
            devices: devices.map((d) => ({
              peerId: d.deviceId,
              displayName: d.displayName,
              deviceName: d.deviceName,
            })), // Enviamos el peerId actualizado
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
