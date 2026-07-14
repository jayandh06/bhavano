"use client";

import { useState } from "react";
import Link from "next/link";
import type { ListingCardDto } from "@bhavano/types";
import { useAuthGate } from "./AuthGateProvider";
import { toggleFavouriteAction } from "@/app/actions/listings";
import { buildListingPath } from "@/lib/listingPath";

export function ListingCard({ item, cityName }: { item: ListingCardDto; cityName: string }) {
  const { requireLogin } = useAuthGate();
  const [isFavourited, setIsFavourited] = useState(item.isFavourited);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const href = buildListingPath(item);

  async function onToggleFavourite(e: React.MouseEvent) {
    e.preventDefault();
    const result = await toggleFavouriteAction(item.id);
    if (result.requiresLogin) {
      requireLogin();
      return;
    }
    setIsFavourited(result.favourited);
    setLikeCount(result.likeCount);
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        animation: "fadein 0.4s ease both",
      }}
    >
      <div
        style={{
          position: "relative",
          height: 200,
          background: `repeating-linear-gradient(135deg, ${item.imgColors[0]}, ${item.imgColors[0]} 14px, ${item.imgColors[1]} 14px, ${item.imgColors[1]} 28px)`,
        }}
      >
        {/* TEMP(auth-gate): viewing listing details is open without login for now. */}
        <Link
          href={href}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              letterSpacing: "0.04em",
              color: "#ffffffcc",
              background: "#00000030",
              padding: "5px 10px",
              borderRadius: 6,
            }}
          >
            {item.imgLabel}
          </span>
        </Link>
        <span
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: "var(--green)",
            color: "var(--on-green)",
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 6,
            pointerEvents: "none",
          }}
        >
          {item.tag}
        </span>
        <button
          onClick={onToggleFavourite}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#ffffffee",
            border: "none",
            cursor: "pointer",
            fontSize: 15,
            zIndex: 1,
            color: isFavourited ? "#c0554b" : "inherit",
          }}
        >
          {isFavourited ? "♥" : "♡"}
        </button>
      </div>

      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {/* TEMP(auth-gate): viewing listing details is open without login for now. */}
        <Link
          href={href}
          style={{ display: "flex", flexDirection: "column", gap: 10, color: "inherit" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ fontFamily: "var(--font-lora)", fontSize: 20, fontWeight: 700, color: "var(--green)" }}>
              {item.price}
            </div>
            {item.priceQualifier && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--muted)",
                  background: "var(--surface-alt)",
                  padding: "4px 10px",
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                }}
              >
                {item.priceQualifier}
              </div>
            )}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", lineHeight: 1.35 }}>{item.title}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
            📍 {item.area}, {cityName}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 13, color: "var(--text-soft)", fontWeight: 600, paddingTop: 2 }}>
            {item.specs.map((spec) => (
              <span key={spec}>{spec}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "var(--muted)" }}>
            <span>👁 {item.viewCount}</span>
            <span>♥ {likeCount}</span>
          </div>
        </Link>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            onClick={requireLogin}
            style={{
              flex: 1,
              background: "var(--green)",
              color: "var(--on-green)",
              border: "none",
              borderRadius: 8,
              padding: 11,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Contact owner
          </button>
          <button
            onClick={requireLogin}
            style={{
              background: "var(--surface)",
              color: "var(--green)",
              border: "1.5px solid var(--green)",
              borderRadius: 8,
              padding: "11px 16px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Call
          </button>
        </div>
      </div>
    </div>
  );
}
