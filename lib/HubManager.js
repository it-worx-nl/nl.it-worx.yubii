'use strict';

const HC3Client = require('./HC3Client');

const POLL_MS = 250; // refreshStates is a long-poll (~30 s), so re-poll right away
const BACKOFF_MS = [5000, 15000, 30000, 60000];

/**
 * One shared connection per hub (host + username). Polls the hub's change feed
 * (/api/refreshStates) and forwards property changes to the Homey devices that registered for them.
 *
 * Important: on HTTP 401 polling STOPS completely (no retries). The hub blocks logins after
 * 4 failed attempts, so retrying with a wrong password would lock the user out.
 * Polling resumes only after the connection settings change (HubManager.get creates a new Hub).
 */
class Hub {

  constructor(homey, { host, username, password }) {
    this.homey = homey;
    this.client = new HC3Client({ host, username, password });
    this.listeners = new Map(); // hc3 device id -> Set<fn(props)>
    this.errorListeners = new Set();
    this.last = 0;
    this.failures = 0;
    this.stopped = false;
    this.timer = null;
  }

  subscribe(id, onChange, onError) {
    if (!this.listeners.has(id)) this.listeners.set(id, new Set());
    this.listeners.get(id).add(onChange);
    if (onError) this.errorListeners.add(onError);
    if (!this.timer && !this.stopped) this._schedule(0);
    return () => {
      const set = this.listeners.get(id);
      if (set) { set.delete(onChange); if (set.size === 0) this.listeners.delete(id); }
      if (onError) this.errorListeners.delete(onError);
      if (this.listeners.size === 0) this.stop();
    };
  }

  stop() {
    this.stopped = true;
    if (this.timer) this.homey.clearTimeout(this.timer);
    this.timer = null;
  }

  _schedule(ms) {
    this.timer = this.homey.setTimeout(() => this._poll(), ms);
  }

  async _poll() {
    this.timer = null;
    if (this.stopped) return;
    try {
      if (this.last === 0) {
        // Take the change-feed position FIRST, then the full snapshot: a change that happens in
        // between is then delivered again by the next refreshStates call instead of being lost.
        const s = await this.client.refreshStates(0);
        const devices = await this.client.getDevices();
        for (const d of devices) this._emit(d.id, { ...(d.properties || {}) });
        this.last = s.last || 0;
      } else {
        const s = await this.client.refreshStates(this.last);
        if (typeof s.last === 'number') this.last = s.last;
        for (const ch of s.changes || []) {
          const { id, ...props } = ch;
          if (id !== undefined) this._emit(id, props);
        }
      }
      this.failures = 0;
      this._schedule(POLL_MS);
    } catch (err) {
      this.errorListeners.forEach((fn) => fn(err));
      if (err.code === 'UNAUTHORIZED') {
        this.stop(); // never retry on 401 (login lockout)
        return;
      }
      this.last = 0; // resync with a full snapshot after a failure
      const wait = BACKOFF_MS[Math.min(this.failures, BACKOFF_MS.length - 1)];
      this.failures++;
      this._schedule(wait);
    }
  }

  _emit(id, props) {
    const set = this.listeners.get(id);
    if (!set || Object.keys(props).length === 0) return;
    for (const fn of set) {
      try { fn(props); } catch (e) { /* listener errors must not stop polling */ }
    }
  }

}

class HubManager {

  constructor(homey) {
    this.homey = homey;
    this.hubs = new Map();
  }

  static key({ host, username }) {
    return `${String(host).trim()}|${username}`;
  }

  get(conn) {
    const key = HubManager.key(conn);
    let hub = this.hubs.get(key);
    // Settings changed (e.g. new password) or previous hub stopped after 401 → fresh connection
    if (!hub || hub.client.password !== conn.password || hub.stopped) {
      if (hub) hub.stop();
      hub = new Hub(this.homey, conn);
      this.hubs.set(key, hub);
    }
    return hub;
  }

}

module.exports = HubManager;
