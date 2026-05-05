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

type DropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  rootRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext() {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error("DropdownMenu components must be used within DropdownMenu");
  return ctx;
}

function getItems(root: HTMLElement | null) {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
}

function focusByStep(items: HTMLElement[], step: 1 | -1) {
  if (items.length === 0) return;
  const active = document.activeElement as HTMLElement | null;
  const index = Math.max(items.findIndex((item) => item === active), 0);
  const next = (index + step + items.length) % items.length;
  items[next]?.focus();
}

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const value = useMemo(
    () => ({ open, setOpen, rootRef, contentRef }),
    [open],
  );

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={value}>
      <div ref={rootRef} className="relative">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  onClick,
  onKeyDown,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen, contentRef } = useDropdownContext();
  return (
    <button
      aria-haspopup="menu"
      aria-expanded={open}
      {...props}
      onClick={(event) => {
        event.stopPropagation();
        setOpen(!open);
        onClick?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) setOpen(true);
          const items = getItems(contentRef.current);
          items[event.key === "ArrowDown" ? 0 : items.length - 1]?.focus();
        }
        onKeyDown?.(event);
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
  const { open, contentRef } = useDropdownContext();
  if (!open) return null;
  return (
    <div
      ref={contentRef}
      role="menu"
      className={`absolute right-0 top-9 z-20 min-w-52 rounded-xl border border-[#D5DADF] bg-white p-1 shadow-lg ${className}`}
      onKeyDown={(event) => {
        const items = getItems(contentRef.current);
        if (event.key === "ArrowDown") {
          event.preventDefault();
          focusByStep(items, 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          focusByStep(items, -1);
        }
      }}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  className = "",
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useDropdownContext();
  return (
    <button
      type="button"
      role="menuitem"
      {...props}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-[#34495E] transition hover:bg-[#F4F5F7] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      onClick={(event) => {
        onClick?.(event);
        setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

