import dgram from "dgram";
import * as crypto from "crypto";

const SERVER_PORT = 5555;
const BUFFER_SIZE = 2048;
const SERVER_IP = "48.217.83.205"; // Use the actual VM public IP here

// Encryption keys (same as server)
let key: Buffer = Buffer.from(""),
  iv: Buffer = Buffer.from("");
let isSecure = false;

function decrypt(data: Buffer): Buffer {
  console.log("Decrypting with key:", key, "and IV:", iv);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

async function vpnClient() {
  const client = dgram.createSocket("udp4");

  // Initial message to send
  const message = Buffer.from("Hello VPN Server!");

  // Construct the message with security tags if needed
  const toSend = Buffer.concat([
    Buffer.from(isSecure ? "----secure" : "--insecure"), // Security tag
    message,
  ]);

  // Send the message to the server (no need to connect in UDP)
  client.send(toSend, SERVER_PORT, SERVER_IP, (err) => {
    if (err) {
      console.error("Error sending packet:", err);
    } else {
      console.log("Message sent to server");
    }
  });

  // Handle incoming messages from the server
  client.on("message", (msg, rinfo) => {
    if (!isSecure) {
      console.log("Sharing credentials with server");
      let position = 0;

      // Extract key and IV
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
      // Decrypt the message after the security handshake
      console.log("Received a message");
      const decryptedData = decrypt(msg);
      console.log("Received from server:", decryptedData.toString());
    }
  });
}

vpnClient().catch((err) => console.error("Client error:", err));
