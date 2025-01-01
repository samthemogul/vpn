import * as fs from 'fs';
// import * as os from 'os';
// import * as net from 'net';
import { execSync } from 'child_process';
import { promisify } from 'util';
const ioctl = require('ioctl');
// import ioctl from "ioctl"

const IFNAMSIZ = 16; // Maximum length of interface name
const IFF_TUN = 0x0001; // TUN device
const IFF_NO_PI = 0x1000; // No packet information

interface IfReq {
  ifr_name: string;
  ifr_flags: number;
}

function createTunDevice(name: string): number {
  const tunFd = fs.openSync('/dev/net/tun', fs.constants.O_RDWR);
  const ifr = Buffer.alloc(IFNAMSIZ + 4); // Interface request structure

  ifr.write(name, 0, IFNAMSIZ, 'utf-8');
  ifr.writeUInt32LE(IFF_TUN | IFF_NO_PI, IFNAMSIZ); // Set flags

  const ret = ioctl(tunFd, 0x400454ca, ifr); // TUNSETIFF ioctl command
  console.log(ret)
  console.log(`TUN device created: ${name}`);
  return tunFd;
}

export async function setupTunInterface(name: string, ip: string, mask: string): Promise<number> {
  const tunFd = createTunDevice(name);

  // Assign IP and bring up the interface
  execSync(`ip addr add ${ip}/${mask} dev ${name}`);
  execSync(`ip link set ${name} up`);
  console.log(`TUN interface ${name} configured with IP ${ip}/${mask}`);
  return tunFd;
}
