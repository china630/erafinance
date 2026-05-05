"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type Ctx = {
  open: boolean;
  setOpen: (next: boolean) => void;
  rootRef: React.RefObject<HTMLDivElement | null>;
};

const DropdownMenuContext = createContext<Ctx | null>(null);

function useDropdownMenu() {
  const ctx = useContext(DropdownMenuContext);
  if (!ctx) throw new Error("DropdownMenu components must be nested in DropdownMenu");
  return ctx;
}

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const value = useMemo(() => ({ open, setOpen, rootRef }), [open]);
  return (
    <DropdownMenuContext.Provider value={value}>
      <div className="relative" ref={rootRef}>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen } = useDropdownMenu();
  return (
    <button
      {...rest}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(!open);
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { open } = useDropdownMenu();
  if (!open) return null;
  return (
    <div
      className={`absolute right-0 top-9 z-20 min-w-52 rounded-xl border border-[#D5DADF] bg-white p-1 shadow-lg ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  className = "",
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useDropdownMenu();
  return (
    <button
      type="button"
      {...rest}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-[#34495E] transition hover:bg-[#F4F5F7] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
    >
      {children}
    </button>
  );
}
