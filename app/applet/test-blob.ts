import * as mm from 'music-metadata-browser';
import fs from 'fs';

async function test() {
  const buffer = Buffer.alloc(20 * 1024 * 1024); // 20MB of zeros
  // mock a Blob
  const blob = new Blob([buffer]);
  try {
    const metadata = await mm.parseBlob(blob, { fileSize: 200 * 1024 * 1024 } as any);
    console.log(metadata);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
