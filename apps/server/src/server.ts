import type { Request, Response } from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ROOM_NAME } from '@netcity/shared';
import { StreetRoom } from './StreetRoom.js';
export function createGameServer() {
  const game = new Server({
    transport: new WebSocketTransport(),
    greet: false,
    express: app => { app.get('/health', (_req: Request, res: Response) => { res.json({ status: 'ok' }); }); },
  });
  game.define(ROOM_NAME, StreetRoom);
  return game;
}
