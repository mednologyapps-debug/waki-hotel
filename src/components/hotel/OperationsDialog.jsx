import { useEffect, useRef } from "react";
export default function OperationsDialog({ title, busy, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return () => {d.close();document.body.style.overflow=overflow;};
  }, []);
  return (
    <dialog
      ref={ref}
      className="hotel-ops-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      aria-labelledby="ops-title"
    >
      <header>
        <h2 id="ops-title">{title}</h2>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
