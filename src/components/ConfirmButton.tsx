"use client";

export function ConfirmButton({
  children,
  className,
  confirmMessage,
}: {
  children: React.ReactNode;
  className?: string;
  confirmMessage: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
