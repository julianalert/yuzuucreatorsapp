import { Wordmark } from "./Wordmark";
import { UserMenu } from "./UserMenu";

export function AppBar({
  initial,
  avatarUrl,
  right,
}: {
  initial?: string;
  avatarUrl?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <header className="bar">
      <div className="bar-in">
        <Wordmark href="/dashboard" />
        <div className="right">
          {right}
          <UserMenu initial={(initial || "Y").toUpperCase()} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
}
