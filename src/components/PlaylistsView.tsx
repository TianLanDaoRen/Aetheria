import React, { useState } from 'react';
import { Song, Playlist } from '../types';
import { Play, Music, Plus, Trash2, Search, X, ListMusic } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { MarqueeText } from './MarqueeText';

interface PlaylistsViewProps {
  playlists: Playlist[];
  songs: Song[];
  currentSong: Song | null;
  onPlayPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: (name: string, coverUrl: string | null) => void;
  onUpdatePlaylist: (id: string, name: string, coverUrl: string | null) => void;
  onDeletePlaylist: (id: string) => void;
  onAddSongToPlaylist: (playlistId: string, songId: string) => void;
  onRemoveSongFromPlaylist: (playlistId: string, songId: string) => void;
  onReorderPlaylist: (playlistId: string, newSongIds: string[]) => void;
  onPlaySong: (song: Song, playlistSongs: Song[]) => void;
}

export function PlaylistsView({
  playlists,
  songs,
  currentSong,
  onPlayPlaylist,
  onCreatePlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  onAddSongToPlaylist,
  onRemoveSongFromPlaylist,
  onReorderPlaylist,
  onPlaySong
}: PlaylistsViewProps) {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId) || null;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistCover, setNewPlaylistCover] = useState<string | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [editPlaylistCover, setEditPlaylistCover] = useState<string | null>(null);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlaylistSongs, setSelectedPlaylistSongs] = useState<Set<string>>(new Set());

  const getPlaylistCover = (playlist: Playlist) => {
    if (playlist.coverUrl) return playlist.coverUrl;
    for (const songId of playlist.songIds) {
      const song = songs.find(s => s.id === songId);
      if (song?.coverUrl) return song.coverUrl;
    }
    return null;
  };

  const handleCreate = () => {
    if (!newPlaylistName.trim()) return;
    onCreatePlaylist(newPlaylistName, newPlaylistCover);
    setNewPlaylistName('');
    setNewPlaylistCover(null);
    setShowCreateModal(false);
  };

  const handleEdit = () => {
    if (!editPlaylistName.trim() || !selectedPlaylist) return;
    onUpdatePlaylist(selectedPlaylist.id, editPlaylistName, editPlaylistCover);
    setShowEditModal(false);
  };

  const openEditModal = () => {
    if (!selectedPlaylist) return;
    setEditPlaylistName(selectedPlaylist.name);
    setEditPlaylistCover(selectedPlaylist.coverUrl || null);
    setShowEditModal(true);
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        if (isEdit) {
          setEditPlaylistCover(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          setNewPlaylistCover(canvas.toDataURL('image/jpeg', 0.8));
        }
      };
      img.src = URL.createObjectURL(file);
    }
  };

  if (selectedPlaylist) {
    const playlistSongs = selectedPlaylist.songIds
      .map(id => songs.find(s => s.id === id))
      .filter((s): s is Song => s !== undefined);

    const coverUrl = getPlaylistCover(selectedPlaylist);

    return (
      <div className="flex flex-col h-full p-4 md:p-8 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8">
          <div className="w-48 h-48 rounded-2xl overflow-hidden bg-black/40 shrink-0 shadow-2xl relative group">
            {coverUrl ? (
              <img src={coverUrl} alt={selectedPlaylist.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-16 h-16 text-white/20" />
              </div>
            )}
            <div 
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              onClick={() => onPlayPlaylist(selectedPlaylist)}
            >
              <Play className="w-16 h-16 text-white fill-white" />
            </div>
          </div>
          <div className="flex flex-col justify-end h-48 py-2">
            <h2 className="text-sm font-medium text-white/60 uppercase tracking-widest mb-2">Playlist</h2>
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-5xl font-bold tracking-tight">{selectedPlaylist.name}</h1>
              <button 
                onClick={openEditModal}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                title="Edit Playlist"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
            </div>
            <div className="flex items-center gap-4 text-white/60">
              <span>{playlistSongs.length} songs</span>
              {selectedPlaylistSongs.size > 0 && (
                <button 
                  onClick={() => {
                    const newSongIds = selectedPlaylist.songIds.filter(id => !selectedPlaylistSongs.has(id));
                    onReorderPlaylist(selectedPlaylist.id, newSongIds);
                    setSelectedPlaylistSongs(new Set());
                  }}
                  className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-full transition-colors text-sm ml-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete ({selectedPlaylistSongs.size})
                </button>
              )}
              <button 
                onClick={() => setShowAddSongModal(true)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-colors text-white text-sm"
              >
                <Plus className="w-4 h-4" /> Add Songs
              </button>
              <button 
                onClick={() => {
                  setSelectedPlaylistId(null);
                  setSelectedPlaylistSongs(new Set());
                }}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full transition-colors text-white text-sm ml-auto"
              >
                Back to Playlists
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {playlistSongs.length > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 text-xs text-white/40 border-b border-white/5 mb-2">
              <input 
                type="checkbox"
                checked={selectedPlaylistSongs.size === playlistSongs.length && playlistSongs.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedPlaylistSongs(new Set(playlistSongs.map(s => s.id)));
                  } else {
                    setSelectedPlaylistSongs(new Set());
                  }
                }}
                className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-[#ff4e00] focus:ring-[#ff4e00]/50 cursor-pointer"
              />
              <span className="ml-1">Select All</span>
            </div>
          )}
          {playlistSongs.map((song, index) => (
            <div 
              key={`${song.id}-${index}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', index.toString())}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;
                if (fromIndex === toIndex) return;
                
                const newSongIds = [...selectedPlaylist.songIds];
                const [moved] = newSongIds.splice(fromIndex, 1);
                newSongIds.splice(toIndex, 0, moved);
                
                onReorderPlaylist(selectedPlaylist.id, newSongIds);
              }}
              className={cn(
                "flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer",
                currentSong?.id === song.id ? "bg-white/10" : ""
              )}
            >
              <input 
                type="checkbox"
                checked={selectedPlaylistSongs.has(song.id)}
                onChange={(e) => {
                  const newSet = new Set(selectedPlaylistSongs);
                  if (e.target.checked) newSet.add(song.id);
                  else newSet.delete(song.id);
                  setSelectedPlaylistSongs(newSet);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-[#ff4e00] focus:ring-[#ff4e00]/50 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ opacity: selectedPlaylistSongs.has(song.id) ? 1 : undefined }}
              />
              <div className="w-8 text-center text-white/40 text-sm group-hover:hidden">{index + 1}</div>
              <div 
                className="w-8 text-center hidden group-hover:flex items-center justify-center cursor-pointer"
                onClick={() => onPlaySong(song, playlistSongs)}
              >
                <Play className="w-4 h-4 text-white fill-white" />
              </div>
              
              <div className="w-10 h-10 rounded-md overflow-hidden bg-black/40 shrink-0">
                {song.coverUrl ? (
                  <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-4 h-4 text-white/20" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0 overflow-hidden">
                <MarqueeText className="font-medium text-sm">{song.title}</MarqueeText>
                <MarqueeText className="text-xs text-white/50">{song.artist}</MarqueeText>
              </div>
              
              <div className="w-1/4 min-w-0 hidden md:block overflow-hidden">
                <MarqueeText className="text-xs text-white/50">{song.album}</MarqueeText>
              </div>

              <div className="w-1/4 min-w-0 hidden lg:flex items-center gap-1.5 overflow-hidden">
                {song.codec && (
                  <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-white/10 text-white/70 border border-white/5 shrink-0">
                    {song.codec}
                  </span>
                )}
                {(song.bitsPerSample || song.bitrate) && song.sampleRate && (
                  <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded-sm bg-[#ff4e00]/20 text-[#ff4e00] border border-[#ff4e00]/20 shrink-0 truncate">
                    {song.bitsPerSample ? `${song.bitsPerSample}-bit` : `${Math.round(song.bitrate! / 1000)} kbps`} / {(song.sampleRate / 1000).toFixed(1)}kHz
                  </span>
                )}
              </div>
              
              <button 
                onClick={() => onRemoveSongFromPlaylist(selectedPlaylist.id, song.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-white/40 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Song Modal */}
        {showAddSongModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-white/10 shadow-2xl">
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-bold">Add Songs to {selectedPlaylist.name}</h3>
                <button onClick={() => setShowAddSongModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input 
                    type="text" 
                    placeholder="Search library..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-[#ff4e00]/50 focus:bg-white/10 transition-all"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {songs
                  .filter(s => !selectedPlaylist.songIds.includes(s.id))
                  .filter(s => 
                    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    s.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    s.album.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(song => (
                    <div key={song.id} className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors">
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-black/40 shrink-0">
                        {song.coverUrl ? (
                          <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-4 h-4 text-white/20" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <MarqueeText className="font-medium text-sm">{song.title}</MarqueeText>
                        <MarqueeText className="text-xs text-white/50">{song.artist}{song.album && song.album !== 'Unknown Album' ? ` • ${song.album}` : ''}</MarqueeText>
                      </div>
                      <button 
                        onClick={() => onAddSongToPlaylist(selectedPlaylist.id, song.id)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-[#ff4e00]"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      {/* Edit Playlist Modal */}
      {showEditModal && selectedPlaylist && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-8 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Edit Playlist</h3>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-center">
                <label className="w-40 h-40 rounded-2xl border-2 border-dashed border-white/20 hover:border-[#ff4e00]/50 hover:bg-white/5 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group">
                  {editPlaylistCover ? (
                    <>
                      <img src={editPlaylistCover} alt="Cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-sm font-medium">Change Cover</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Plus className="w-8 h-8 text-white/40 mb-2" />
                      <span className="text-sm text-white/40 font-medium">Upload Cover</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverUpload(e, true)} />
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Playlist Name</label>
                <input 
                  type="text" 
                  value={editPlaylistName}
                  onChange={e => setEditPlaylistName(e.target.value)}
                  placeholder="My Awesome Mix"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-[#ff4e00]/50 focus:bg-white/10 transition-all"
                  autoFocus
                />
              </div>
              
              <button 
                onClick={handleEdit}
                disabled={!editPlaylistName.trim()}
                className="w-full bg-[#ff4e00] hover:bg-[#ff6a2b] disabled:opacity-50 disabled:hover:bg-[#ff4e00] text-white transition-all rounded-xl py-3 font-medium shadow-lg shadow-[#ff4e00]/20 mt-2"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-8 overflow-y-auto overflow-x-hidden">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-light tracking-tight">Your Playlists</h2>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-[#ff4e00] hover:bg-[#ff6a2b] text-white transition-all hover:scale-105 rounded-full py-2 px-6 text-sm font-medium shadow-lg shadow-[#ff4e00]/20"
        >
          <Plus className="w-4 h-4" /> New Playlist
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {playlists.map(playlist => {
          const coverUrl = getPlaylistCover(playlist);
          return (
          <motion.div 
            key={playlist.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, transition: { duration: 0.2, ease: "easeOut" } }}
            className="glass-panel rounded-2xl p-4 cursor-pointer transition-all hover:bg-white/10 group relative"
          >
            <div 
              className="aspect-square rounded-xl overflow-hidden mb-4 bg-black/40 relative shadow-lg"
              onClick={() => setSelectedPlaylistId(playlist.id)}
            >
              {coverUrl ? (
                <img src={coverUrl} alt={playlist.name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-12 h-12 text-white/20" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="w-12 h-12 text-white fill-white" />
              </div>
            </div>
            <div onClick={() => setSelectedPlaylistId(playlist.id)}>
              <MarqueeText className="font-medium text-sm mb-1">{playlist.name}</MarqueeText>
            </div>
            <p className="text-xs text-white/50 truncate mt-1">{playlist.songIds.length} songs</p>
            
            <button 
              onClick={(e) => { e.stopPropagation(); onDeletePlaylist(playlist.id); }}
              className="absolute top-6 right-6 p-2 bg-black/60 hover:bg-red-500/80 rounded-full opacity-0 group-hover:opacity-100 transition-all text-white backdrop-blur-md"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        )})}
      </div>

      {playlists.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[60%] text-white/40">
          <ListMusic className="w-24 h-24 mb-6 opacity-20" />
          <p className="text-lg font-light text-white/70 mb-6">No playlists yet.</p>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-8 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">New Playlist</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-center">
                <label className="w-40 h-40 rounded-2xl border-2 border-dashed border-white/20 hover:border-[#ff4e00]/50 hover:bg-white/5 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group">
                  {newPlaylistCover ? (
                    <>
                      <img src={newPlaylistCover} alt="Cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-sm font-medium">Change Cover</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Plus className="w-8 h-8 text-white/40 mb-2" />
                      <span className="text-sm text-white/40 font-medium">Upload Cover</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverUpload(e, false)} />
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Playlist Name</label>
                <input 
                  type="text" 
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  placeholder="My Awesome Mix"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-[#ff4e00]/50 focus:bg-white/10 transition-all"
                  autoFocus
                />
              </div>
              
              <button 
                onClick={handleCreate}
                disabled={!newPlaylistName.trim()}
                className="w-full bg-[#ff4e00] hover:bg-[#ff6a2b] disabled:opacity-50 disabled:hover:bg-[#ff4e00] text-white transition-all rounded-xl py-3 font-medium shadow-lg shadow-[#ff4e00]/20 mt-2"
              >
                Create Playlist
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
