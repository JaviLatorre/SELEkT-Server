const WebSocket = require("ws");
const https = require("https");

// Definimos el puerto dinámico asignado por Railway
const PORT = process.env.PORT || 8080;

// Creamos el servidor HTTPS (esto debería estar bien configurado)
const server = https.createServer(); // Asegúrate de que se esté creando el servidor correctamente

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Un cliente se ha conectado");
});

// Iniciamos el servidor HTTPS
server.listen(PORT, () => {
  console.log(
    `Servidor WebSocket seguro escuchando en https://localhost:${PORT}`
  );
});
