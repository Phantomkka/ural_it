import type { Request, Response } from "express";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@netcity/shared";
import { MemoryProgressStore, type ProgressStore } from "./progress/store.js";
import { StreetRoom } from "./StreetRoom.js";
export function createGameServer(options: { store?: ProgressStore } = {}) {
  const store = options.store ?? new MemoryProgressStore();
  const guests = new Map<string, { at: number; tokens: number }>();
  class GameRoom extends StreetRoom {
    protected progressStore = store;
  }
  const game = new Server({
    transport: new WebSocketTransport(),
    greet: false,
    express: (app) => {
      app.get("/health", async (_req: Request, res: Response) => {
        try {
          await store.health();
          res.json({ status: "ok", persistence: store.mode });
        } catch {
          res
            .status(503)
            .json({
              status: "error",
              message:
                "PostgreSQL недоступен. Проверьте DATABASE_URL и миграции.",
            });
        }
      });
      app.post("/guest", async (req: Request, res: Response) => {
        const now = Date.now(),
          ip = req.ip ?? "unknown";
        for (const [key, value] of guests)
          if (now - value.at > 60000) guests.delete(key);
        const budget = guests.get(ip) ?? { at: now, tokens: 20 };
        budget.tokens = Math.min(20, budget.tokens + (now - budget.at) / 2000);
        budget.at = now;
        if (budget.tokens < 1 || guests.size >= 1000) {
          res
            .status(429)
            .json({ message: "Слишком много новых гостей. Повторите позже." });
          return;
        }
        budget.tokens--;
        guests.set(ip, budget);
        try {
          const guest = await store.register();
          res.setHeader("Cache-Control", "no-store");
          res.json({ token: guest.token });
        } catch {
          res
            .status(503)
            .json({
              message:
                "Хранилище профилей недоступно. Проверьте PostgreSQL и миграции.",
            });
        }
      });
    },
  });
  game.define(ROOM_NAME, GameRoom);
  return game;
}
