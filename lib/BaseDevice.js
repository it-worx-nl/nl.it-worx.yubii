'use strict';

const Homey = require('homey');
const HC3Client = require('./HC3Client');
const { toCapabilityValues } = require('./classify');

const CONNECTION_KEYS = ['host', 'username', 'password'];

/**
 * Common behaviour for every device of this app:
 * - one shared hub connection (HubManager) that follows the hub's change feed
 * - capability values updated from hub properties
 * - unavailable when the hub marks the device "dead" or rejects the login
 * - commands sent with the HC3 action API; never auto-retry on 401 (login lockout)
 *
 * The connection (host/username/password) is stored per device, but all devices of one hub must
 * use the same values: they share one Hub object. Changing it on one device therefore updates
 * every device of that hub (see onSettings).
 */
class BaseDevice extends Homey.Device {

  async onInit() {
    this.applyConnection(this._conn());
  }

  _conn(settings = this.getSettings()) {
    return { host: settings.host, username: settings.username, password: settings.password };
  }

  /** (Re)connect this device: new client for commands + subscription on the shared hub. */
  applyConnection(conn) {
    this.client = new HC3Client(conn);
    if (this._unsubscribe) this._unsubscribe();
    this._unsubscribe = this.homey.app.hubs.get(conn).subscribe(
      this.getData().id,
      (props) => this.onHubProperties(props).catch(this.error),
      (err) => this.onHubError(err).catch(this.error),
    );
  }

  async onHubProperties(props) {
    if (props.dead === true) {
      this._dead = true;
      await this.setUnavailable(this.homey.__('device.dead'));
    } else if (props.dead === false) {
      this._dead = false;
      await this.setAvailable();
    } else if (!this.getAvailable() && !this._dead) {
      await this.setAvailable(); // hub reachable again after a connection error
    }
    const values = toCapabilityValues(this.getStore(), this.getCapabilities(), props);
    for (const [cap, value] of Object.entries(values)) {
      if (this.getCapabilityValue(cap) !== value) await this.setCapabilityValue(cap, value).catch(this.error);
    }
  }

  async onHubError(err) {
    this.error('hub error:', err.code || '', err.message);
    await this.setUnavailable(this._errorMessage(err));
  }

  _errorMessage(err) {
    if (err.code === 'UNAUTHORIZED') return this.homey.__('device.unauthorized');
    if (err.code === 'HTTP_ERROR' || err.code === 'BAD_RESPONSE') return this.homey.__('device.hub_error');
    return this.homey.__('device.unreachable');
  }

  /** All devices (of every driver in this app) that belong to the same hub as this one. */
  _hubSiblings() {
    const hub = this.getData().hub;
    return Object.values(this.homey.drivers.getDrivers())
      .flatMap((driver) => driver.getDevices())
      .filter((d) => d !== this && d.getData().hub === hub);
  }

  async onSettings({ newSettings, changedKeys }) {
    if (!changedKeys.some((k) => CONNECTION_KEYS.includes(k))) return;

    const conn = this._conn(newSettings);
    try {
      await new HC3Client(conn).getDevice(this.getData().id);
    } catch (err) {
      throw new Error(err.code === 'UNAUTHORIZED'
        ? this.homey.__('pair.unauthorized')
        : this.homey.__('pair.unreachable', { host: newSettings.host }));
    }

    // Keep every device of this hub on the same credentials (they share one Hub connection)
    for (const sibling of this._hubSiblings()) {
      await sibling.setSettings(conn).catch(this.error); // setSettings does not trigger sibling.onSettings
      sibling.applyConnection(conn);
    }
    this.applyConnection(conn);
    await this.setAvailable();
  }

  async send(action, args = []) {
    try {
      await this.client.action(this.getData().id, action, args);
      if (!this.getAvailable() && !this._dead) await this.setAvailable();
    } catch (err) {
      this.error(`action ${action} failed:`, err.code || '', err.message);
      if (err.code === 'UNAUTHORIZED') await this.setUnavailable(this._errorMessage(err));
      throw new Error(this._errorMessage(err));
    }
  }

  async onDeleted() {
    await this.onUninit();
  }

  async onUninit() {
    if (this._unsubscribe) this._unsubscribe();
    this._unsubscribe = null;
  }

}

module.exports = BaseDevice;
