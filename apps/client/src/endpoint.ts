export const gameEndpoint = () => import.meta.env.VITE_SERVER_URL || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/game`;
export const gameHttp = () => gameEndpoint().replace(/^ws/, 'http').replace(/\/$/, '');
