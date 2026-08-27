import { Wordmark } from "./Wordmark";

export function AppBar({ initial, right }: { initial?: string; right?: React.ReactNode }) {
  return (
    <header className="bar">
      <div className="bar-in">
        <Wordmark href="/dashboard" />
        <div className="right">
          {right}
          <div className="avatar">{(initial || "Y").toUpperCase()}</div>
        </div>
      </div>
    </header>
  );
}
