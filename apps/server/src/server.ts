import type { Request, Response } from "express";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@netcity/shared";
import { MemoryProgressStore, type ProgressStore } from "./progress/store.js";
import { StreetRoom } from "./StreetRoom.js";
import {AuthService,type GameIdentity} from "./auth/service.js";
import {mountAuth} from "./auth/routes.js";
import {ServerError,type Client,type AuthContext} from "@colyseus/core";
export function createGameServer(options: { store?: ProgressStore } = {}) {
  const store = options.store ?? new MemoryProgressStore();
  const auth=new AuthService(store);
  const guests = new Map<string, { at: number; tokens: number }>();
  class GameRoom extends StreetRoom {
    protected progressStore = store;
    private authStops=new Map<string,()=>void>();
    async onAuth(client:Client,options:{guestToken?:unknown;account?:unknown},context:AuthContext){
      return await auth.authenticate(options,context)??{...await super.onAuth(client,options),guestToken:typeof options.guestToken==='string'?options.guestToken:undefined};
    }
    async authorize(client:Client){return !!client.auth&&await auth.authorize(client.auth);}
    async onJoin(client:Client,options:unknown,identity:GameIdentity){
      if(!await auth.authorize(identity))throw new ServerError(401,'Сеанс отозван. Войдите повторно.');
      client.auth=identity;
      await super.onJoin(client,options,identity);
      this.authStops.set(client.sessionId,auth.watch(identity,()=>client.leave(4001)));
    }
    onLeave(client:Client){this.authStops.get(client.sessionId)?.();this.authStops.delete(client.sessionId);super.onLeave(client);}
    async onDispose(){for(const stop of this.authStops.values())stop();this.authStops.clear();await super.onDispose();}
  }
  const game = new Server({
    transport: new WebSocketTransport(),
    greet: false,
    express: (app) => {
      const proxyHops=Number(process.env.AUTH_PROXY_HOPS??0);
      if(![0,1].includes(proxyHops))throw Error('AUTH_PROXY_HOPS must be 0 or 1.');
      app.set('trust proxy',proxyHops);
      mountAuth(app,auth);
      app.get("/health", async (_req: Request, res: Response) => {
        try {
          await store.health();
          res.json({
            status: "ok",
            persistence: store.mode,
            revision: process.env.APP_REVISION ?? "development",
          });
        } catch {
          res.status(503).json({
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
          res.status(503).json({
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
