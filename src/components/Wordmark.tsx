import Link from "next/link";

export function Wordmark({ size, href = "/" }: { size?: number; href?: string }) {
  return (
    <Link className="wordmark" href={href} style={size ? { fontSize: size } : undefined}>
      <span className="fruit" aria-hidden="true" />
      <span className="word">yuzuu</span>
    </Link>
  );
}
