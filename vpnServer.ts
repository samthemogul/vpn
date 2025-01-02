import dgram from "dgram";
import * as crypto from "crypto";
import * as fs from "fs";
import { setupTunInterface } from "./tun";

const SERVER_PORT = 5555;
const BUFFER_SIZE = 2048;

const key = crypto.randomBytes(32); // Encryption key
const iv = crypto.randomBytes(16); // Initialization vector

function encrypt(data: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function handleSocketResponse(
  tunFd: number,
  body: any,
  port: number,
  address: string,
  server: dgram.Socket
) {
  fs.write(tunFd, body, () => {
    const buffer = Buffer.alloc(BUFFER_SIZE);
    const bytesRead = fs.readSync(tunFd, buffer, 0, BUFFER_SIZE, null);
    const encryptedData = encrypt(buffer.slice(0, bytesRead));

    server.send(encryptedData, port, address, (err) => {
      if (err) console.error("Error sending packet:", err.message);
      else console.log("Message sent to client at " + address + ":" + port);
    });
  });
}

async function generateTunDevice() {
  let index = 0;

  while (true) {
    const deviceName = `tun${index}`;
    try {
      const tunFd = await setupTunInterface(deviceName, `10.0.${index}.1`, "24");
      console.log(`TUN device ${deviceName} created`);
      return tunFd;
    } catch (error) {
      if (error.message.includes("Device or resource busy")) {
        console.warn(`Device ${deviceName} already exists. Trying next index...`);
        index++;
      } else {
        console.error(`Error creating TUN device: ${error.message}`);
        throw error;
      }
    }
  }
}

async function vpnServer() {
  const tunFd = await generateTunDevice();
  const udpServer = dgram.createSocket("udp4");

  udpServer.on("connection", (socket) => {
    console.log("Client connected:", socket);
  });

  udpServer.on("error", (err) => {
    console.error("UDP server error:", err);
  });

  udpServer.on("message", (msg, rinfo) => {
    let body;
    let position = 0;
    body = msg.slice(position);
    if (msg.slice(position, position + 10).toString() === "----secure") {
      position += 10;
      handleSocketResponse(tunFd, body, rinfo.port, rinfo.address, udpServer);
    } else {
      console.log("Initializing handshake");
      const message = Buffer.concat([
        Buffer.from("key:"),
        key,
        Buffer.from("iv:"),
        iv,
      ]);
      udpServer.send(message, rinfo.port, rinfo.address, (err) => {
        if (err) {
          console.log("Error sending credentials");
        } else {
          handleSocketResponse(
            tunFd,
            body,
            rinfo.port,
            rinfo.address,
            udpServer
          );
        }
      });
    }
  });

  udpServer.bind(SERVER_PORT, () => {
    console.log(`VPN server listening on port ${SERVER_PORT}`);
  });
}

vpnServer().catch((err) => console.error("Server error:", err));
