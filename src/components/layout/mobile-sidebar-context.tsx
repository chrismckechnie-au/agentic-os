"use client";

import { createContext, useContext, useState, ReactNode } from "react";

const MobileSidebarContext = createContext<{
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
} | null>(null);

export function MobileSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <MobileSidebarContext.Provider
      value={{
        isOpen,
        toggle: () => setIsOpen((v) => !v),
        close: () => setIsOpen(false),
      }}
    >
      {children}
    </MobileSidebarContext.Provider>
  );
}

export function useMobileSidebar() {
  const ctx = useContext(MobileSidebarContext);
  if (!ctx) throw new Error("useMobileSidebar must be used within MobileSidebarProvider");
  return ctx;
}
