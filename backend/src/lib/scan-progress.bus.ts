import { EventEmitter } from "events";

const bus = new Map<string, EventEmitter>();

export function createScanEmitter(scanId: string): EventEmitter {
  const emitter = new EventEmitter();
  bus.set(scanId, emitter);
  return emitter;
}

export function getScanEmitter(scanId: string): EventEmitter | undefined {
  return bus.get(scanId);
}

export function removeScanEmitter(scanId: string): void {
  bus.delete(scanId);
}
