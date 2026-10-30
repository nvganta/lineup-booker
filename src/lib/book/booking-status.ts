"use client";

import { useSyncExternalStore } from "react";

/** Where an act's booking stands. Only the owner can say it's confirmed. */
export type BookingStatus = "new" | "sent" | "confirmed";

const STORAGE_KEY = "lineup-booker:booking";
const listeners = new Set<() => void>();
let memo: Record<string, BookingStatus> | null = null;

function read(): Record<string, BookingStatus> {
  if (memo) return memo;
  try {
    memo = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      BookingStatus
    >;
  } catch {
    memo = {};
  }
  return memo;
}

function write(next: Record<string, BookingStatus>) {
  memo = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private window or storage blocked: it still holds for this visit */
  }
  listeners.forEach((l) => l());
}

/** One act at one venue. */
export function bookingKey(address: string, act: string): string {
  return `${address.trim().toLowerCase()}|${act.trim().toLowerCase()}`;
}

export function setBookingStatus(key: string, status: BookingStatus) {
  write({ ...read(), [key]: status });
}

/** Opening the email counts as asking; it never undoes a confirmation. */
export function markEnquirySent(key: string) {
  if ((read()[key] ?? "new") === "new") setBookingStatus(key, "sent");
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useBookingStatus(key: string): BookingStatus {
  return useSyncExternalStore(
    subscribe,
    () => read()[key] ?? "new",
    () => "new",
  );
}
