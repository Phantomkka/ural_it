import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import { COMPUTERS, GATEWAY, MASK, JOBS } from "@netcity/shared";
export class NetworkInterface extends Schema {
  declare id: string;
  declare ip: string;
  declare mask: string;
  declare gateway: string;
  declare dns: string;
  declare connected: boolean;
  constructor() {
    super();
    this.id = "eth0";
    this.ip = "";
    this.mask = MASK;
    this.gateway = GATEWAY;
    this.dns = GATEWAY;
    this.connected = true;
  }
}
defineTypes(NetworkInterface, {
  id: "string",
  ip: "string",
  mask: "string",
  gateway: "string",
  dns: "string",
  connected: "boolean",
});
export class NetworkDevice extends Schema {
  declare id: string;
  declare name: string;
  declare kind: string;
  declare powered: boolean;
  declare revision: number;
  declare interfaces: MapSchema<NetworkInterface>;
  constructor() {
    super();
    this.id = "";
    this.name = "";
    this.kind = "PC";
    this.powered = true;
    this.revision = 0;
    this.interfaces = new MapSchema<NetworkInterface>();
    this.interfaces.set("eth0", new NetworkInterface());
  }
}
defineTypes(NetworkDevice, {
  id: "string",
  name: "string",
  kind: "string",
  powered: "boolean",
  revision: "number",
  interfaces: { map: NetworkInterface },
});
export class JobProgress extends Schema {
  declare stage: number;
  declare status: string;
  declare verifiedRevision: number;
  constructor() {
    super();
    this.stage = 0;
    this.status = "NEW";
    this.verifiedRevision = -1;
  }
}
defineTypes(JobProgress, {
  stage: "number",
  status: "string",
  verifiedRevision: "number",
});
export function createJobs() {
  return new MapSchema<JobProgress>(
    Object.fromEntries(JOBS.map((j) => [j.id, new JobProgress()])),
  );
}
function device(id: string, name: string, kind: string, ip: string = "") {
  const value = new NetworkDevice();
  value.id = id;
  value.name = name;
  value.kind = kind;
  value.interfaces.get("eth0")!.ip = ip;
  return value;
}
export function createDevices() {
  const devices = new MapSchema<NetworkDevice>();
  for (const pc of COMPUTERS) {
    const value = device(pc.id, pc.name, "PC", pc.ip);
    const nic = value.interfaces.get("eth0")!;
    if (pc.id === "pc02") nic.connected = false;
    if (pc.id === "pc03") nic.ip = "192.168.20.103";
    if (pc.id === "pc01") nic.dns = "192.168.10.254";
    devices.set(pc.id, value);
  }
  devices.set(
    "router",
    device("router", "Офисный маршрутизатор", "ROUTER", GATEWAY),
  );
  devices.set(
    "switch",
    device("switch", "Коммутатор · 8 портов", "SWITCH", "192.168.10.2"),
  );
  devices.set("internet", device("internet", "Интернет", "INTERNET"));
  return devices;
}
