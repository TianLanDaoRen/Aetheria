import * as mm from 'music-metadata-browser';

async function readChunk(file: File, size: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(0, size));
  });
}

async function test() {
  console.log("Test ready");
}
test();
