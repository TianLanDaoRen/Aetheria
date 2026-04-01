import * as mm from 'music-metadata-browser';
import fs from 'fs';

async function test() {
  // Create a dummy FLAC file with a 1MB picture block
  const flacHeader = Buffer.from('664c6143', 'hex');
  const streamInfo = Buffer.from('00000022120012000000000000000000000000000000000000000000000000000000000000000000', 'hex');
  const pictureHeader = Buffer.from('86000000', 'hex'); // Last block, type 6 (Picture), length 0
  
  const buffer = Buffer.concat([flacHeader, streamInfo, pictureHeader]);
  
  try {
    const metadata = await mm.parseBuffer(new Uint8Array(buffer), 'audio/flac', { skipPostHeaders: true });
    console.log(metadata);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
test();
