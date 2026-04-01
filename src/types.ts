export interface Song {
  id: string;
  file: File;
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
  coverBlob?: Blob | null;
  duration: number;
  codec?: string;
  bitsPerSample?: number;
  sampleRate?: number;
  bitrate?: number;
  lossless?: boolean;
  lyrics?: string;
}

export interface Playlist {
  id: string;
  name: string;
  coverUrl: string | null;
  songIds: string[];
}
