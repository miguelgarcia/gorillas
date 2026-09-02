'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { loadTheme, type GameTheme } from '@/lib/game/theme';

const FIXED_TIMESTEP = 1 / 120;
const INITIAL_GAME = createGame(0x67a11a);

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
  const [theme, setTheme] = useState<GameTheme | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [ui, setUi] = useState<UiSnapshot>(() => snapshot(INITIAL_GAME));

  const syncUi = useCallback(() => {
    const next = snapshot(gameRef.current);
    const key = snapshotKey(next);
    if (snapshotKeyRef.current !== key) {
      snapshotKeyRef.current = key;
      setUi(next);
    }
  }, []);

  useEffect(() => {
    gameRef.current = createGame(initialSeed());
    syncUi();
    loadTheme('/themes/storm/theme.json')
      .then(setTheme)
      .catch(() => setLoadError(true));
  }, [syncUi]);

  useEffect(() => {
    resetOpenRef.current = resetOpen;
  }, [resetOpen]);

  useEffect(() => {
    if (!theme) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let animationFrame = 0;
    let previousTime = performance.now();
    let accumulator = 0;

    const render = (time: number) => {
      const frameDelta = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      if (!resetOpenRef.current) {
        accumulator += frameDelta;
        while (accumulator >= FIXED_TIMESTEP) {
          gameRef.current = stepGame(gameRef.current, FIXED_TIMESTEP);
          accumulator -= FIXED_TIMESTEP;
        }
      }
      syncUi();
      rendererRef.current.draw(
        context,
        gameRef.current,
        theme,
        aimingRef.current ? pointerRef.current : null,
      );
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [syncUi, theme]);

  const beginRematch = useCallback(() => {
    gameRef.current = startRematch(gameRef.current);
    aimingRef.current = false;
    pointerRef.current = null;
    syncUi();
  }, [syncUi]);

  const confirmReset = useCallback(() => {
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
  }, [syncUi]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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

  if (loadError) {
    return (
      <section className="load-state" role="alert">
        <strong>THE CITY COULD NOT LOAD</strong>
        <span>Refresh the page to try again.</span>
      </section>
    );
  }

  return (
    <section
      className="game-frame"
      aria-label="Gorillas local hot-seat game"
      data-active-player={ui.activePlayer + 1}
      data-match-number={ui.matchNumber}
      data-phase={ui.phase}
      style={themeStyle}
    >
      <div className="scoreboard" aria-live="polite" aria-atomic="true">
        <span className="player-one">P1</span>
        <strong>{ui.scores[0]}</strong>
        <span aria-hidden="true">—</span>
        <strong>{ui.scores[1]}</strong>
        <span className="player-two">P2</span>
      </div>

      {!theme ? (
        <div className="load-state" aria-live="polite">
          <strong>BUILDING CITY</strong>
        </div>
      ) : null}

      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        tabIndex={0}
        aria-label={`Windy city arena. P${ui.activePlayer + 1} is active. Drag from the highlighted gorilla to aim.`}
        onPointerDown={(event) => {
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
          if (aimingRef.current) pointerRef.current = toWorld(event);
        }}
        onPointerUp={(event) => {
          if (!aimingRef.current) return;
          const point = toWorld(event);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          gameRef.current = launchBanana(gameRef.current, point);
          aimingRef.current = false;
          pointerRef.current = null;
          syncUi();
        }}
        onPointerCancel={() => {
          aimingRef.current = false;
          pointerRef.current = null;
        }}
      />

      {ui.phase === 'victory' && ui.winner !== null ? (
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

      <p className="control-hint">
        Drag from the ring · release to throw · Esc resets score
      </p>

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
