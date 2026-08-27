import Link from "next/link";

export function Wordmark({ size, href = "/" }: { size?: number; href?: string }) {
  return (
    <Link className="wordmark" href={href} style={size ? { fontSize: size } : undefined}>
      yuzuu<i />
    </Link>
  );
}
