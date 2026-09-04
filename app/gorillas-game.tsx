'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  canStartAim,
  createGame,
  launchBanana,
  resetScores,
  startRematch,
  stepGame,
  type GameState,
  type PlayerId,
  type Point,
} from '@/lib/game/core';
import {
  GameRenderer,
  screenToWorld,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from '@/lib/game/render';
import { GameAudio, type AudioPlaybackState } from '@/lib/game/audio';
import { loadTheme, type GameTheme } from '@/lib/game/theme';

const FIXED_TIMESTEP = 1 / 120;
const INITIAL_GAME = createGame(0x67a11a);
const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
type PageState = 'loading' | 'presentation' | 'playing' | 'load-error';

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
  execute(input: unknown): unknown;
};

type WebMcpContext = {
  registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ): void | Promise<void>;
};

type UiSnapshot = {
  activePlayer: PlayerId;
  matchNumber: number;
  phase: GameState['match']['phase'];
  scores: [number, number];
  winner: PlayerId | null;
};

function snapshot(game: GameState): UiSnapshot {
  return {
    activePlayer: game.match.activePlayer,
    matchNumber: game.matchNumber,
    phase: game.match.phase,
    scores: game.scores,
    winner: game.match.winner,
  };
}

function snapshotKey(value: UiSnapshot) {
  return [
    value.activePlayer,
    value.matchNumber,
    value.phase,
    value.scores[0],
    value.scores[1],
    value.winner ?? '-',
  ].join(':');
}

function initialSeed() {
  if (typeof window !== 'undefined') {
    const requestedSeed = Number(
      new URLSearchParams(window.location.search).get('seed'),
    );
    if (Number.isInteger(requestedSeed) && requestedSeed > 0) {
      return requestedSeed >>> 0;
    }
  }
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  }
  return 0x67a11a;
}

