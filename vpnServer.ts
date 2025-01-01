import dgram from "dgram";
import * as crypto from "crypto";
import * as fs from "fs";
import { setupTunInterface } from "./tun";

const SERVER_PORT = 5555;
const BUFFER_SIZE = 2048;
let isSecure = false;

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
    console.log("Written");
    const buffer = Buffer.alloc(BUFFER_SIZE);
    const bytesRead = fs.readSync(tunFd, buffer, 0, BUFFER_SIZE, null);
    console.log(`Bytes read: ${bytesRead}`);
    const encryptedData = encrypt(buffer.slice(0, bytesRead));

    server.send(encryptedData, port, address, (err) => {
      if (err) console.error("Error sending packet:", err.message);
      else console.log("Message sent to server");
    });
  });
}

async function vpnServer() {
  const tunFd = await setupTunInterface("tun0", "10.0.0.1", "24");
  console.log(tunFd);
  const udpServer = dgram.createSocket("udp4");

  udpServer.on("connection", (socket) => {
    console.log("Client connected:", socket);
  });

  udpServer.on("error", (err) => {
    console.error("UDP server error:", err);
  });

  udpServer.on("message", (msg, rinfo) => {
    let status, body;
    let position = 0;
    body = msg.slice(position);
    if (msg.slice(position, position + 10).toString() === "----secure") {
      position += 10;
      console.log("Message:", body.toString()); // Log message
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
          isSecure = true;
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
