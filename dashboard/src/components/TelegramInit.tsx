"use client";

import { useEffect } from "react";

import { initTelegramWebApp } from "@/lib/telegram/client";

/** Mounted once in the root layout to run Telegram WebApp bootstrap (ready/expand). */
export function TelegramInit() {
  useEffect(() => {
    initTelegramWebApp();
  }, []);
  return null;
}
