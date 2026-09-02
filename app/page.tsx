import { GorillasGame } from './gorillas-game';

export default function Home() {
  return (
    <main className="game-shell">
      <h1 className="sr-only">Gorillas</h1>
      <GorillasGame />
    </main>
  );
}
