import React, { useState, useEffect, useCallback } from 'react';
import { Song, Playlist } from '../types';
import { Play, Music, Plus, Trash2, Search, X, ListMusic, LayoutGrid, List as ListIcon, Disc3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  // === 状态管理 ===
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId) || null;

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistCover, setNewPlaylistCover] = useState<string | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [editPlaylistCover, setEditPlaylistCover] = useState<string | null>(null);

  const [playlistSearchQuery, setPlaylistSearchQuery] = useState('');
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [selectedPlaylistSongs, setSelectedPlaylistSongs] = useState<Set<string>>(new Set());

  // === 🛡️ LIFO 手势拦截栈 ===
  const closeCreateModal = useCallback(() => setShowCreateModal(false), []);
  useEffect(() => {
    const stack = (window as any).aetheriaBackStack;
    if (stack && showCreateModal) stack.push(closeCreateModal);
    return () => { if (stack) (window as any).aetheriaBackStack = stack.filter((fn: any) => fn !== closeCreateModal); };
  }, [showCreateModal, closeCreateModal]);

  const closeEditModal = useCallback(() => setShowEditModal(false), []);
  useEffect(() => {
    const stack = (window as any).aetheriaBackStack;
    if (stack && showEditModal) stack.push(closeEditModal);
    return () => { if (stack) (window as any).aetheriaBackStack = stack.filter((fn: any) => fn !== closeEditModal); };
  }, [showEditModal, closeEditModal]);

  const closeAddSongModal = useCallback(() => setShowAddSongModal(false), []);
  useEffect(() => {
    const stack = (window as any).aetheriaBackStack;
    if (stack && showAddSongModal) stack.push(closeAddSongModal);
    return () => { if (stack) (window as any).aetheriaBackStack = stack.filter((fn: any) => fn !== closeAddSongModal); };
  }, [showAddSongModal, closeAddSongModal]);

  const closeSearchModal = useCallback(() => setShowSearchModal(false), []);
  useEffect(() => {
    const stack = (window as any).aetheriaBackStack;
    if (stack && showSearchModal) stack.push(closeSearchModal);
    return () => { if (stack) (window as any).aetheriaBackStack = stack.filter((fn: any) => fn !== closeSearchModal); };
  }, [showSearchModal, closeSearchModal]);

  // === 核心逻辑函数 ===
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

  const filteredPlaylists = playlists.filter(p =>
    p.name.toLowerCase().includes(playlistSearchQuery.toLowerCase())
  );

  // ==========================================
  // 渲染：单个歌单/专辑详情视图
  // ==========================================
  if (selectedPlaylist) {
    const playlistSongs = selectedPlaylist.songIds
      .map(id => songs.find(s => s.id === id))
      .filter((s): s is Song => s !== undefined);

    const coverUrl = getPlaylistCover(selectedPlaylist);
    const isAuto = selectedPlaylist.isAuto;

    return (
      <div className="flex flex-col h-full p-4 md:p-8 overflow-y-auto overflow-x-hidden">
        {/* 详情头部 */}
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
          <div className="flex flex-col justify-end h-auto md:h-48 py-2 w-full text-center md:text-left">
            <h2 className="text-sm font-medium text-white/60 uppercase tracking-widest mb-2 flex items-center justify-center md:justify-start gap-2">
              {isAuto ? <><Disc3 className="w-4 h-4" /> Album</> : <><ListMusic className="w-4 h-4" /> Playlist</>}
            </h2>
            <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight line-clamp-2">{selectedPlaylist.name}</h1>
              {!isAuto && (
                <button
                  onClick={openEditModal}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white shrink-0"
                  title="Edit Playlist"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-4 text-white/60">
              <span className="text-sm">{playlistSongs.length} songs</span>

              {!isAuto && selectedPlaylistSongs.size > 0 && (
                <button
                  onClick={() => {
                    const newSongIds = selectedPlaylist.songIds.filter(id => !selectedPlaylistSongs.has(id));
                    onReorderPlaylist(selectedPlaylist.id, newSongIds);
                    setSelectedPlaylistSongs(new Set());
                  }}
                  className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 md:px-4 py-1.5 md:py-2 rounded-full transition-colors text-xs md:text-sm"
                >
                  <Trash2 className="w-4 h-4" /> Delete ({selectedPlaylistSongs.size})
                </button>
              )}

              {!isAuto && (
                <button
                  onClick={() => setShowAddSongModal(true)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 md:px-4 py-1.5 md:py-2 rounded-full transition-colors text-white text-xs md:text-sm"
                >
                  <Plus className="w-4 h-4" /> Add Songs
                </button>
              )}

              <button
                onClick={() => {
                  setSelectedPlaylistId(null);
                  setSelectedPlaylistSongs(new Set());
                }}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 md:px-4 py-1.5 md:py-2 rounded-full transition-colors text-white text-xs md:text-sm md:ml-auto mt-2 md:mt-0"
              >
                Back
              </button>
            </div>
          </div>
        </div>

        {/* 详情歌曲列表 */}
        <div className="flex flex-col gap-1 pb-24 md:pb-10">
          {!isAuto && playlistSongs.length > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 text-xs text-white/40 border-b border-white/5 mb-2">
              <input
                type="checkbox"
                checked={selectedPlaylistSongs.size === playlistSongs.length && playlistSongs.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedPlaylistSongs(new Set(playlistSongs.map(s => s.id)));
                  else setSelectedPlaylistSongs(new Set());
                }}
                className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-[#ff4e00] focus:ring-[#ff4e00]/50 cursor-pointer"
              />
              <span className="ml-1">Select All</span>
            </div>
          )}
          {playlistSongs.map((song, index) => (
            <div
              key={`${song.id}-${index}`}
              draggable={!isAuto}
              onDragStart={(e) => !isAuto && e.dataTransfer.setData('text/plain', index.toString())}
              onDragOver={(e) => !isAuto && e.preventDefault()}
              onDrop={(e) => {
                if (isAuto) return;
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
                "flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer border border-transparent",
                currentSong?.id === song.id ? "bg-white/10 border-[#ff4e00]/30" : ""
              )}
            >
              {!isAuto && (
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
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-[#ff4e00] focus:ring-[#ff4e00]/50 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hidden md:block"
                  style={{ opacity: selectedPlaylistSongs.has(song.id) ? 1 : undefined }}
                />
              )}
              <div className="w-6 md:w-8 text-center text-white/40 text-xs md:text-sm group-hover:hidden shrink-0">{index + 1}</div>
              <div
                className="w-6 md:w-8 text-center hidden group-hover:flex items-center justify-center cursor-pointer shrink-0"
                onClick={() => onPlaySong(song, playlistSongs)}
              >
                <Play className="w-4 h-4 text-white fill-white" />
              </div>

              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden bg-black/40 shrink-0 relative shadow-md">
                {song.coverUrl ? (
                  <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-4 h-4 text-white/20" />
                  </div>
                )}
                <div className="md:hidden absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity" onClick={() => onPlaySong(song, playlistSongs)}>
                  <Play className="w-4 h-4 text-white fill-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0 overflow-hidden pr-2">
                <MarqueeText className={cn("font-medium text-sm md:text-base mb-0.5", currentSong?.id === song.id ? "text-[#ff4e00]" : "text-white")}>
                  {song.title}
                </MarqueeText>
                <MarqueeText className="text-xs text-white/50">
                  {song.artist}
                  <span className="md:hidden">{song.album && song.album !== 'Unknown Album' ? ` • ${song.album}` : ''}</span>
                </MarqueeText>
              </div>

              <div className="w-1/4 min-w-0 hidden md:block overflow-hidden">
                <MarqueeText className="text-xs md:text-sm text-white/60">{song.album}</MarqueeText>
              </div>

              {!isAuto && (
                <button
                  onClick={() => onRemoveSongFromPlaylist(selectedPlaylist.id, song.id)}
                  className="opacity-100 md:opacity-0 group-hover:opacity-100 p-2 text-white/30 hover:text-red-400 transition-all shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* ==========================================
            Modal: 添加歌曲
        ========================================== */}
        {showAddSongModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6">
            <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-white/10 shadow-2xl">
              <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg md:text-xl font-bold truncate pr-4">Add to {selectedPlaylist.name}</h3>
                <button onClick={() => setShowAddSongModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 md:p-6 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search library..."
                    value={songSearchQuery}
                    onChange={e => setSongSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-[#ff4e00]/50 focus:bg-white/10 transition-all"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 md:p-4">
                {songs
                  .filter(s => !selectedPlaylist.songIds.includes(s.id))
                  .filter(s =>
                    s.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
                    s.artist.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
                    s.album.toLowerCase().includes(songSearchQuery.toLowerCase())
                  )
                  .map(song => (
                    <div key={song.id} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 hover:bg-white/5 rounded-xl transition-colors">
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

        {/* ==========================================
            Modal: 编辑歌单
        ========================================== */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6">
            <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 md:p-8 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl md:text-2xl font-bold">Edit Playlist</h3>
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-center">
                  <label className="w-32 h-32 md:w-40 md:h-40 rounded-2xl border-2 border-dashed border-white/20 hover:border-[#ff4e00]/50 hover:bg-white/5 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group">
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

  // ==========================================
  // 渲染：主歌单列表视图 (Grid / List)
  // ==========================================
  return (
    <div className="flex flex-col h-full p-4 md:p-8 overflow-y-auto overflow-x-hidden">

      {/* 完美响应式的 Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <h2 className="text-4xl font-light tracking-tight shrink-0">Playlists</h2>

          {/* 桌面端搜索框 */}
          {playlists.length > 0 && (
            <div className="hidden md:flex relative w-64 ml-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search playlists..."
                value={playlistSearchQuery}
                onChange={e => setPlaylistSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#ff4e00]/50 focus:bg-white/10 transition-all"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end shrink-0">
          {/* 视图模式切换器 */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10 shrink-0 md:ml-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 rounded-full transition-all", viewMode === 'grid' ? "bg-white/20 text-white shadow-sm" : "text-white/40 hover:text-white")}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn("p-1.5 rounded-full transition-all", viewMode === 'list' ? "bg-white/20 text-white shadow-sm" : "text-white/40 hover:text-white")}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-[#ff4e00] hover:bg-[#ff6a2b] text-white transition-all hover:scale-105 rounded-full py-2 px-4 md:px-6 text-sm font-medium shadow-lg shadow-[#ff4e00]/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> <span className="hidden md:inline">New Playlist</span><span className="md:hidden">New</span>
          </button>

          {/* 移动端搜索唤起按钮 */}
          {playlists.length > 0 && (
            <button
              className="md:hidden p-2 bg-white/5 border border-white/10 rounded-full text-white/70"
              onClick={() => setShowSearchModal(true)}
            >
              <Search className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60%] text-white/40">
          <ListMusic className="w-24 h-24 mb-6 opacity-20" />
          <p className="text-lg font-light text-white/70 mb-6">No playlists yet.</p>
        </div>
      ) : viewMode === 'grid' ? (
        // Grid 模式视图
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-24 md:pb-10">
          {filteredPlaylists.map(playlist => {
            const coverUrl = getPlaylistCover(playlist);
            return (
              <motion.div
                key={playlist.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel rounded-2xl p-3 md:p-4 cursor-pointer transition-all hover:bg-white/10 group relative"
              >
                <div
                  className="aspect-square rounded-xl overflow-hidden mb-3 md:mb-4 bg-black/40 relative shadow-lg"
                  onClick={() => setSelectedPlaylistId(playlist.id)}
                >
                  {coverUrl ? (
                    <img src={coverUrl} alt={playlist.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {playlist.isAuto ? <Disc3 className="w-10 h-10 text-white/20" /> : <Music className="w-10 h-10 text-white/20" />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-10 h-10 md:w-12 md:h-12 text-white fill-white" />
                  </div>
                </div>
                <div onClick={() => setSelectedPlaylistId(playlist.id)}>
                  <MarqueeText className="font-medium text-sm mb-1">{playlist.name}</MarqueeText>
                </div>
                <p className="text-xs text-white/50 truncate mt-1 flex items-center gap-1.5">
                  {playlist.isAuto && <Disc3 className="w-3 h-3 text-[#ff4e00]" />}
                  {playlist.songIds.length} songs
                </p>

                {!playlist.isAuto && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeletePlaylist(playlist.id); }}
                    className="absolute top-4 right-4 md:top-6 md:right-6 p-2 md:p-2 bg-black/60 hover:bg-red-500/80 rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition-all text-white backdrop-blur-md"
                  >
                    <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>
      ) : (
        // List 模式视图
        <div className="flex flex-col gap-2 pb-24 md:pb-10 max-w-5xl mx-auto w-full">
          {filteredPlaylists.map(playlist => {
            const coverUrl = getPlaylistCover(playlist);
            return (
              <motion.div
                key={playlist.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setSelectedPlaylistId(playlist.id)}
                className="flex items-center gap-4 p-3 glass-panel rounded-xl hover:bg-white/10 transition-colors group cursor-pointer"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden bg-black/40 shrink-0 relative shadow-md">
                  {coverUrl ? (
                    <img src={coverUrl} alt={playlist.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {playlist.isAuto ? <Disc3 className="w-6 h-6 text-white/20" /> : <Music className="w-6 h-6 text-white/20" />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="font-medium text-base md:text-lg truncate">{playlist.name}</div>
                  <div className="text-xs md:text-sm text-white/50 flex items-center gap-2 mt-0.5">
                    {playlist.isAuto ? (
                      <span className="flex items-center gap-1 text-[#ff4e00]"><Disc3 className="w-3 h-3" /> Auto Album</span>
                    ) : (
                      <span className="flex items-center gap-1"><ListMusic className="w-3 h-3" /> Custom Playlist</span>
                    )}
                    <span>•</span>
                    <span>{playlist.songIds.length} tracks</span>
                  </div>
                </div>
                {!playlist.isAuto && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeletePlaylist(playlist.id); }}
                    className="p-3 text-white/30 hover:text-red-400 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ==========================================
          Modal: 移动端搜索歌单
      ========================================== */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-white/40" />
              <input
                type="text"
                placeholder="Search playlists..."
                value={playlistSearchQuery}
                onChange={e => setPlaylistSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-white placeholder:text-white/40 focus:outline-none text-lg"
              />
              <button
                onClick={() => {
                  setShowSearchModal(false);
                }}
                className="text-white/60 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          Modal: 新建歌单
      ========================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 md:p-8 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl md:text-2xl font-bold">New Playlist</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-center">
                <label className="w-32 h-32 md:w-40 md:h-40 rounded-2xl border-2 border-dashed border-white/20 hover:border-[#ff4e00]/50 hover:bg-white/5 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group">
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