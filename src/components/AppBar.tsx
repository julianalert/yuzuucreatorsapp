import { Wordmark } from "./Wordmark";
import { UserMenu } from "./UserMenu";

export function AppBar({
  initial,
  avatarUrl,
  right,
  wide,
}: {
  initial?: string;
  avatarUrl?: string | null;
  right?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <header className="bar">
      <div className={`bar-in${wide ? " wide" : ""}`}>
        <Wordmark href="/dashboard" />
        <div className="right">
          {right}
          <UserMenu initial={(initial || "Y").toUpperCase()} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
}
