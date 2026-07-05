import React from "react";

export function formatPrice(price: number, market: "crypto" | "forex" = "crypto"): string {
  if (market === "forex") {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 5,
    }).format(price);
  }
  
  if (price < 0.01) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 6,
      maximumFractionDigits: 8,
    }).format(price);
  } else if (price < 1) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    }).format(price);
  } else if (price > 1000) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(price);
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

/**
 * Format a price for any asset class.
 * Crypto: 63163.22 (no $)
 * Forex:  1.14403
 * Stock:  187.42
 */
export function fmtAssetPrice(price: number | string, assetClass: string): string {
  const p = typeof price === "string" ? parseFloat(price) : price;
  if (assetClass === "FOREX") {
    return formatPrice(p, "forex");
  }
  // Crypto and stocks: just format with appropriate decimals
  if (assetClass === "CRYPTO" || assetClass === "STOCK") {
    if (p > 1000) {
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(p);
    }
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(p);
  }
  return p.toFixed(2);
}

/**
 * Format an ISO timestamp to a clean readable string.
 * e.g. "Jul 5 15:37 UTC"
 */
export function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
    const time = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
    return `${month} ${day} ${time} UTC`;
  } catch {
    return iso;
  }
}

/**
 * Relative time string. e.g. "2h ago", "3d ago", "just now"
 */
export function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatTimestamp(iso);
  } catch {
    return iso;
  }
}
