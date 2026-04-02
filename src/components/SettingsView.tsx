import React, { useState, useEffect } from 'react';
import { Settings, Volume2, Sliders, AudioLines, Ear, RefreshCw, FolderSearch, Trash2 } from 'lucide-react';
import { audioEngine } from '../lib/audioEngine';
import { cn } from '../lib/utils';
import { Song } from '../types';

interface SettingsViewProps {
  onClose: () => void;
  songs: Song[];
  onClearLibrary: () => void;
}

export function SettingsView({ onClose, songs, onClearLibrary }: SettingsViewProps) {
  const [settings, setSettings] = useState(audioEngine.settings);

  useEffect(() => {
    // Update local state when settings change
    setSettings(audioEngine.settings);
  }, []);

  const updateSetting = (key: keyof typeof settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    audioEngine.updateSettings(newSettings);
  };

  const updateEQ = (index: number, value: number) => {
    const newEq = [...settings.eq];
    newEq[index] = value;
    updateSetting('eq', newEq);
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden pb-32">
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Settings className="w-8 h-8 text-[#ff4e00]" />
          <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
        </div>

        <div className="grid gap-8">
          {/* Library Actions */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <FolderSearch className="w-5 h-5 text-[#ff4e00]" />
              Library
            </h2>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Library Status</h3>
                <p className="text-sm text-white/50">{songs.length} tracks in current session.</p>
              </div>
              <button
                onClick={onClearLibrary}
                className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors px-4 py-2 rounded-full border border-red-400/20 hover:bg-red-400/10"
              >
                Clear Library
              </button>
            </div>
          </section>

          {/* Playback Algorithms */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-[#ff4e00]" />
              Playback Algorithms
            </h2>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Automatic Crossfade</h3>
                  <p className="text-sm text-white/50">Seamlessly blend the end of one song into the beginning of the next.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.crossfade}
                    onChange={(e) => updateSetting('crossfade', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ff4e00]"></div>
                </label>
              </div>

              {settings.crossfade && (
                <div className="pl-4 border-l-2 border-white/10">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/70">Crossfade Duration</span>
                    <span className="text-[#ff4e00] font-mono">{settings.crossfadeDuration}s</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="1"
                    value={settings.crossfadeDuration}
                    onChange={(e) => updateSetting('crossfadeDuration', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between text-sm mb-2">
                  <div>
                    <h3 className="font-medium">Playback Fade Duration</h3>
                    <p className="text-xs text-white/50">Smoothly fade in/out when playing or pausing.</p>
                  </div>
                  <span className="text-[#ff4e00] font-mono">{settings.playbackFadeDuration}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={settings.playbackFadeDuration}
                  onChange={(e) => updateSetting('playbackFadeDuration', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div>
                  <h3 className="font-medium">Force Mono</h3>
                  <p className="text-sm text-white/50">Mix stereo channels into a single mono channel.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.forceMono}
                    onChange={(e) => updateSetting('forceMono', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ff4e00]"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Equalizer */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#ff4e00]" />
              Equalizer (EQ)
            </h2>

            <div className="grid grid-cols-3 gap-8">
              {[
                { label: 'Low', value: settings.eq[0], index: 0 },
                { label: 'Mid', value: settings.eq[1], index: 1 },
                { label: 'High', value: settings.eq[2], index: 2 }
              ].map((band) => (
                <div key={band.label} className="flex flex-col items-center gap-4">
                  <span className="text-sm font-medium text-white/70">{band.label}</span>
                  <div className="h-32 flex items-center justify-center">
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.1"
                      value={band.value}
                      onChange={(e) => updateEQ(band.index, parseFloat(e.target.value))}
                      className="w-32 -rotate-90"
                    />
                  </div>
                  <span className="text-xs font-mono text-[#ff4e00]">
                    {band.value > 0 ? '+' : ''}{band.value.toFixed(1)} dB
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => updateSetting('eq', [0, 0, 0])}
                className="text-xs text-white/50 hover:text-white transition-colors px-3 py-1 rounded-full border border-white/10 hover:bg-white/5"
              >
                Reset EQ
              </button>
            </div>
          </section>

          {/* Volume & Gain */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-[#ff4e00]" />
              Volume & Dynamics
            </h2>

            <div className="space-y-8">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <div>
                    <h3 className="font-medium">Pre-Gain Adjustment</h3>
                    <p className="text-xs text-white/50">Adjust the base volume level before processing.</p>
                  </div>
                  <span className="text-[#ff4e00] font-mono">{settings.gain > 0 ? '+' : ''}{settings.gain} dB</span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={settings.gain}
                  onChange={(e) => updateSetting('gain', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <div>
                    <h3 className="font-medium">Volume Limit</h3>
                    <p className="text-xs text-white/50">Set a maximum output volume to protect your hearing.</p>
                  </div>
                  <span className="text-[#ff4e00] font-mono">{settings.volumeLimit}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="1"
                  value={settings.volumeLimit}
                  onChange={(e) => updateSetting('volumeLimit', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </section>

          {/* Channel Balance */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Ear className="w-5 h-5 text-[#ff4e00]" />
              Accessibility
            </h2>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <div>
                  <h3 className="font-medium">Channel Balance</h3>
                  <p className="text-xs text-white/50">Adjust the audio balance between left and right channels.</p>
                </div>
                <span className="text-[#ff4e00] font-mono">
                  {settings.balance === 0 ? 'Center' : settings.balance < 0 ? `L ${Math.abs(settings.balance * 100).toFixed(0)}%` : `R ${(settings.balance * 100).toFixed(0)}%`}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-white/50">L</span>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={settings.balance}
                  onChange={(e) => updateSetting('balance', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs font-medium text-white/50">R</span>
              </div>
            </div>
          </section>

          {/* Audio Output Info */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <AudioLines className="w-5 h-5 text-[#ff4e00]" />
              Audio Output Information
            </h2>
            <p className="text-sm text-white/70 leading-relaxed">
              Aetheria V2026.04.02.04 uses the Web Audio API for high-fidelity audio processing.
              While the internal processing supports up to 32 channels (e.g., 5.1.2, 7.1.4 Dolby Atmos setups),
              the actual output channel count is determined by your browser and operating system's hardware configuration.
              Currently, the Web Audio API defaults to Stereo (2 channels) or 5.1 Surround depending on your system's default audio device.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
