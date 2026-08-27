import { Wordmark } from "./Wordmark";
import { UserMenu } from "./UserMenu";

export function AppBar({ initial, right }: { initial?: string; right?: React.ReactNode }) {
  return (
    <header className="bar">
      <div className="bar-in">
        <Wordmark href="/dashboard" />
        <div className="right">
          {right}
          <UserMenu initial={(initial || "Y").toUpperCase()} />
        </div>
      </div>
    </header>
  );
}
