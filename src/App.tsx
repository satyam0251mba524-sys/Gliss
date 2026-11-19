import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCcw, Undo2, Volume2, VolumeX, Check, Grid3X3, ArrowRight, X } from 'lucide-react';
import { LEVELS, parseLevel, slidePosition, type Position } from './levels';
import { playSlideSound, playUndoSound, playWinSound } from './sound';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'LEVEL_COMPLETE' | 'ALL_CLEAR';

interface ProgressMap {
  [levelId: number]: number; // best move count
}

const STORAGE_KEY = 'gliss_best_moves_v1';

function loadProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [levelIdx, setLevelIdx] = useState(0);
  const [pos, setPos] = useState<Position>(() => parseLevel(LEVELS[0]).start);
  const [history, setHistory] = useState<Position[]>([]);
  const [muted, setMuted] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [bestMoves, setBestMoves] = useState<ProgressMap>(() => loadProgress());

  const level = LEVELS[levelIdx];
  const parsed = useMemo(() => parseLevel(level), [level]);
  const moves = history.length;
  const totalPar = useMemo(() => LEVELS.reduce((acc, l) => acc + l.par, 0), []);

  const startLevel = useCallback((index: number) => {
    const target = LEVELS[index];
    const data = parseLevel(target);
    setLevelIdx(index);
    setPos(data.start);
    setHistory([]);
    setShowLevels(false);
    setGameState('PLAYING');
  }, []);

  const resetCurrentLevel = useCallback(() => {
    setPos(parsed.start);
    setHistory([]);
    setGameState('PLAYING');
    playUndoSound(muted);
  }, [parsed.start, muted]);

  const undoMove = useCallback(() => {
    if (gameState !== 'PLAYING' || history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPos(prev);
    playUndoSound(muted);
  }, [gameState, history, muted]);

  const move = useCallback(
    (dr: number, dc: number) => {
      if (gameState !== 'PLAYING' || showLevels) return;
      const next = slidePosition(pos, dr, dc, parsed.walls);
      if (next.row === pos.row && next.col === pos.col) return;

      const nextMoves = history.length + 1;
      setHistory((h) => [...h, pos]);
      setPos(next);

      if (next.row === parsed.goal.row && next.col === parsed.goal.col) {
        playWinSound(muted);
        setBestMoves((prev) => {
          const existing = prev[level.id];
          if (existing !== undefined && existing <= nextMoves) return prev;
          const updated = { ...prev, [level.id]: nextMoves };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // ignore storage failure
          }
          return updated;
        });
        setTimeout(() => {
          setGameState(levelIdx === LEVELS.length - 1 ? 'ALL_CLEAR' : 'LEVEL_COMPLETE');
        }, 170);
      } else {
        playSlideSound(muted);
      }
    },
    [gameState, showLevels, pos, parsed.walls, parsed.goal, history.length, muted, level.id, levelIdx]
  );

  const nextLevel = useCallback(() => {
    if (levelIdx < LEVELS.length - 1) {
      startLevel(levelIdx + 1);
    } else {
      setGameState('ALL_CLEAR');
    }
  }, [levelIdx, startLevel]);

  // Global keyboard handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (showLevels) {
          e.preventDefault();
          setShowLevels(false);
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setMuted((m) => !m);
        return;
      }

      if (showLevels) return;

      if (gameState === 'TITLE_MENU') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startLevel(0);
        }
        return;
      }

      if (gameState === 'LEVEL_COMPLETE') {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          nextLevel();
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          resetCurrentLevel();
        }
        return;
      }

      if (gameState === 'ALL_CLEAR') {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          startLevel(0);
        }
        return;
      }

      // PLAYING state controls
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          move(-1, 0);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          move(1, 0);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          move(0, -1);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          move(0, 1);
          break;
        case 'z':
        case 'Z':
        case 'u':
        case 'U':
        case 'Backspace':
          e.preventDefault();
          undoMove();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          resetCurrentLevel();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          setShowLevels((s) => !s);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, showLevels, move, undoMove, resetCurrentLevel, startLevel, nextLevel]);

  const handleCellClick = (r: number, c: number) => {
    if (gameState !== 'PLAYING') return;
    const dr = r - pos.row;
    const dc = c - pos.col;
    if (dr === 0 && dc !== 0) {
      move(0, dc > 0 ? 1 : -1);
    } else if (dc === 0 && dr !== 0) {
      move(dr > 0 ? 1 : -1, 0);
    }
  };

  const clearedCount = Object.keys(bestMoves).length;
  const optimalCount = LEVELS.filter(
    (l) => bestMoves[l.id] !== undefined && bestMoves[l.id] <= l.par
  ).length;
  const totalBestMoves = LEVELS.reduce((acc, l) => acc + (bestMoves[l.id] ?? 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F3EE] text-[#1C1B18] select-none">
      {/* Top Bar */}
      <header className="w-full max-w-5xl mx-auto px-8 py-5 flex items-center justify-between gap-8 border-b border-[#E3E0D6]">
        <button
          type="button"
          onClick={() => {
            setShowLevels(false);
            setGameState('TITLE_MENU');
          }}
          className="text-lg font-bold tracking-tight text-[#1C1B18] hover:text-[#D9482B] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D9482B] rounded"
        >
          Gliss
        </button>

        {gameState !== 'TITLE_MENU' ? (
          <div className="hidden sm:flex items-center gap-2.5 text-sm text-[#57544D] font-mono tabular-nums whitespace-nowrap">
            <span className="font-semibold text-[#1C1B18]">
              Level {String(level.id).padStart(2, '0')}/{LEVELS.length}
            </span>
            <span aria-hidden="true" className="text-[#B5B0A4]">
              ·
            </span>
            <span className="font-sans text-[#57544D]">{level.name}</span>
            <span aria-hidden="true" className="text-[#B5B0A4]">
              ·
            </span>
            <span>
              Moves <strong className="text-[#1C1B18] font-semibold">{moves}</strong>
            </span>
            <span aria-hidden="true" className="text-[#B5B0A4]">
              ·
            </span>
            <span>Par {level.par}</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#6B675E] whitespace-nowrap">
            <span>10 Handcrafted Puzzles</span>
            <span aria-hidden="true">·</span>
            <span>Keyboard First</span>
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {gameState !== 'TITLE_MENU' && (
            <>
              <button
                type="button"
                onClick={undoMove}
                disabled={history.length === 0 || gameState !== 'PLAYING'}
                title="Undo (Z)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#DCD8CD] bg-white text-[#1C1B18] hover:bg-[#ECEAE2] disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#D9482B]"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={resetCurrentLevel}
                title="Reset Level (R)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#DCD8CD] bg-white text-[#1C1B18] hover:bg-[#ECEAE2] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#D9482B]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowLevels((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#DCD8CD] bg-white text-[#1C1B18] hover:bg-[#ECEAE2] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#D9482B]"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Levels</span>
          </button>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            title={muted ? 'Unmute (M)' : 'Mute (M)'}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[#DCD8CD] bg-white text-[#57544D] hover:text-[#1C1B18] hover:bg-[#ECEAE2] transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-[#D9482B]"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main Stage */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {gameState === 'TITLE_MENU' ? (
          <section className="w-full max-w-2xl flex flex-col md:flex-row items-center justify-between gap-12 py-6">
            {/* Left Copy */}
            <div className="flex-1 text-left">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#1C1B18] text-balance">
                Slide. Stop. Solve.
              </h1>
              <p className="mt-4 text-base text-[#57544D] leading-relaxed max-w-md">
                Glide across the board until you hit a wall or edge. Land directly on the target
                square to clear each puzzle in as few moves as possible.
              </p>

              <div className="mt-7 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => startLevel(0)}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#D9482B] hover:bg-[#C03D22] rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9482B]"
                >
                  <span>Start Game</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                {clearedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowLevels(true)}
                    className="px-4 py-3 text-sm font-medium text-[#1C1B18] hover:text-[#D9482B] transition-colors whitespace-nowrap"
                  >
                    Select Level ({clearedCount}/{LEVELS.length} cleared)
                  </button>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-[#E3E0D6] flex items-center gap-5 text-xs text-[#6B675E]">
                <span className="inline-flex items-center gap-1.5">
                  <kbd className="font-mono px-1.5 py-0.5 bg-white border border-[#D4D0C5] rounded text-[#1C1B18]">
                    WASD
                  </kbd>
                  <span>or Arrows to slide</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <kbd className="font-mono px-1.5 py-0.5 bg-white border border-[#D4D0C5] rounded text-[#1C1B18]">
                    Enter
                  </kbd>
                  <span>to start</span>
                </span>
              </div>
            </div>

            {/* Right Mini 3x3 Preview Board */}
            <div className="shrink-0 w-56 h-56 p-3 rounded-xl bg-[#E8E5DC] border border-[#D6D2C7]">
              <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-1.5">
                <div className="rounded-md bg-[#D9482B] shadow-sm" />
                <div className="rounded-md bg-[#FCFBF8]" />
                <div className="rounded-md bg-[#232220]" />
                <div className="rounded-md bg-[#FCFBF8]" />
                <div className="rounded-md bg-[#232220]" />
                <div className="rounded-md bg-[#FCFBF8]" />
                <div className="rounded-md bg-[#FCFBF8]" />
                <div className="rounded-md bg-[#FCFBF8]" />
                <div className="rounded-md bg-[#FCFBF8] flex items-center justify-center">
                  <div className="w-7 h-7 rounded-md border-2 border-[#D9482B] flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rotate-45 bg-[#D9482B]" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center gap-6 w-full max-w-xl">
            {/* Compact Mobile/Small-Screen Header Info */}
            <div className="flex sm:hidden items-center gap-2 text-xs font-mono tabular-nums text-[#57544D]">
              <span className="font-semibold text-[#1C1B18]">
                Lv {level.id}/{LEVELS.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>Moves {moves}</span>
              <span aria-hidden="true">·</span>
              <span>Par {level.par}</span>
            </div>

            {/* Puzzle Board Frame */}
            <div className="relative w-[min(460px,82vw,60vh)] aspect-square p-3 rounded-xl bg-[#E8E5DC] border border-[#D6D2C7]">
              <div className="relative w-full h-full">
                {/* Static Grid */}
                <div
                  className="grid w-full h-full"
                  style={{
                    gridTemplateColumns: `repeat(${parsed.size}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${parsed.size}, minmax(0, 1fr))`,
                  }}
                >
                  {parsed.walls.map((rowArr, r) =>
                    rowArr.map((isWall, c) => {
                      const isGoal = r === parsed.goal.row && c === parsed.goal.col;
                      const isStart = r === parsed.start.row && c === parsed.start.col;
                      return (
                        <div key={`${r}-${c}`} className="p-[3px]">
                          <button
                            type="button"
                            tabIndex={-1}
                            aria-label={`Row ${r + 1} Column ${c + 1}${isWall ? ' Wall' : isGoal ? ' Target' : ''}`}
                            onClick={() => handleCellClick(r, c)}
                            className={`w-full h-full rounded-[6px] flex items-center justify-center transition-colors ${
                              isWall
                                ? 'bg-[#232220] border-t border-white/10 cursor-default'
                                : 'bg-[#FCFBF8] border border-[#E4E1D7] hover:border-[#CBC6B8] cursor-pointer'
                            }`}
                          >
                            {isGoal && (
                              <div
                                className="w-[54%] h-[54%] rounded-[4px] border-2 border-[#D9482B] flex items-center justify-center"
                                aria-hidden="true"
                              >
                                <div className="w-[42%] h-[42%] rotate-45 bg-[#D9482B]" />
                              </div>
                            )}
                            {!isGoal && isStart && (
                              <div
                                className="w-1.5 h-1.5 rounded-full bg-[#D4D0C5]"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Sliding Player Block */}
                <div
                  className="absolute top-0 left-0 pointer-events-none p-[3px] tile-glide transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    width: `${100 / parsed.size}%`,
                    height: `${100 / parsed.size}%`,
                    transform: `translate3d(${pos.col * 100}%, ${pos.row * 100}%, 0)`,
                  }}
                >
                  <div className="w-full h-full rounded-[6px] bg-[#D9482B] shadow-sm border-t border-white/25 flex items-center justify-center">
                    <div className="w-[26%] h-[26%] rounded-[2px] bg-white/90" />
                  </div>
                </div>

                {/* Level Complete Overlay */}
                {gameState === 'LEVEL_COMPLETE' && (
                  <div className="absolute inset-0 bg-[#F4F3EE]/92 backdrop-blur-[2px] rounded-lg flex flex-col items-center justify-center p-6 text-center">
                    <p className="text-xs font-mono uppercase tracking-wider text-[#6B675E]">
                      Level {String(level.id).padStart(2, '0')} Cleared
                    </p>
                    <h2 className="mt-1.5 text-2xl font-bold text-[#1C1B18]">
                      {moves <= level.par ? 'Optimal Solution' : 'Puzzle Solved'}
                    </h2>
                    <p className="mt-2 text-sm font-mono tabular-nums text-[#57544D]">
                      {moves} moves <span aria-hidden="true">·</span> Par {level.par}
                    </p>
                    <div className="mt-6 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={nextLevel}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#D9482B] hover:bg-[#C03D22] rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9482B]"
                      >
                        <span>Next Level</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={resetCurrentLevel}
                        className="px-4 py-2.5 text-sm font-medium text-[#1C1B18] bg-white border border-[#DCD8CD] hover:bg-[#ECEAE2] rounded-lg transition-colors whitespace-nowrap"
                      >
                        Replay
                      </button>
                    </div>
                  </div>
                )}

                {/* All 10 Levels Complete Overlay */}
                {gameState === 'ALL_CLEAR' && (
                  <div className="absolute inset-0 bg-[#F4F3EE]/95 backdrop-blur-[2px] rounded-lg flex flex-col items-center justify-center p-6 text-center">
                    <p className="text-xs font-mono text-[#D9482B] font-semibold">
                      All {LEVELS.length} Levels Complete
                    </p>
                    <h2 className="mt-1.5 text-2xl font-bold text-[#1C1B18]">Course Mastered</h2>
                    <div className="mt-3 text-sm font-mono tabular-nums text-[#57544D] space-y-1">
                      <p>
                        Optimal Clears: <strong className="text-[#1C1B18]">{optimalCount}</strong>/{LEVELS.length}
                      </p>
                      <p>
                        Total Best Moves: <strong className="text-[#1C1B18]">{totalBestMoves}</strong> / Par {totalPar}
                      </p>
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => startLevel(0)}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-[#D9482B] hover:bg-[#C03D22] rounded-lg transition-colors whitespace-nowrap"
                      >
                        Play Again
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLevels(true)}
                        className="px-4 py-2.5 text-sm font-medium text-[#1C1B18] bg-white border border-[#DCD8CD] hover:bg-[#ECEAE2] rounded-lg transition-colors whitespace-nowrap"
                      >
                        Levels
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Keyboard Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#6B675E]">
              <span className="inline-flex items-center gap-1.5">
                <kbd className="font-mono px-1.5 py-0.5 bg-white border border-[#D4D0C5] rounded text-[#1C1B18]">
                  ← ↑ ↓ →
                </kbd>
                <span>or</span>
                <kbd className="font-mono px-1.5 py-0.5 bg-white border border-[#D4D0C5] rounded text-[#1C1B18]">
                  WASD
                </kbd>
                <span>Slide</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <kbd className="font-mono px-1.5 py-0.5 bg-white border border-[#D4D0C5] rounded text-[#1C1B18]">
                  Z
                </kbd>
                <span>Undo</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <kbd className="font-mono px-1.5 py-0.5 bg-white border border-[#D4D0C5] rounded text-[#1C1B18]">
                  R
                </kbd>
                <span>Reset</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <kbd className="font-mono px-1.5 py-0.5 bg-white border border-[#D4D0C5] rounded text-[#1C1B18]">
                  L
                </kbd>
                <span>Levels</span>
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Level Selector Modal */}
      {showLevels && (
        <div
          className="fixed inset-0 z-50 bg-[#1C1B18]/30 backdrop-blur-[1px] flex items-center justify-center p-6"
          onClick={() => setShowLevels(false)}
        >
          <div
            className="w-full max-w-lg bg-[#F4F3EE] border border-[#D6D2C7] rounded-xl p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#E3E0D6]">
              <div>
                <h2 className="text-base font-semibold text-[#1C1B18]">Select Level</h2>
                <p className="text-xs text-[#6B675E] mt-0.5">
                  {clearedCount} of {LEVELS.length} cleared · {optimalCount} optimal
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLevels(false)}
                aria-label="Close level selector"
                className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#57544D] hover:text-[#1C1B18] hover:bg-[#E8E5DC] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {LEVELS.map((lvl, idx) => {
                const best = bestMoves[lvl.id];
                const isOptimal = best !== undefined && best <= lvl.par;
                const isCurrent = idx === levelIdx && gameState !== 'TITLE_MENU';

                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => startLevel(idx)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-left transition-colors ${
                      isCurrent
                        ? 'border-[#D9482B] bg-white'
                        : 'border-[#DCD8CD] bg-white hover:border-[#B5B0A4]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#57544D] tabular-nums">
                          {String(lvl.id).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-medium text-[#1C1B18] truncate">
                          {lvl.name}
                        </span>
                      </div>
                      <p className="text-xs font-mono tabular-nums text-[#6B675E] mt-0.5">
                        {lvl.grid.length}×{lvl.grid.length} · Par {lvl.par}
                        {best !== undefined ? ` · Best ${best}` : ''}
                      </p>
                    </div>
                    {best !== undefined && (
                      <Check
                        className={`w-4 h-4 shrink-0 ml-2 ${
                          isOptimal ? 'text-[#D9482B]' : 'text-[#57544D]'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
