import { ID_PREFIX } from '../../constants';

export const generateShortCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

export const getBeaconId = (code: string) => `${ID_PREFIX}${code}`;

export const logger = {
  log: (message: string) => console.log(`[p2p] ${message}`),
  warn: (message: string) => console.warn(`[p2p] ${message}`),
  error: (message: string) => console.error(`[p2p] ${message}`),
};