export function GorillasGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef(new GameRenderer());
  const gameRef = useRef(INITIAL_GAME);
  const aimingRef = useRef(false);
  const pointerRef = useRef<Point | null>(null);
  const resetOpenRef = useRef(false);
  const snapshotKeyRef = useRef('');
  const audioRef = useRef<GameAudio | null>(null);
  const screenRef = useRef<PageState>('loading');
  const accumulatorRef = useRef(0);
  const [screen, setScreen] = useState<PageState>('loading');
  const [theme, setTheme] = useState<GameTheme | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [audioState, setAudioState] = useState<AudioPlaybackState>('waiting');
  const [ui, setUi] = useState<UiSnapshot>(() => snapshot(INITIAL_GAME));

  const getAudio = useCallback(() => {
    audioRef.current ??= new GameAudio();
    return audioRef.current;
  }, []);

  const syncUi = useCallback(() => {
    const next = snapshot(gameRef.current);
    const key = snapshotKey(next);
    if (snapshotKeyRef.current !== key) {
      snapshotKeyRef.current = key;
      setUi(next);
    }
  }, []);

  const changeScreen = useCallback((next: PageState) => {
    screenRef.current = next;
    setScreen(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    gameRef.current = createGame(initialSeed());
    syncUi();
    loadTheme(`${PUBLIC_BASE_PATH}/themes/storm/theme.json`)
      .then((loadedTheme) => {
        if (!cancelled) setTheme(loadedTheme);
      })
      .catch(() => {
        if (!cancelled) changeScreen('load-error');
      });
    return () => {
      cancelled = true;
    };
  }, [changeScreen, syncUi]);

  useEffect(() => {
    resetOpenRef.current = resetOpen;
  }, [resetOpen]);

  useEffect(() => {
    const audio = getAudio();
    let enabled = true;
    try {
      enabled = window.localStorage.getItem('gorillas:sound') !== 'off';
    } catch {
      /* Audio still works when browser storage is unavailable. */
    }
    audio.setEnabled(enabled);
    const unsubscribe = audio.subscribe(setAudioState);
    const preferenceFrame = window.requestAnimationFrame(() => {
      setAudioState(audio.playbackState);
      void audio.unlock();
    });

    const unlockAudio = (event: Event) => {
      // The sound button handles its own gesture; do not enable and then mute it.
      if (
        event.target instanceof Element &&
        event.target.closest('.sound-toggle')
      )
        return;
      void audio.unlock();
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.cancelAnimationFrame(preferenceFrame);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      unsubscribe();
      audio.destroy();
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [getAudio]);

  useEffect(() => {
    if (!theme) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let animationFrame = 0;
    let previousTime = performance.now();

    const render = (time: number) => {
      const frameDelta = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      if (screenRef.current === 'playing' && !resetOpenRef.current) {
        accumulatorRef.current += frameDelta;
        while (accumulatorRef.current >= FIXED_TIMESTEP) {
          const previous = gameRef.current;
          const next = stepGame(previous, FIXED_TIMESTEP);
          gameRef.current = next;
          if (next.match.phase !== previous.match.phase) {
            if (next.match.phase === 'impact' && next.match.explosion) {
              getAudio().playExplosion(next.match.explosion.kind);
            } else if (
              next.match.phase === 'victory' &&
              next.match.winner !== null
            ) {
              getAudio().playVictory(next.match.winner);
            }
          }
          accumulatorRef.current -= FIXED_TIMESTEP;
        }
      } else {
        accumulatorRef.current = 0;
      }
      syncUi();
      rendererRef.current.draw(
        context,
        gameRef.current,
        theme,
        aimingRef.current ? pointerRef.current : null,
        screenRef.current !== 'playing',
      );
      if (screenRef.current === 'loading') changeScreen('presentation');
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [changeScreen, getAudio, syncUi, theme]);

  const beginGame = useCallback(() => {
    if (screenRef.current !== 'presentation') return;
    aimingRef.current = false;
    pointerRef.current = null;
    accumulatorRef.current = 0;
    changeScreen('playing');
    void getAudio().unlock();
    canvasRef.current?.focus();
  }, [changeScreen, getAudio]);

  const beginRematch = useCallback(() => {
    if (screenRef.current !== 'playing' || resetOpenRef.current) return;
    gameRef.current = startRematch(gameRef.current);
    aimingRef.current = false;
    pointerRef.current = null;
    syncUi();
  }, [syncUi]);

  const confirmReset = useCallback(() => {
    if (screenRef.current !== 'playing') return;
    gameRef.current = resetScores(gameRef.current);
    setResetOpen(false);
    syncUi();
  }, [syncUi]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext })
      .modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();
    const options = { signal: lifecycle.signal };
    const register = (tool: WebMcpTool) => {
      try {
        void Promise.resolve(context.registerTool(tool, options)).catch(
          (error: unknown) =>
            console.error('WebMCP registration failed', error),
        );
      } catch (error) {
        console.error('WebMCP registration failed', error);
      }
    };

    register({
      name: 'read_match_state',
      title: 'Read match state',
      description:
        'Read the active player, phase, scores, wind indicators, and gorilla positions in the current local match.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        const game = gameRef.current;
        return {
          screen: screenRef.current,
          activePlayer: game.match.activePlayer + 1,
          phase: game.match.phase,
          scores: { p1: game.scores[0], p2: game.scores[1] },
          gorillas: game.match.gorillas.map((gorilla) => ({
            player: gorilla.player + 1,
            x: gorilla.x,
            y: gorilla.roofY + 1.35,
            alive: gorilla.alive,
          })),
          windDirection:
            game.match.wind < -0.15
              ? 'left'
              : game.match.wind > 0.15
                ? 'right'
                : 'calm',
          windStrength:
            Math.abs(game.match.wind) < 1.34
              ? 'light'
              : Math.abs(game.match.wind) < 2.67
                ? 'moderate'
                : 'strong',
        };
      },
    });

    register({
      name: 'throw_banana',
      title: 'Throw banana',
      description:
        'Release a drag at a world-space point to throw for the active player. The launch travels opposite the drag and strength is capped by the game.',
      inputSchema: {
        type: 'object',
        properties: {
          dragEndX: {
            type: 'number',
            description: 'Horizontal release point in the 0–100 meter arena.',
          },
          dragEndY: {
            type: 'number',
            description: 'Vertical release point in world meters.',
          },
        },
        required: ['dragEndX', 'dragEndY'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (screenRef.current !== 'playing' || resetOpenRef.current) {
          throw new Error(
            'Start the game and close any dialog before throwing.',
          );
        }
        if (!input || typeof input !== 'object') {
          throw new TypeError('Expected dragEndX and dragEndY.');
        }
        const { dragEndX, dragEndY } = input as Record<string, unknown>;
        if (
          typeof dragEndX !== 'number' ||
          typeof dragEndY !== 'number' ||
          !Number.isFinite(dragEndX) ||
          !Number.isFinite(dragEndY)
        ) {
          throw new TypeError('dragEndX and dragEndY must be finite numbers.');
        }
        if (gameRef.current.match.phase !== 'aiming') {
          throw new Error(
            'A banana can only be thrown during the aiming phase.',
          );
        }
        const next = launchBanana(gameRef.current, {
          x: dragEndX,
          y: dragEndY,
        });
        if (next === gameRef.current) {
          throw new Error('The drag was too short to launch a banana.');
        }
        gameRef.current = next;
        getAudio().playShot();
        aimingRef.current = false;
        pointerRef.current = null;
        syncUi();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        return {
          launched: true,
          player: next.match.activePlayer + 1,
          phase: next.match.phase,
        };
      },
    });

    return () => lifecycle.abort();
  }, [getAudio, syncUi]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screenRef.current !== 'playing') return;
      if (resetOpenRef.current) {
        if (event.key === 'Enter') {
          event.preventDefault();
          confirmReset();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setResetOpen(false);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setResetOpen(true);
      } else if (
        event.key === 'Enter' &&
        gameRef.current.match.phase === 'victory'
      ) {
        event.preventDefault();
        beginRematch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [beginRematch, confirmReset]);

  const toWorld = (event: React.PointerEvent<HTMLCanvasElement>) =>
    screenToWorld(event.currentTarget, {
      x: event.clientX,
      y: event.clientY,
    });

  const themeStyle = theme
    ? ({
        '--p1': theme.palette.p1,
        '--p2': theme.palette.p2,
        '--panel': theme.palette.panel,
        '--panel-edge': theme.palette.panelBorder,
      } as React.CSSProperties)
    : undefined;

  return (
    <section
      className="game-frame"
      aria-label="Gorillas local hot-seat game"
      data-active-player={ui.activePlayer + 1}
      data-match-number={ui.matchNumber}
      data-phase={ui.phase}
      data-screen={screen}
      style={themeStyle}
    >
      {screen === 'playing' ? (
        <div className="scoreboard" aria-live="polite" aria-atomic="true">
          <span className="player-one">P1</span>
          <strong>{ui.scores[0]}</strong>
          <span aria-hidden="true">—</span>
          <strong>{ui.scores[1]}</strong>
          <span className="player-two">P2</span>
        </div>
      ) : null}

      <button
        type="button"
        className="sound-toggle"
        aria-label={
          audioState === 'playing'
            ? 'Mute game audio'
            : audioState === 'unavailable'
              ? 'Game audio unavailable'
              : 'Turn on game audio'
        }
        aria-pressed={audioState === 'playing'}
        disabled={audioState === 'unavailable'}
        data-audio-state={audioState}
        onClick={() => {
          const audio = getAudio();
          const next = audio.playbackState !== 'playing';
          audio.setEnabled(next);
          try {
            window.localStorage.setItem('gorillas:sound', next ? 'on' : 'off');
          } catch {
            /* Persistence is optional; the control still works. */
          }
          if (next) void audio.unlock();
        }}
      >
        <span aria-hidden="true">
          {audioState === 'playing' || audioState === 'waiting' ? '♪' : '×'}
        </span>
        {audioState === 'playing'
          ? 'SOUND ON'
          : audioState === 'waiting'
            ? 'ENABLE MUSIC'
            : audioState === 'muted'
              ? 'SOUND OFF'
              : 'AUDIO UNAVAILABLE'}
      </button>

      {screen !== 'playing' ? (
        <div className="presentation-overlay">
          <div className="presentation-banner">
            <h1>Gorillas by Miguel Garcia</h1>
            <a
              className="repo-link"
              href="https://github.com/miguelgarcia/gorillas"
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit repo<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <Button
              className="start-button"
              disabled={screen !== 'presentation'}
              onClick={beginGame}
            >
              Start
            </Button>
            {screen === 'load-error' ? (
              <div className="presentation-status" role="alert">
                <strong>THE CITY COULD NOT LOAD</strong>
                <span>Refresh the page to try again.</span>
              </div>
            ) : (
              <output className="presentation-status">
                {screen === 'loading'
                  ? 'BUILDING CITY'
                  : 'Two players. One skyline. One banana.'}
              </output>
            )}
          </div>
        </div>
      ) : null}

      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        tabIndex={screen === 'playing' ? 0 : -1}
        aria-hidden={screen !== 'playing'}
        aria-label={
          screen === 'playing'
            ? `Windy city arena. P${ui.activePlayer + 1} is active. Drag from the highlighted gorilla to aim.`
            : 'Windy city preview'
        }
        onPointerDown={(event) => {
          if (screenRef.current !== 'playing' || resetOpenRef.current) return;
          event.currentTarget.focus();
          if (gameRef.current.match.phase === 'victory') {
            beginRematch();
            return;
          }
          const point = toWorld(event);
          if (canStartAim(gameRef.current, point)) {
            event.currentTarget.setPointerCapture(event.pointerId);
            aimingRef.current = true;
            pointerRef.current = point;
          }
        }}
        onPointerMove={(event) => {
          if (screenRef.current !== 'playing' || resetOpenRef.current) return;
          if (aimingRef.current) pointerRef.current = toWorld(event);
        }}
        onPointerUp={(event) => {
          if (screenRef.current !== 'playing' || resetOpenRef.current) return;
          if (!aimingRef.current) return;
          const point = toWorld(event);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          const previous = gameRef.current;
          const next = launchBanana(previous, point);
          gameRef.current = next;
          if (next !== previous) getAudio().playShot();
          aimingRef.current = false;
          pointerRef.current = null;
          syncUi();
        }}
        onPointerCancel={() => {
          aimingRef.current = false;
          pointerRef.current = null;
        }}
      />

      {screen === 'playing' && ui.phase === 'victory' && ui.winner !== null ? (
        <button
          type="button"
          className="victory-overlay"
          onClick={beginRematch}
          aria-label={`Player ${ui.winner + 1} wins. Click or press Enter for a rematch.`}
        >
          <span>P{ui.winner + 1} WINS</span>
          <small>CLICK OR PRESS ENTER</small>
        </button>
      ) : null}

      {screen === 'playing' ? (
        <p className="control-hint">
          Drag from the ring · release to throw · Esc resets score
        </p>
      ) : null}

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="reset-dialog" size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>RESET SCORES?</AlertDialogTitle>
            <AlertDialogDescription>
              The current match will stay exactly as it is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="reset-cancel">
              ESC · CANCEL
            </AlertDialogCancel>
            <AlertDialogAction className="reset-confirm" onClick={confirmReset}>
              ENTER · RESET
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
