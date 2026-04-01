import * as mm from 'music-metadata-browser';

async function test() {
  const buffer = Buffer.alloc(20 * 1024 * 1024); // 20MB
  const blob = new Blob([buffer]);
  const slice = blob.slice(0, 10 * 1024 * 1024); // 10MB
  
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
