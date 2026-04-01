import * as mm from 'music-metadata-browser';
import fs from 'fs';

async function test() {
  // Create a dummy FLAC header with a Vorbis comment block and a Picture block
  // "fLaC"
  const flacHeader = Buffer.from('664c6143', 'hex');
  // STREAMINFO block (type 0, length 34)
  const streamInfo = Buffer.from('00000022120012000000000000000000000000000000000000000000000000000000000000000000', 'hex');
  // VORBIS_COMMENT block (type 4, length 40)
  const vorbis = Buffer.from('04000028' + '00000000'.repeat(10), 'hex'); // dummy
  
  const buffer = Buffer.concat([flacHeader, streamInfo, vorbis]);
  
  try {
    const metadata = await mm.parseBuffer(new Uint8Array(buffer), 'audio/flac', { skipPostHeaders: true });
    console.log(metadata);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
test();
