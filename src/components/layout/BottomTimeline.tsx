import { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { formatTimestamp } from '@/utils/export';

export default function BottomTimeline() {
  const {
    layout,
    currentPlaybackIndex,
    isPlaybackPlaying,
    setPlaybackIndex,
    setPlaybackPlaying,
  } = useStore();

  const records = layout.inventoryRecords;
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaybackPlaying) {
      intervalRef.current = window.setInterval(() => {
        const next = currentPlaybackIndex >= records.length - 1 ? -1 : currentPlaybackIndex + 1;
        if (next === -1) {
          setPlaybackPlaying(false);
        }
        setPlaybackIndex(next);
      }, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaybackPlaying, records.length, currentPlaybackIndex, setPlaybackIndex, setPlaybackPlaying]);

  const handlePlayPause = () => {
    if (currentPlaybackIndex >= records.length - 1) {
      setPlaybackIndex(-1);
    }
    setPlaybackPlaying(!isPlaybackPlaying);
  };

  const handlePrev = () => {
    setPlaybackPlaying(false);
    setPlaybackIndex(Math.max(-1, currentPlaybackIndex - 1));
  };

  const handleNext = () => {
    setPlaybackPlaying(false);
    setPlaybackIndex(Math.min(records.length - 1, currentPlaybackIndex + 1));
  };

  const handleSeek = (index: number) => {
    setPlaybackPlaying(false);
    setPlaybackIndex(index);
  };

  const currentRecord = currentPlaybackIndex >= 0 ? records[currentPlaybackIndex] : null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4">
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-4 mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-blue-400" />
            <span className="text-sm text-slate-300">历史回放</span>
          </div>
          <div className="text-sm">
            {currentRecord ? (
              <span className="text-white font-mono">
                {formatTimestamp(currentRecord.timestamp)}
                {currentRecord.note && <span className="text-slate-400 ml-2">({currentRecord.note})</span>}
              </span>
            ) : (
              <span className="text-blue-400">当前快照</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="上一帧"
            >
              <SkipBack size={16} />
            </button>
            <button
              onClick={handlePlayPause}
              className="p-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              title={isPlaybackPlaying ? '暂停' : '播放'}
            >
              {isPlaybackPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={handleNext}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="下一帧"
            >
              <SkipForward size={16} />
            </button>
          </div>

          <div className="flex-1 relative">
            <div className="h-1.5 bg-slate-700 rounded-full">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{
                  width: `${((currentPlaybackIndex + 1) / (records.length + 1)) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="text-xs text-slate-400 font-mono w-20 text-right">
            {currentPlaybackIndex + 1} / {records.length + 1}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setPlaybackPlaying(false);
              setPlaybackIndex(-1);
            }}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              currentPlaybackIndex === -1
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            当前
          </button>

          <div className="flex-1 flex items-center justify-around mx-2">
            {records.map((record, index) => (
              <button
                key={record.id}
                onClick={() => handleSeek(index)}
                className="group flex flex-col items-center"
                title={record.note || formatTimestamp(record.timestamp)}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-all ${
                    currentPlaybackIndex === index
                      ? 'bg-blue-500 scale-125'
                      : 'bg-slate-600 group-hover:bg-slate-500'
                  }`}
                />
                <span
                  className={`text-xs mt-1 font-mono ${
                    currentPlaybackIndex === index ? 'text-blue-400' : 'text-slate-500'
                  }`}
                >
                  {index + 1}
                </span>
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500">盘点记录</span>
        </div>
      </div>
    </div>
  );
}
