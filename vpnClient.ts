import dgram from "dgram";
import * as crypto from "crypto";

const SERVER_PORT = 7000;
const BUFFER_SIZE = 2048;

// Encryption keys (same as server)
let key: Buffer = Buffer.from(""),
  iv: Buffer = Buffer.from("");
let isSecure = false;

function decrypt(data: Buffer): Buffer {
  console.log(key, iv);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

async function vpnClient() {
  const client = dgram.createSocket("udp4");
  const message = Buffer.from("Hello VPN Server!");
  const toSend = Buffer.concat([
    Buffer.from(`${isSecure ? "----secure" : "--insecure"}`),
    message,
  ]);

  client.connect(5555, "127.0.0.1", () => {
    console.log("Connected to VPN servr");
    client.send(message, (err) => {
      if (err) console.error("Error sending packet:", err);
      else console.log("Message sent to server");
    });
  });

  client.on("message", (msg, rinfo) => {
    if (!isSecure) {
      console.log("Sharing credentials with server");
      let position = 0;
      if (msg.slice(position, position + 4).toString() === "key:") {
        position += 4;
        key = msg.slice(position, position + 32);
        position += 32;
      }
      if (msg.slice(position, position + 3).toString() === "iv:") {
        position += 3;
        iv = msg.slice(position, position + 16);
        position += 16;
      }
      isSecure = true;
    } else {
      console.log("received a message");
      const decryptedData = decrypt(msg);
      console.log("Received from servr:", decryptedData.toString());
    }
  });

  //   client.bind(SERVER_PORT, () => {
  //     console.log("Client listening")
  //   })
}

vpnClient().catch((err) => console.error("Client error:", err));
