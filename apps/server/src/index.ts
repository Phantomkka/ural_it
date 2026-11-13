import { createGameServer } from './server.js';
const port = Number(process.env.PORT ?? 2567);
const game = createGameServer();
await game.listen(port, '0.0.0.0');
console.log(`NETCITY server listening on ${port}`);
