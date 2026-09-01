import { ScanningBar } from "@/components/ScanningBar";

export default function ScanningLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScanningBar />
      {children}
    </>
  );
}
