'use strict';

const HC3Client = require('./HC3Client');
const { classify } = require('./classify');

/** Probe all addresses of Homey's own /24 subnet for the public /api/settings/info endpoint. */
async function scanSubnet(homey, probe) {
  let own;
  try {
    own = String(await homey.cloud.getLocalAddress()).split(':')[0];
  } catch (err) {
    return [];
  }
  const m = own.match(/^(\d+\.\d+\.\d+)\.(\d+)$/);
  if (!m) return [];
  const targets = [];
  for (let i = 1; i < 255; i++) if (String(i) !== m[2]) targets.push(`${m[1]}.${i}`);
  const found = [];
  await Promise.all(Array.from({ length: 32 }, async () => {
    while (targets.length) {
      const hub = await probe(targets.shift(), 1500);
      if (hub) found.push(hub);
    }
  }));
  return found.sort((a, b) => a.host.localeCompare(b.host, undefined, { numeric: true }));
}

/**
 * Shared pairing flow for every driver: discover → connect → list devices of this driver's kind.
 * @param {Homey.Driver} driver
 * @param {PairSession} session
 * @param {string} driverId  'shutter' | 'garagedoor' | 'light' | 'socket' | 'sensor'
 */
function setupPairing(driver, session, driverId) {
  const { homey } = driver;
  let client = null;
  let conn = null;

  const probe = async (address, timeout = 4000) => {
    try {
      const info = await new HC3Client({ host: address, timeout }).getInfo();
      if (!info || !info.serialNumber) return null;
      return { host: address, name: info.hcName || info.serialNumber, platform: info.platform, version: info.softVersion };
    } catch (err) {
      return null;
    }
  };

  // 1. MAC prefix ac:17:02 (Fibar Group: Yubii Home, HC3, HC3 Lite), confirmed via /api/settings/info
  // 2. Fallback: scan the local /24 for the same endpoint (no credentials → no lockout risk)
  session.setHandler('discover', async () => {
    let results = {};
    try {
      results = homey.discovery.getStrategy('fibargroup').getDiscoveryResults();
    } catch (err) {
      driver.error('discovery not available:', err.message);
    }
    const hubs = (await Promise.all(Object.values(results).map((r) => probe(r.address)))).filter(Boolean);
    if (hubs.length > 0) return hubs;
    return scanSubnet(homey, probe);
  });

  session.setHandler('connect', async ({ host, username, password }) => {
    const candidate = new HC3Client({ host, username, password });
    let info;
    try {
      info = await candidate.getInfo();
    } catch (err) {
      throw new Error(homey.__('pair.unreachable', { host }));
    }
    try {
      await candidate.getDevices();
    } catch (err) {
      if (err.code === 'UNAUTHORIZED') {
        let left = '';
        try {
          const s = await candidate.getLoginStatus();
          left = ` (${Math.max(0, s.limit - s.retryNumber)} ${homey.__('pair.attempts_left')})`;
        } catch (e) { /* ignore */ }
        throw new Error(homey.__('pair.unauthorized') + left);
      }
      throw err;
    }
    client = candidate;
    conn = { host: candidate.host, username, password };
    return { name: info.hcName || info.serialNumber, platform: info.platform, version: info.softVersion };
  });

  session.setHandler('list_devices', async () => {
    if (!client) throw new Error(homey.__('pair.not_connected'));
    const [devices, rooms, info] = await Promise.all([
      client.getDevices(),
      client.getRooms().catch(() => []),
      client.getInfo().catch(() => ({})),
    ]);
    const roomName = Object.fromEntries((rooms || []).map((r) => [r.id, r.name]));
    return devices
      .map((d) => ({ d, c: classify(d) }))
      .filter(({ c }) => c && c.driver === driverId)
      .map(({ d, c }) => ({
        name: d.name,
        data: { id: d.id, hub: info.serialNumber || conn.host },
        settings: { ...conn },
        capabilities: c.capabilities,
        store: { ...c.store, type: d.type, room: roomName[d.roomID] || null },
      }));
  });
}

module.exports = { setupPairing };
