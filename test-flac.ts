import * as mm from 'music-metadata-browser';

async function test() {
  // Create a dummy FLAC header
  // "fLaC" followed by METADATA_BLOCK_STREAMINFO
  const flacHeader = Buffer.from('664c614300000022120012000000000000000000000000000000000000000000000000000000000000000000', 'hex');
  const buffer = Buffer.concat([flacHeader, Buffer.alloc(1000)]);
  try {
    const metadata = await mm.parseBuffer(new Uint8Array(buffer), 'audio/flac', { skipPostHeaders: true });
    console.log(metadata);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
test();
