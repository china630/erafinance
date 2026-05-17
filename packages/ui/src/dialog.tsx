"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("Dialog components must be used within Dialog");
  return ctx;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

/** Prefer first real field so header close is not focused on every open/re-run. */
function getPreferredInitialFocus(root: HTMLElement): HTMLElement {
  const preferred = root.querySelector<HTMLElement>(
    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
  );
  if (preferred) return preferred;
  const focusables = getFocusable(root);
  return focusables[0] ?? root;
}

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const contentId = useMemo(
    () => `erafinance-dialog-${Math.random().toString(36).slice(2, 9)}`,
    [],
  );
  return (
    <DialogContext.Provider value={{ open, onOpenChange, contentId }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogContent({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const { open, onOpenChange, contentId } = useDialogContext();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const root = containerRef.current;
    if (!root) return;
    getPreferredInitialFocus(root).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = getFocusable(root);
      if (items.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={containerRef}
        id={contentId}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={className}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <header className={`flex items-start justify-between gap-3 ${className}`} {...props} />;
}

export function DialogFooter({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

