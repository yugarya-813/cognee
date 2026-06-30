"use client";

import { usePathname } from "next/navigation";

// Re-keying on the path replays the entrance animation on every navigation.
export default function PageFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-fade">
      {children}
    </div>
  );
}
