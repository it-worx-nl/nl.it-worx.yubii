'use strict';

/**
 * Minimal client for the local REST API of a Nice Yubii Home / Fibaro Home Center 3.
 *
 * Notes:
 * - Basic Auth with the HC user *login name* (not the e-mail address).
 * - The hub blocks logins temporarily after 4 failed attempts (GET /api/loginStatus shows the counter),
 *   so callers must never retry automatically on HTTP 401.
 * - Actions return HTTP 202 with a JSON-RPC style body.
 */
class HC3Client {

  constructor({ host, username, password, timeout = 10000 }) {
    this.host = String(host || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    this.username = username;
    this.password = password;
    this.timeout = timeout;
  }

  get baseUrl() {
    return `http://${this.host}/api`;
  }

  async _request(path, { method = 'GET', body, auth = true, timeout = this.timeout } = {}) {
    const headers = { Accept: 'application/json' };
    if (auth) {
      headers.Authorization = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let res;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const e = new Error(err.name === 'AbortError' ? 'timeout' : `unreachable: ${err.message}`);
      e.code = 'UNREACHABLE';
      e.cause = err.cause || err;
      throw e;
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401) {
      const e = new Error('Invalid username or password');
      e.code = 'UNAUTHORIZED';
      throw e;
    }
    if (!res.ok) {
      const e = new Error(`HTTP ${res.status}`);
      e.code = 'HTTP_ERROR';
      e.status = res.status;
      throw e;
    }
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      const e = new Error('Unexpected (non-JSON) response from hub');
      e.code = 'BAD_RESPONSE';
      throw e;
    }
  }

  /** Public hub info (no login needed): serialNumber, platform ("YH" = Yubii Home), softVersion, ... */
  getInfo() {
    return this._request('/settings/info', { auth: false });
  }

  /** Login counter: { status, retryNumber, limit, timeLeft } */
  getLoginStatus() {
    return this._request('/loginStatus', { auth: false });
  }

  getDevices() {
    return this._request('/devices');
  }

  getDevice(id) {
    return this._request(`/devices/${encodeURIComponent(id)}`);
  }

  getRooms() {
    return this._request('/rooms');
  }

  /**
   * Change feed: { last, changes: [{ id, <property>: value }], events: [...] } since `last`.
   * This is a LONG-POLL: without changes the hub holds the request for ~30 s (measured on a Yubii),
   * so the timeout must be longer than that.
   */
  refreshStates(last = 0) {
    return this._request(`/refreshStates?last=${encodeURIComponent(last)}`, { timeout: last ? 45000 : this.timeout });
  }

  action(id, name, args = []) {
    return this._request(`/devices/${encodeURIComponent(id)}/action/${encodeURIComponent(name)}`, {
      method: 'POST',
      body: { args },
    });
  }

}

module.exports = HC3Client;
