import { Blob, File } from 'node:buffer';

if (typeof globalThis.Blob === 'undefined') {
  Object.defineProperty(globalThis, 'Blob', {
    value: Blob,
    configurable: true,
    writable: true,
  });
}

if (typeof globalThis.File === 'undefined') {
  Object.defineProperty(globalThis, 'File', {
    value: File,
    configurable: true,
    writable: true,
  });
}
