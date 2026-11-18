"use client";
import type { ReactNode } from "react";
import Link from "next/link";
// Native links keep decorative animation code off the critical shopping path.
export function MagneticLink({
  href,
  children,
  className = "",
  disabled = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Link
      href={href}
      className={"magnetic-link " + className}
      data-motion-disabled={disabled}
    >
      {children}
    </Link>
  );
}
