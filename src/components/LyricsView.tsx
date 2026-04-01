import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Song, Playlist } from '../types';
import { Maximize2, Minimize2, Music, Plus, PlusCircle, Check, ListPlus, ChevronLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface LyricLine {
  time: number;
  text: string;
}

function parseLrc(lrc: string): LyricLine[] {
  const lines = lrc.split('\n');
  const result: LyricLine[] = [];
  const timeReg = /\[(\d{2}):(\d{2})\.(\d{1,3})\]/;
  for (const line of lines) {
    const match = timeReg.exec(line);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const msStr = match[3];
      // Pad or truncate to 3 digits for milliseconds
      const ms = parseInt((msStr + '000').substring(0, 3));
      const time = min * 60 + sec + ms / 1000;
      const text = line.replace(timeReg, '').trim();
      if (text) result.push({ time, text });
    }
  }
  return result;
}

export function LyricsView({ 
  song, 
  progress,
  playlists,
  onArtistClick,
  onAlbumClick,
  onAddSongToPlaylist,
  onRemoveSongFromPlaylist,
  onCreatePlaylist
}: { 
  song: Song, 
  progress: number,
  playlists: Playlist[],
  onArtistClick?: (artist: string) => void,
  onAlbumClick?: (album: string) => void,
  onAddSongToPlaylist: (playlistId: string, songId: string) => void,
  onRemoveSongFromPlaylist: (playlistId: string, songId: string) => void,
  onCreatePlaylist: (name: string, coverUrl?: string) => void
}) {
  const lyrics = useMemo(() => {
    if (song.lyrics) {
      const parsed = parseLrc(song.lyrics);
      if (parsed.length > 0) return parsed;
    }
    return [{ time: 0, text: "暂无歌词，请放置同名lrc文件" }];
  }, [song.lyrics]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'info' | 'lyrics'>('info');
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;
    
    // Swipe right to go back to info mode
    if (deltaX > 50 && Math.abs(deltaX) > Math.abs(deltaY) && viewMode === 'lyrics') {
      setViewMode('info');
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };
  
  const activeTime = useMemo(() => {
    if (!lyrics.length) return -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (progress >= lyrics[i].time) return lyrics[i].time;
    }
    return lyrics[0].time;
  }, [lyrics, progress]);

  useEffect(() => {
    if (containerRef.current && activeTime !== -1 && (viewMode === 'lyrics' || window.innerWidth >= 768)) {
      const firstActiveIndex = lyrics.findIndex(l => l.time === activeTime);
      if (firstActiveIndex !== -1) {
        // Use requestAnimationFrame to ensure the container is visible and layout is updated
        requestAnimationFrame(() => {
          const activeEl = containerRef.current?.children[0]?.children[firstActiveIndex] as HTMLElement;
          if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    }
  }, [activeTime, lyrics, viewMode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPlaylistDropdown(false);
        setIsCreatingPlaylist(false);
        setNewPlaylistName('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex h-full w-full relative">
      <button 
        onClick={() => setViewMode(m => m === 'info' ? 'lyrics' : 'info')} 
        className="absolute top-4 right-4 md:top-8 md:right-8 z-20 p-2 md:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white cursor-pointer backdrop-blur-md"
        title={viewMode === 'info' ? "Pure Lyrics" : "Show Info"}
      >
        {viewMode === 'info' ? <Maximize2 className="w-4 h-4 md:w-5 md:h-5" /> : <Minimize2 className="w-4 h-4 md:w-5 md:h-5" />}
      </button>

      {viewMode === 'info' && (
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="w-full md:w-1/3 md:min-w-[300px] md:max-w-[500px] p-4 md:p-12 flex flex-col justify-center items-center border-r border-white/10 bg-black/20 backdrop-blur-md z-10 overflow-y-auto"
        >
          <div className="w-full max-w-[160px] md:max-w-none max-h-[20vh] md:max-h-none aspect-square rounded-2xl overflow-hidden mb-3 md:mb-8 shadow-2xl bg-black/40 shrink-0">
            {song.coverUrl ? (
              <img src={song.coverUrl} alt="Cover" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-16 h-16 md:w-32 md:h-32 text-white/20" />
              </div>
            )}
          </div>
          <div className="flex flex-col items-center w-full px-2 overflow-hidden shrink-0">
            <h2 className="text-lg md:text-3xl font-bold text-center mb-1 md:mb-4 text-white line-clamp-2 w-full" style={{ textWrap: 'balance' }}>{song.title}</h2>
            <button 
              onClick={() => onArtistClick?.(song.artist)} 
              className="text-sm md:text-xl text-white/70 hover:text-[#ff4e00] transition-colors mb-1 md:mb-2 cursor-pointer text-center truncate w-full"
            >
              {song.artist}
            </button>
            {song.album && song.album !== 'Unknown Album' && (
              <button 
                onClick={() => onAlbumClick?.(song.album)} 
                className="text-xs md:text-lg text-white/50 hover:text-[#ff4e00] transition-colors cursor-pointer text-center mb-1 truncate w-full"
              >
                {song.album}
              </button>
            )}
          </div>
          {(song.codec || song.bitsPerSample || song.bitrate) && (
            <div className="flex items-center justify-center gap-1.5 mt-1 mb-4">
              {song.codec && (
                <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-white/10 text-white/70 border border-white/5">
                  {song.codec}
                </span>
              )}
              {(song.bitsPerSample || song.bitrate) && song.sampleRate && (
                <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded-sm bg-[#ff4e00]/20 text-[#ff4e00] border border-[#ff4e00]/20">
                  {song.bitsPerSample ? `${song.bitsPerSample}-bit` : `${Math.round(song.bitrate! / 1000)} kbps`} / {(song.sampleRate / 1000).toFixed(1)}kHz
                </span>
              )}
            </div>
          )}

          {/* Small Lyrics Preview for Mobile */}
          <div 
            className="md:hidden w-full h-20 mb-4 flex items-center justify-center text-center cursor-pointer hover:bg-white/5 rounded-xl transition-colors p-3"
            onClick={() => setViewMode('lyrics')}
          >
            <p className="text-base font-medium text-[#ff4e00] line-clamp-2">
              {lyrics.find(l => l.time === activeTime)?.text || "..."}
            </p>
          </div>

          <div className="relative mt-4 md:mt-auto w-full max-w-xs" ref={dropdownRef}>
            <button
              onClick={() => setShowPlaylistDropdown(!showPlaylistDropdown)}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white/10 hover:bg-white/20 transition-colors rounded-full text-xs md:text-sm font-medium text-white cursor-pointer backdrop-blur-md border border-white/10"
            >
              <ListPlus className="w-4 h-4" />
              Add to Playlist
            </button>

            <AnimatePresence>
              {showPlaylistDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-3 border-b border-white/10">
                    {isCreatingPlaylist ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newPlaylistName}
                          onChange={(e) => setNewPlaylistName(e.target.value)}
                          placeholder="Playlist name..."
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff4e00]/50"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newPlaylistName.trim()) {
                              onCreatePlaylist(newPlaylistName.trim(), null);
                              setIsCreatingPlaylist(false);
                              setNewPlaylistName('');
                            } else if (e.key === 'Escape') {
                              setIsCreatingPlaylist(false);
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (newPlaylistName.trim()) {
                              onCreatePlaylist(newPlaylistName.trim(), null);
                              setIsCreatingPlaylist(false);
                              setNewPlaylistName('');
                            }
                          }}
                          className="p-1.5 bg-[#ff4e00] hover:bg-[#ff6a2b] rounded-lg text-white transition-colors cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsCreatingPlaylist(true)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        New Playlist
                      </button>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto p-2 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
                    {playlists.length === 0 ? (
                      <div className="p-4 text-center text-xs text-white/40">No playlists yet</div>
                    ) : (
                      playlists.map(playlist => {
                        const isAdded = playlist.songIds.includes(song.id);
                        return (
                          <button
                            key={playlist.id}
                            onClick={() => {
                              if (isAdded) {
                                onRemoveSongFromPlaylist(playlist.id, song.id);
                              } else {
                                onAddSongToPlaylist(playlist.id, song.id);
                              }
                            }}
                            className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors text-left hover:bg-white/5 cursor-pointer`}
                          >
                            <div className="w-8 h-8 rounded bg-white/10 overflow-hidden shrink-0">
                              {playlist.coverUrl ? (
                                <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Music className="w-3 h-3 text-white/40" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white truncate">{playlist.name}</div>
                              <div className="text-xs text-white/40">{playlist.songIds.length} tracks</div>
                            </div>
                            {isAdded ? <Check className="w-4 h-4 text-[#ff4e00]" /> : <Plus className="w-4 h-4 text-white/40" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Removed mobile back button as requested */}

      <div 
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 scroll-smooth relative",
          viewMode === 'info' ? "hidden md:block" : "block"
        )} 
        ref={containerRef} 
        style={{ scrollbarWidth: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="max-w-4xl mx-auto py-[30vh] md:py-[40vh] flex flex-col gap-4 md:gap-6">
          {lyrics.map((line, i) => {
            const isActive = line.time === activeTime;
            const isPassed = line.time < activeTime;
            
            return (
              <motion.div
                key={i}
                animate={{
                  opacity: isActive ? 1 : (isPassed ? 0.3 : 0.5),
                  scale: isActive ? 1.05 : 1,
                  filter: isActive ? 'blur(0px)' : 'blur(1px)'
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`text-3xl md:text-5xl font-bold transition-colors duration-500 ${viewMode === 'info' ? 'text-left' : 'text-center'} ${isActive ? 'text-[#ff4e00]' : 'text-white'}`}
              >
                {line.text}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
