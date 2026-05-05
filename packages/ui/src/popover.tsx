"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error("Popover components must be used within Popover");
  return ctx;
}

export function Popover({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <PopoverContext.Provider value={value}>{children}</PopoverContext.Provider>;
}

export function PopoverTrigger({
  children,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen } = usePopoverContext();
  return (
    <button
      {...props}
      onClick={(event) => {
        setOpen(!open);
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}

export function PopoverContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { open, setOpen } = usePopoverContext();
  const rootRef = useRef<HTMLDivElement | null>(null);
  if (!open) return null;
  return (
    <div
      ref={rootRef}
      className={`absolute z-20 rounded-xl border border-[#D5DADF] bg-white p-2 shadow-lg ${className}`}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
    </div>
  );
}

