wss.on("connection", (ws) => {
  console.log("Un cliente se ha conectado");

  // Asignamos un ID único a cada dispositivo
  const deviceId = `device-${Date.now()}`;
  const { displayName, deviceName } = generateName(deviceId);

  // Guardamos la referencia al WebSocket junto con el deviceId y displayName
  devices.push({ deviceId, ws, displayName, deviceName });

  // Enviar la lista de dispositivos conectados al cliente que se acaba de conectar
  ws.send(
    JSON.stringify({
      type: "update-devices",
      devices: devices.map((d) => ({
        peerId: d.deviceId,
        displayName: d.displayName,
        deviceName: d.deviceName,
      })),
    })
  );

  // Enviar el displayName al cliente que se acaba de conectar
  ws.send(
    JSON.stringify({
      type: "display-name", // Tipo de mensaje que indica el nombre
      displayName: displayName, // Nombre generado
    })
  );

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

  // Cuando el cliente envía un mensaje
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

  // Cuando un cliente se desconecta
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
