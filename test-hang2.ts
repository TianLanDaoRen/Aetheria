import * as mm from 'music-metadata-browser';

async function test() {
  const flacHeader = Buffer.from('664c6143', 'hex');
  const streamInfo = Buffer.from('00000022120012000000000000000000000000000000000000000000000000000000000000000000', 'hex');
  const pictureHeader = Buffer.from('86000000', 'hex'); // Last block, type 6 (Picture), length 0
  
  const buffer = Buffer.concat([flacHeader, streamInfo, pictureHeader, Buffer.alloc(10 * 1024 * 1024)]); // 10MB
  const blob = new Blob([buffer]);
  const slice = blob.slice(0, 5 * 1024 * 1024); // 5MB
  
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000));
  
  try {
    await Promise.race([
      mm.parseBlob(slice, { fileSize: 200 * 1024 * 1024 } as any),
      timeoutPromise
    ]);
    console.log("Success");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
test();
