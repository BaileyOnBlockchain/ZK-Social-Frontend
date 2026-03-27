/**
 * Live user tracking
 * Tracks active users using localStorage (client-side only)
 * In production, replace with WebSockets or Supabase Realtime
 */

interface ActiveUser {
  address: string;
  page: string;
  lastSeen: number;
}

const STORAGE_KEY = 'privnet_live_users';
const STALE_TIMEOUT = 30000; // 30 seconds

function getActiveUsers(): ActiveUser[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ActiveUser[]) : [];
  } catch {
    return [];
  }
}

function saveActiveUsers(users: ActiveUser[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch (error) {
    console.error('Error saving live users:', error);
  }
}

export function registerActiveUser(address: string, page: string): void {
  if (typeof window === 'undefined' || !address) return;

  const users = getActiveUsers();
  const now = Date.now();
  const existingIndex = users.findIndex(
    u => u.address.toLowerCase() === address.toLowerCase()
  );

  if (existingIndex >= 0) {
    users[existingIndex] = { address: address.toLowerCase(), page, lastSeen: now };
  } else {
    users.push({ address: address.toLowerCase(), page, lastSeen: now });
  }

  saveActiveUsers(users);
}

export function cleanupStaleUsers(): void {
  if (typeof window === 'undefined') return;
  const users = getActiveUsers();
  const now = Date.now();
  const active = users.filter(u => now - u.lastSeen < STALE_TIMEOUT);
  if (active.length !== users.length) saveActiveUsers(active);
}

export function getLiveUserCount(): number {
  if (typeof window === 'undefined') return 0;
  cleanupStaleUsers();
  const unique = new Set(getActiveUsers().map(u => u.address));
  return unique.size;
}

export function getActiveUsersByPage(page: string): ActiveUser[] {
  if (typeof window === 'undefined') return [];
  cleanupStaleUsers();
  return getActiveUsers().filter(u => u.page === page);
}

export function getLiveUserCountByPage(page: string): number {
  return getActiveUsersByPage(page).length;
}
