"use client";

export function ErrorBanner({ message }: { message: string }) {
  return <div className="status-banner error">Ошибка: {message}</div>;
}

export function SuccessBanner({ message }: { message: string }) {
  return <div className="status-banner success">{message}</div>;
}
