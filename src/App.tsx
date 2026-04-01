import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, FolderSearch, Music, ListMusic, Settings, Disc3, ChevronUp, Search, Repeat, Repeat1, Shuffle, List, Trash2, GripVertical, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Song, Playlist } from './types';
import { audioEngine, parseAudioFile } from './lib/audioEngine';
import { Visualizer } from './components/Visualizer';
import { LyricsView } from './components/LyricsView';
import { PlaylistsView } from './components/PlaylistsView';
import { SettingsView } from './components/SettingsView';
import { FilterDropdown } from './components/FilterDropdown';
import { SortDropdown } from './components/SortDropdown';
import { MarqueeText } from './components/MarqueeText';
import { cn } from './lib/utils';

type ViewMode = 'library' | 'playlists' | 'settings';
type LoopMode = 'none' | 'all' | 'one' | 'shuffle';

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    const saved = localStorage.getItem('aetheria_playlists');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentView, setCurrentView] = useState<ViewMode>('library');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [playQueue, setPlayQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [selectedQueueItems, setSelectedQueueItems] = useState<Set<number>>(new Set());
  const [loopMode, setLoopMode] = useState<LoopMode>('none');
  const [showQueue, setShowQueue] = useState(false);
  const [showMobileVolume, setShowMobileVolume] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [selectedAlbums, setSelectedAlbums] = useState<string[]>([]);
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<'default' | 'title' | 'artist' | 'album'>('default');
  const [visibleCount, setVisibleCount] = useState(50);
  
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevVolume = useRef(1);
  const queueContainerRef = useRef<HTMLDivElement>(null);
  const handleNextRef = useRef<() => void>(null);

  useEffect(() => {
    localStorage.setItem('aetheria_playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    const updateProgress = () => {
      setProgress(audioEngine.currentTime);
    };
    
    const handleEnded = () => {
      handleNext();
    };

    const handleCrossfade = () => {
      handleNext(true);
    };

    audioEngine.addEventListener('timeupdate', updateProgress);
    audioEngine.addEventListener('ended', handleEnded);
    audioEngine.addEventListener('crossfade-start', handleCrossfade);
    
    return () => {
      audioEngine.removeEventListener('timeupdate', updateProgress);
      audioEngine.removeEventListener('ended', handleEnded);
      audioEngine.removeEventListener('crossfade-start', handleCrossfade);
    };
  }, [playQueue, queueIndex, loopMode]);

  // Auto-scroll play queue to active item
  useEffect(() => {
    if (showQueue && queueIndex !== -1 && queueContainerRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated and rendered
      requestAnimationFrame(() => {
        const activeItem = queueContainerRef.current?.querySelector('.queue-item-active');
        if (activeItem) {
          activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }, [showQueue, queueIndex]);

  const scanHandle = async (handle: FileSystemDirectoryHandle) => {
    setIsScanning(true);
    const newSongs: Song[] = [];
    const audioFiles: File[] = [];
    const lrcFiles = new Map<string, File>();

    async function scanDirectory(dirHandle: FileSystemDirectoryHandle, path = '') {
      for await (const entry of (dirHandle as any).values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          const name = file.name.toLowerCase();
          if (name.startsWith('._') || name.startsWith('.')) continue;
          
          if (name.endsWith('.lrc')) {
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')).toLowerCase();
            lrcFiles.set(baseName, file);
          } else if (name.match(/\.(mp3|flac|wav|m4a|ogg|aac|weba)$/)) {
            audioFiles.push(file);
          }
        } else if (entry.kind === 'directory') {
          await scanDirectory(entry, `${path}${entry.name}/`);
        }
      }
    }

    await scanDirectory(handle);
    
    setScanProgress({ current: 0, total: audioFiles.length });
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < audioFiles.length; i++) {
      try {
        const baseName = audioFiles[i].name.substring(0, audioFiles[i].name.lastIndexOf('.')).toLowerCase();
        const lrcFile = lrcFiles.get(baseName);
        let lyrics: string | undefined;
        if (lrcFile) lyrics = await lrcFile.text();
        
        const song = await parseAudioFile(audioFiles[i]);
        song.lyrics = lyrics;
        newSongs.push(song);
        
        if (i % BATCH_SIZE === 0 || i === audioFiles.length - 1) {
          setSongs(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueNew = newSongs.filter(s => !existingIds.has(s.id));
            return [...prev, ...uniqueNew];
          });
          setScanProgress({ current: i + 1, total: audioFiles.length });
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } catch (err) {
        console.error("Error scanning file", err);
      }
    }
    setIsScanning(false);
  };

  const triggerScan = async () => {
    const isInIframe = window.self !== window.top;
    
    if ('showDirectoryPicker' in window && !isInIframe) {
      try {
        const handle = await (window as any).showDirectoryPicker();
        await scanHandle(handle);
      } catch (err) {
        console.error("Directory picker error, falling back to file input", err);
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsScanning(true);
    const newSongs: Song[] = [];
    
    const audioFiles: File[] = [];
    const lrcFiles = new Map<string, File>();
    
    Array.from(files).forEach((file: File) => {
      const name = file.name.toLowerCase();
      if (name.startsWith('._') || name.startsWith('.')) return;
      
      if (name.endsWith('.lrc')) {
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')).toLowerCase();
        lrcFiles.set(baseName, file);
      } else if (name.match(/\.(mp3|flac|wav|m4a|ogg|aac|weba)$/)) {
        audioFiles.push(file);
      }
    });

    setScanProgress({ current: 0, total: audioFiles.length });

    // Batch updates to avoid too many re-renders
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < audioFiles.length; i++) {
      try {
        const baseName = audioFiles[i].name.substring(0, audioFiles[i].name.lastIndexOf('.')).toLowerCase();
        const lrcFile = lrcFiles.get(baseName);
        let lyrics: string | undefined;
        if (lrcFile) {
          lyrics = await lrcFile.text();
        }
        
        const song = await parseAudioFile(audioFiles[i]);
        song.lyrics = lyrics;
        newSongs.push(song);
        
        if (i % BATCH_SIZE === 0 || i === audioFiles.length - 1) {
          setSongs(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueNew = newSongs.filter(s => !existingIds.has(s.id));
            return [...prev, ...uniqueNew];
          });
          setScanProgress({ current: i + 1, total: audioFiles.length });
          // CRITICAL: Yield to the browser's macro-task queue to force a UI paint
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } catch (err) {
        console.error("Error parsing file:", audioFiles[i].name, err);
      }
    }
    
    setIsScanning(false);
    setScanProgress({ current: 0, total: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const playSongFromLibrary = (song: Song) => {
    const newQueue = [...playQueue];
    const existingIndex = newQueue.findIndex(s => s.id === song.id);
    let newIndex;
    
    if (existingIndex >= 0) {
      newIndex = existingIndex;
    } else {
      newQueue.push(song);
      newIndex = newQueue.length - 1;
    }
    
    setPlayQueue(newQueue);
    setQueueIndex(newIndex);
    setCurrentSong(song);
    audioEngine.play(song.file);
    setIsPlaying(true);
  };

  const playPlaylist = (playlist: Playlist) => {
    const playlistSongs = playlist.songIds
      .map(id => songs.find(s => s.id === id))
      .filter((s): s is Song => s !== undefined);
      
    if (playlistSongs.length === 0) return;
    
    setPlayQueue(playlistSongs);
    setQueueIndex(0);
    setCurrentSong(playlistSongs[0]);
    audioEngine.play(playlistSongs[0].file);
    setIsPlaying(true);
  };

  const playSongFromQueue = (index: number) => {
    if (index < 0 || index >= playQueue.length) return;
    setQueueIndex(index);
    setCurrentSong(playQueue[index]);
    audioEngine.play(playQueue[index].file);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (!currentSong) return;
    if (isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleNext = (isCrossfade = false) => {
    if (playQueue.length === 0) return;
    
    if (loopMode === 'one') {
      if (isCrossfade) {
        audioEngine.play(playQueue[queueIndex].file);
      } else {
        audioEngine.seek(0);
        audioEngine.play();
      }
      return;
    }
    
    let nextIndex = queueIndex + 1;
    
    if (loopMode === 'shuffle') {
      nextIndex = Math.floor(Math.random() * playQueue.length);
    } else if (nextIndex >= playQueue.length) {
      if (loopMode === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        audioEngine.pause();
        audioEngine.seek(0);
        setProgress(0);
        return;
      }
    }
    
    playSongFromQueue(nextIndex);
  };

  useEffect(() => {
    handleNextRef.current = handleNext;
  });

  const handlePrev = () => {
    if (playQueue.length === 0) return;
    
    if (progress > 3) {
      audioEngine.seek(0);
      return;
    }
    
    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = loopMode === 'all' ? playQueue.length - 1 : 0;
    }
    
    playSongFromQueue(prevIndex);
  };

  const observerTarget = useRef<HTMLDivElement>(null);
  const libraryContainerRef = useRef<HTMLDivElement>(null);

  const filteredSongs = React.useMemo(() => {
    let result = songs.filter(s => {
      const matchSearch = s.title.toLowerCase().includes(librarySearchQuery.toLowerCase()) || 
                          s.artist.toLowerCase().includes(librarySearchQuery.toLowerCase()) ||
                          s.album.toLowerCase().includes(librarySearchQuery.toLowerCase());
      const matchArtist = selectedArtists.length === 0 || selectedArtists.includes(s.artist);
      const matchAlbum = selectedAlbums.length === 0 || selectedAlbums.includes(s.album);
      const ext = s.file.name.split('.').pop()?.toLowerCase() || '';
      const matchExt = selectedExtensions.length === 0 || selectedExtensions.includes(ext);
      return matchSearch && matchArtist && matchAlbum && matchExt;
    });

    if (sortOption === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOption === 'artist') {
      result.sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortOption === 'album') {
      result.sort((a, b) => (a.album || '').localeCompare(b.album || ''));
    }
    
    return result;
  }, [songs, librarySearchQuery, selectedArtists, selectedAlbums, selectedExtensions, sortOption]);

  // Reset visible count when filters or library changes
  useEffect(() => {
    setVisibleCount(50);
  }, [librarySearchQuery, selectedArtists, selectedAlbums, selectedExtensions, sortOption, songs.length]);

  // Infinite scroll observer
  useEffect(() => {
    if (currentView !== 'library') return;

    // Use a longer delay or a polling mechanism to ensure DOM is ready after AnimatePresence 'wait'
    const initObserver = () => {
      if (!observerTarget.current) {
        // If target not ready, retry in 100ms
        const retryId = setTimeout(initObserver, 100);
        return retryId;
      }

      const observer = new IntersectionObserver(
        entries => {
          if (entries[0].isIntersecting) {
            setVisibleCount(prev => {
              if (prev < filteredSongs.length) {
                return Math.min(prev + 100, filteredSongs.length);
              }
              return prev;
            });
          }
        },
        { 
          threshold: 0.1, // Small threshold to be more reliable
          rootMargin: '400px' // Preload next batch
        }
      );

      observer.observe(observerTarget.current);
      return observer;
    };

    const result = initObserver();
    
    return () => {
      if (typeof result === 'number' || (typeof result === 'object' && result !== null && 'unref' in result)) {
        clearTimeout(result as any);
      } else if (result && 'disconnect' in result) {
        (result as IntersectionObserver).disconnect();
      }
    };
  }, [currentView, filteredSongs.length]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    audioEngine.seek(time);
    setProgress(time);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    audioEngine.setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      const newVol = prevVolume.current > 0 ? prevVolume.current : 1;
      setVolume(newVol);
      audioEngine.setVolume(newVol);
      setIsMuted(false);
    } else {
      prevVolume.current = volume;
      setVolume(0);
      audioEngine.setVolume(0);
      setIsMuted(true);
    }
  };

  const handleWheelVolume = (e: React.WheelEvent) => {
    // Prevent default scrolling behavior when adjusting volume
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    let newVol = volume + delta;
    newVol = Math.max(0, Math.min(1, newVol));
    setVolume(newVol);
    audioEngine.setVolume(newVol);
    setIsMuted(newVol === 0);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const availableArtists = React.useMemo(() => Array.from(new Set(songs.map(s => s.artist))).filter(Boolean).sort(), [songs]);
  const availableAlbums = React.useMemo(() => Array.from(new Set(songs.map(s => s.album))).filter(a => a && a !== 'Unknown Album').sort(), [songs]);
  const availableExtensions = React.useMemo(() => Array.from(new Set(songs.map(s => s.file.name.split('.').pop()?.toLowerCase() || ''))).filter(Boolean).sort(), [songs]);

  return (
    <div className="flex flex-col h-[100dvh] w-full relative overflow-hidden bg-black text-white">
      <div className="atmosphere-bg" />
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center p-4 border-b border-white/5 bg-black/40 backdrop-blur-md shrink-0 relative z-20 h-16">
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 hover:bg-white/10 rounded-full">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <Disc3 className="w-5 h-5 text-[#ff4e00]" />
          <h1 className="text-xl font-bold tracking-tighter">Aetheria</h1>
        </div>
      </div>

      {/* Main Content Area (Sidebar + Main) */}
      <div className="flex flex-1 w-full overflow-hidden relative z-30 mb-20 md:mb-24">
        
        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 glass-panel border-r border-white/5 flex flex-col p-6 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <Disc3 className="w-8 h-8 text-[#ff4e00]" />
              <h1 className="text-2xl font-bold tracking-tighter">Aetheria</h1>
            </div>
            <button className="md:hidden p-2 hover:bg-white/10 rounded-full" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-2 flex-1">
            <button 
              onClick={() => { setCurrentView('library'); setIsMobileMenuOpen(false); }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-colors text-sm font-medium cursor-pointer w-full text-left",
                currentView === 'library' ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <Music className={cn("w-5 h-5", currentView === 'library' ? "text-[#ff4e00]" : "")} /> Library
            </button>
            <button 
              onClick={() => { setCurrentView('playlists'); setIsMobileMenuOpen(false); }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-colors text-sm font-medium cursor-pointer w-full text-left",
                currentView === 'playlists' ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <ListMusic className={cn("w-5 h-5", currentView === 'playlists' ? "text-[#ff4e00]" : "")} /> Playlists
            </button>
            <button 
              onClick={() => { setCurrentView('settings'); setIsMobileMenuOpen(false); }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-colors text-sm font-medium cursor-pointer w-full text-left",
                currentView === 'settings' ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <Settings className={cn("w-5 h-5", currentView === 'settings' ? "text-[#ff4e00]" : "")} /> Settings
            </button>
            <button 
              onClick={triggerScan}
              disabled={isScanning}
              className="flex items-center justify-center gap-3 p-3 bg-white/10 hover:bg-white/20 transition-colors rounded-xl text-sm font-medium backdrop-blur-md border border-white/10 cursor-pointer w-full"
            >
              <FolderSearch className="w-4 h-4" />
              {isScanning ? `Scanning... ${scanProgress.current}/${scanProgress.total}` : "Scan Local Library"}
            </button>
          </nav>
          
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            {...{ webkitdirectory: "", directory: "" } as any} 
            multiple 
          />
          <AnimatePresence mode="wait">
            {showLyrics && currentSong ? (
              <motion.div
                key="lyrics-view"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col bg-black/90 backdrop-blur-xl z-40"
              >
                <LyricsView 
                  song={currentSong} 
                  progress={progress} 
                  playlists={playlists}
                  onArtistClick={(artist) => {
                    setSelectedArtists([artist]);
                    setCurrentView('library');
                    setShowLyrics(false);
                  }}
                  onAlbumClick={(album) => {
                    setSelectedAlbums([album]);
                    setCurrentView('library');
                    setShowLyrics(false);
                  }}
                  onAddSongToPlaylist={(playlistId, songId) => {
                    setPlaylists(playlists.map(p => 
                      p.id === playlistId && !p.songIds.includes(songId)
                        ? { ...p, songIds: [...p.songIds, songId] }
                        : p
                    ));
                  }}
                  onRemoveSongFromPlaylist={(playlistId, songId) => {
                    setPlaylists(playlists.map(p => 
                      p.id === playlistId 
                        ? { ...p, songIds: p.songIds.filter(id => id !== songId) }
                        : p
                    ));
                  }}
                  onCreatePlaylist={(name, coverUrl) => {
                    setPlaylists([...playlists, { id: Date.now().toString(), name, coverUrl, songIds: [currentSong.id] }]);
                  }}
                />
              </motion.div>
            ) : currentView === 'playlists' ? (
              <motion.div
                key="playlists-view"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col"
              >
                <PlaylistsView 
                  playlists={playlists}
                  songs={songs}
                  currentSong={currentSong}
                  onPlayPlaylist={playPlaylist}
                  onCreatePlaylist={(name, coverUrl) => {
                    setPlaylists([...playlists, { id: Date.now().toString(), name, coverUrl, songIds: [] }]);
                  }}
                  onDeletePlaylist={(id) => {
                    setPlaylists(playlists.filter(p => p.id !== id));
                  }}
                  onAddSongToPlaylist={(playlistId, songId) => {
                    setPlaylists(playlists.map(p => 
                      p.id === playlistId && !p.songIds.includes(songId)
                        ? { ...p, songIds: [...p.songIds, songId] }
                        : p
                    ));
                  }}
                  onRemoveSongFromPlaylist={(playlistId, songId) => {
                    setPlaylists(playlists.map(p => 
                      p.id === playlistId 
                        ? { ...p, songIds: p.songIds.filter(id => id !== songId) }
                        : p
                    ));
                  }}
                  onReorderPlaylist={(playlistId, newSongIds) => {
                    setPlaylists(playlists.map(p => 
                      p.id === playlistId 
                        ? { ...p, songIds: newSongIds }
                        : p
                    ));
                  }}
                  onUpdatePlaylist={(id, name, coverUrl) => {
                    setPlaylists(playlists.map(p => 
                      p.id === id 
                        ? { ...p, name, coverUrl }
                        : p
                    ));
                  }}
                  onPlaySong={(song, playlistSongs) => {
                    setPlayQueue(playlistSongs);
                    setQueueIndex(playlistSongs.findIndex(s => s.id === song.id));
                    setCurrentSong(song);
                    audioEngine.play(song.file);
                    setIsPlaying(true);
                  }}
                />
              </motion.div>
            ) : currentView === 'settings' ? (
              <motion.div
                key="settings-view"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col"
              >
                <SettingsView 
                  onClose={() => setCurrentView('library')}
                  songs={songs}
                  onClearLibrary={() => {
                    setSongs([]);
                    setPlayQueue([]);
                    setCurrentSong(null);
                    setIsPlaying(false);
                    audioEngine.pause();
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="library-view"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col"
              >
                <div 
                  ref={libraryContainerRef}
                  className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8"
                >
                  <div className="flex flex-col gap-6 mb-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <h2 className="text-4xl font-light tracking-tight">
                          {songs.length > 0 ? "Your Library" : "Welcome to Aetheria"}
                        </h2>
                        {songs.length > 0 && (
                          <span className="text-sm font-medium text-white/40 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                            {songs.length} tracks
                          </span>
                        )}
                        {filteredSongs.length > 0 && (
                          <button 
                            onClick={() => {
                              setPlayQueue(filteredSongs);
                              setQueueIndex(0);
                              setCurrentSong(filteredSongs[0]);
                              audioEngine.play(filteredSongs[0].file);
                              setIsPlaying(true);
                            }}
                            className="flex items-center gap-2 bg-[#ff4e00] hover:bg-[#ff6a2b] text-white transition-all hover:scale-105 rounded-full py-2 px-4 text-sm font-medium shadow-lg shadow-[#ff4e00]/20 cursor-pointer ml-4"
                          >
                            <Play className="w-4 h-4 fill-current" /> Play All
                          </button>
                        )}
                      </div>
                      {songs.length > 0 && (
                        <>
                          <div className="hidden md:flex relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                            <input 
                              type="text" 
                              placeholder="Search library..." 
                              value={librarySearchQuery}
                              onChange={e => setLibrarySearchQuery(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#ff4e00]/50 focus:bg-white/10 transition-all"
                            />
                          </div>
                          <button 
                            className="md:hidden p-2 bg-white/5 border border-white/10 rounded-full text-white/70"
                            onClick={() => setShowSearchModal(true)}
                          >
                            <Search className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                    
                    {songs.length > 0 && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <SortDropdown selected={sortOption} onChange={setSortOption} />
                        <FilterDropdown 
                          label="Artist" 
                          options={availableArtists} 
                          selected={selectedArtists} 
                          onChange={setSelectedArtists} 
                        />
                        <FilterDropdown 
                          label="Album" 
                          options={availableAlbums} 
                          selected={selectedAlbums} 
                          onChange={setSelectedAlbums} 
                        />
                        <FilterDropdown 
                          label="Format" 
                          options={availableExtensions} 
                          selected={selectedExtensions} 
                          onChange={setSelectedExtensions} 
                        />
                        {(selectedArtists.length > 0 || selectedAlbums.length > 0 || selectedExtensions.length > 0) && (
                          <button 
                            onClick={() => {
                              setSelectedArtists([]);
                              setSelectedAlbums([]);
                              setSelectedExtensions([]);
                            }}
                            className="text-xs text-white/40 hover:text-white transition-colors cursor-pointer ml-2"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {songs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[60%] text-white/40">
                      <Disc3 className="w-24 h-24 mb-6 opacity-20" />
                      <p className="text-lg font-light text-white/70 mb-6">Your library is empty.</p>
                      <button 
                        onClick={triggerScan}
                        disabled={isScanning}
                        className="flex items-center justify-center gap-2 bg-[#ff4e00] hover:bg-[#ff6a2b] text-white transition-all hover:scale-105 rounded-full py-4 px-8 text-base font-medium shadow-lg shadow-[#ff4e00]/20 cursor-pointer"
                      >
                        <FolderSearch className="w-5 h-5" />
                        {isScanning ? `Scanning your music... ${scanProgress.current}/${scanProgress.total}` : "Scan Local Library"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-8">
                        {filteredSongs.slice(0, visibleCount).map((song) => (
                        <motion.div 
                          key={song.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -4, transition: { duration: 0.2, ease: "easeOut" } }}
                          onClick={() => playSongFromLibrary(song)}
                          className={cn(
                            "glass-panel rounded-2xl p-4 cursor-pointer transition-all hover:bg-white/10 group",
                            currentSong?.id === song.id ? "ring-2 ring-[#ff4e00] bg-white/5" : ""
                          )}
                          style={{ contentVisibility: 'auto', containIntrinsicSize: '200px' }}
                        >
                          <div className="aspect-square rounded-xl overflow-hidden mb-4 bg-black/40 relative shadow-lg">
                            {song.coverUrl ? (
                              <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Music className="w-12 h-12 text-white/20" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="w-12 h-12 text-white fill-white" />
                            </div>
                          </div>
                          <MarqueeText className="font-medium text-sm mb-1">{song.title}</MarqueeText>
                          <MarqueeText className="text-xs text-white/50">{song.artist}{song.album && song.album !== 'Unknown Album' ? ` • ${song.album}` : ''}</MarqueeText>
                          {(song.codec || song.bitsPerSample || song.bitrate) && (
                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
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
                        </motion.div>
                      ))}
                    </div>
                    {visibleCount < filteredSongs.length && (
                      <div ref={observerTarget} className="h-20 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-[#ff4e00] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </>
                )}
              </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Player Bar */}
      <div className="absolute bottom-0 left-0 w-full h-20 md:h-24 glass-panel border-t border-white/10 z-40 flex items-center px-4 md:px-6 gap-2 md:gap-4 bg-black/80 backdrop-blur-xl justify-between">
        {/* Now Playing Info */}
        <div 
          className="flex items-center gap-2 md:gap-4 w-[35%] md:w-1/4 min-w-0 cursor-pointer hover:bg-white/5 p-1 md:p-2 -ml-1 md:-ml-2 rounded-xl transition-all group shrink-0 overflow-hidden"
          onClick={() => currentSong && setShowLyrics(!showLyrics)}
        >
          {currentSong ? (
            <>
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-lg overflow-hidden bg-black/40 shrink-0 shadow-md relative">
                {currentSong.coverUrl ? (
                  <img src={currentSong.coverUrl} alt="Cover" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center group-hover:opacity-50 transition-opacity">
                    <Music className="w-5 h-5 md:w-6 md:h-6 text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronUp className={`w-5 h-5 md:w-6 md:h-6 text-white transition-transform duration-300 ${showLyrics ? 'rotate-180' : ''}`} />
                </div>
              </div>
              <div className="overflow-hidden flex flex-col justify-center flex-1 min-w-0">
                <MarqueeText className="font-medium text-xs md:text-sm">{currentSong.title}</MarqueeText>
                <MarqueeText className="text-[10px] md:text-xs text-white/50 mb-1">
                  {currentSong.artist}
                  <span className="hidden md:inline">{currentSong.album && currentSong.album !== 'Unknown Album' ? ` • ${currentSong.album}` : ''}</span>
                </MarqueeText>
                {(currentSong.codec || currentSong.bitsPerSample || currentSong.bitrate) && (
                  <div className="hidden md:flex items-center gap-1.5">
                    {currentSong.codec && (
                      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-white/10 text-white/70 border border-white/5">
                        {currentSong.codec}
                      </span>
                    )}
                    {(currentSong.bitsPerSample || currentSong.bitrate) && currentSong.sampleRate && (
                      <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded-sm bg-[#ff4e00]/20 text-[#ff4e00] border border-[#ff4e00]/20">
                        {currentSong.bitsPerSample ? `${currentSong.bitsPerSample}-bit` : `${Math.round(currentSong.bitrate! / 1000)} kbps`} / {(currentSong.sampleRate / 1000).toFixed(1)}kHz
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-xs md:text-sm text-white/30 font-light">No track selected</div>
          )}
        </div>

        {/* Controls & Progress */}
        <div className="flex-1 flex flex-col items-center justify-center gap-1 md:gap-2 min-w-0 px-2">
          <div className="flex items-center gap-3 md:gap-6">
            <button 
              onClick={() => {
                const modes: LoopMode[] = ['none', 'all', 'one', 'shuffle'];
                setLoopMode(modes[(modes.indexOf(loopMode) + 1) % modes.length]);
              }} 
              className={cn("transition-colors cursor-pointer", loopMode !== 'none' ? "text-[#ff4e00]" : "text-white/60 hover:text-white")}
            >
              {loopMode === 'one' ? <Repeat1 className="w-3 h-3 md:w-4 md:h-4" /> : loopMode === 'shuffle' ? <Shuffle className="w-3 h-3 md:w-4 md:h-4" /> : <Repeat className="w-3 h-3 md:w-4 md:h-4" />}
            </button>
            <button onClick={handlePrev} className="text-white/60 hover:text-white transition-colors cursor-pointer">
              <SkipBack className="w-4 h-4 md:w-5 md:h-5 fill-current" />
            </button>
            <button 
              onClick={togglePlay}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/10 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5 fill-current" /> : <Play className="w-4 h-4 md:w-5 md:h-5 fill-current ml-0.5 md:ml-1" />}
            </button>
            <button onClick={handleNext} className="text-white/60 hover:text-white transition-colors cursor-pointer">
              <SkipForward className="w-4 h-4 md:w-5 md:h-5 fill-current" />
            </button>
            <button 
              onClick={() => setShowQueue(!showQueue)}
              className={cn("transition-colors cursor-pointer", showQueue ? "text-[#ff4e00]" : "text-white/60 hover:text-white")}
            >
              <List className="w-3 h-3 md:w-4 md:h-4" />
            </button>
          </div>
          
          <div className="w-full flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-white/50 font-mono">
            <span>{formatTime(progress)}</span>
            <input 
              type="range" 
              min={0} 
              max={currentSong?.duration || 100} 
              value={progress}
              onChange={handleSeek}
              className="flex-1 cursor-pointer h-1 md:h-1.5"
            />
            <span>{formatTime(currentSong?.duration || 0)}</span>
          </div>
        </div>

        {/* Volume & Visualizer */}
        <div className="flex w-auto md:w-1/4 min-w-0 items-center justify-end gap-1 md:gap-4 relative shrink-0">
          <div className="hidden md:block w-32 h-12 rounded-lg overflow-hidden opacity-80 mix-blend-screen">
            <Visualizer />
          </div>
          <div className="flex items-center gap-1 md:gap-2 relative group" onWheel={handleWheelVolume}>
            <button 
              onClick={() => {
                if (window.innerWidth < 768) {
                  setShowMobileVolume(!showMobileVolume);
                } else {
                  toggleMute();
                }
              }} 
              className="text-white/60 hover:text-white transition-colors cursor-pointer p-2 shrink-0"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            
            {/* Desktop Volume Slider */}
            <input 
              type="range" 
              min={0} 
              max={1} 
              step={0.01}
              value={volume}
              onChange={handleVolume}
              className="hidden md:block w-20 cursor-pointer"
            />

            {/* Mobile Vertical Volume Slider */}
            <div className={cn(
              "md:hidden absolute bottom-full right-0 mb-4 p-2 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl transition-all z-50",
              showMobileVolume ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
            )}>
              <div className="h-32 w-8 flex items-center justify-center">
                <input 
                  type="range" 
                  min={0} 
                  max={1} 
                  step={0.01}
                  value={volume}
                  onChange={handleVolume}
                  className="w-32 cursor-pointer accent-[#ff4e00]"
                  style={{ transform: 'rotate(-90deg)', width: '100px' }}
                />
              </div>
            </div>
          </div>
          
          {/* Queue Overlay */}
          <AnimatePresence>
            {showQueue && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="fixed md:absolute bottom-24 right-4 left-4 md:left-auto md:right-0 md:w-96 h-[70vh] md:h-auto md:max-h-[60vh] bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50"
              >
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium flex items-center gap-2"><List className="w-4 h-4" /> Play Queue</h3>
                    {playQueue.length > 0 && (
                      <div className="flex items-center gap-2 ml-2">
                        <input 
                          type="checkbox" 
                          checked={selectedQueueItems.size === playQueue.length && playQueue.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedQueueItems(new Set(playQueue.map((_, i) => i)));
                            } else {
                              setSelectedQueueItems(new Set());
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-[#ff4e00] focus:ring-[#ff4e00]/50 cursor-pointer"
                        />
                        <span className="text-xs text-white/50">All</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedQueueItems.size > 0 && (
                      <button 
                        onClick={() => {
                          const newQueue = playQueue.filter((_, i) => !selectedQueueItems.has(i));
                          let newIndex = queueIndex;
                          
                          if (selectedQueueItems.has(queueIndex)) {
                              let nextAvailable = -1;
                              for (let i = queueIndex + 1; i < playQueue.length; i++) {
                                  if (!selectedQueueItems.has(i)) { nextAvailable = i; break; }
                              }
                              if (nextAvailable === -1) {
                                  for (let i = 0; i < queueIndex; i++) {
                                      if (!selectedQueueItems.has(i)) { nextAvailable = i; break; }
                                  }
                              }
                              if (nextAvailable !== -1) {
                                  newIndex = playQueue.slice(0, nextAvailable).filter((_, i) => !selectedQueueItems.has(i)).length;
                                  setQueueIndex(newIndex);
                                  setCurrentSong(newQueue[newIndex]);
                                  audioEngine.play(newQueue[newIndex].file);
                                  setIsPlaying(true);
                              } else {
                                  setQueueIndex(-1);
                                  setCurrentSong(null);
                                  audioEngine.pause();
                                  setIsPlaying(false);
                              }
                          } else {
                              newIndex = playQueue.slice(0, queueIndex).filter((_, i) => !selectedQueueItems.has(i)).length;
                              setQueueIndex(newIndex);
                          }
                          
                          setPlayQueue(newQueue);
                          setSelectedQueueItems(new Set());
                        }}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Delete ({selectedQueueItems.size})
                      </button>
                    )}
                    <span className="text-xs text-white/50">{playQueue.length} tracks</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2" ref={queueContainerRef}>
                  {playQueue.length === 0 ? (
                    <div className="p-8 text-center text-white/40 text-sm">Queue is empty</div>
                  ) : (
                    playQueue.map((song, index) => (
                      <div 
                        key={`${song.id}-${index}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', index.toString());
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                          const toIndex = index;
                          if (fromIndex === toIndex) return;
                          
                          const newQueue = [...playQueue];
                          const [movedSong] = newQueue.splice(fromIndex, 1);
                          newQueue.splice(toIndex, 0, movedSong);
                          
                          setPlayQueue(newQueue);
                          
                          // Update queueIndex if necessary
                          if (queueIndex === fromIndex) {
                            setQueueIndex(toIndex);
                          } else if (fromIndex < queueIndex && toIndex >= queueIndex) {
                            setQueueIndex(queueIndex - 1);
                          } else if (fromIndex > queueIndex && toIndex <= queueIndex) {
                            setQueueIndex(queueIndex + 1);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer",
                          queueIndex === index ? "bg-white/10 queue-item-active" : ""
                        )}
                        onClick={() => playSongFromQueue(index)}
                      >
                        <div className="flex items-center gap-2 shrink-0">
                          <input 
                            type="checkbox"
                            checked={selectedQueueItems.has(index)}
                            onChange={(e) => {
                              const newSet = new Set(selectedQueueItems);
                              if (e.target.checked) newSet.add(index);
                              else newSet.delete(index);
                              setSelectedQueueItems(newSet);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-[#ff4e00] focus:ring-[#ff4e00]/50 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ opacity: selectedQueueItems.has(index) ? 1 : undefined }}
                          />
                          <div className="w-5 text-center text-xs text-white/40 group-hover:hidden">
                            {index + 1}
                          </div>
                          <div className="w-5 text-center text-white/40 hover:text-white transition-all hidden group-hover:block cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()}>
                            <GripVertical className="w-4 h-4 mx-auto" />
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded bg-black/40 overflow-hidden shrink-0">
                          {song.coverUrl ? (
                            <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="w-3 h-3 text-white/20" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <MarqueeText className={cn("text-sm", queueIndex === index ? "text-[#ff4e00]" : "text-white")}>{song.title}</MarqueeText>
                          <MarqueeText className="text-xs text-white/50">{song.artist}{song.album && song.album !== 'Unknown Album' ? ` • ${song.album}` : ''}</MarqueeText>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-white/40" />
              <input 
                type="text" 
                placeholder="Search library..." 
                value={librarySearchQuery}
                onChange={e => setLibrarySearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-white placeholder:text-white/40 focus:outline-none text-lg"
              />
              <button onClick={() => setShowSearchModal(false)} className="text-white/60 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
