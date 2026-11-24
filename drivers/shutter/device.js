'use strict';

const BaseDevice = require('../../lib/BaseDevice');

const ACTION = { up: 'open', down: 'close', idle: 'stop' };

class ShutterDevice extends BaseDevice {

  async onInit() {
    // Devices that report a position (e.g. Z-Wave roller shutters) also get a slider
    if (this.getStore().hasPosition && !this.hasCapability('windowcoverings_set')) {
      await this.addCapability('windowcoverings_set');
    }
    this.registerCapabilityListener('windowcoverings_state', (value) => this._onState(value));
    if (this.hasCapability('windowcoverings_set')) {
      this.registerCapabilityListener('windowcoverings_set', (value) => this.send('setValue', [Math.round(value * 99)]));
    }
    await super.onInit();
  }

  async _onState(value) {
    await this.send(ACTION[value]);
    this._scheduleRepeats(value);
    // One-way RF shutters give no feedback: show the movement for the travel time, then idle
    if (this._idleTimer) this.homey.clearTimeout(this._idleTimer);
    if (value !== 'idle') {
      const ms = (this.getSetting('travel_time') || 30) * 1000;
      this._idleTimer = this.homey.setTimeout(() => {
        this.setCapabilityValue('windowcoverings_state', 'idle').catch(this.error);
      }, ms);
    }
  }

  /**
   * Blind repeat for one-way RF: re-send open/close a few times (no feedback is available).
   * A new command cancels pending repeats, and 'idle' (stop) is never repeated, so a repeat can
   * never undo a later stop or reverse a newer command.
   */
  _scheduleRepeats(value) {
    (this._repeatTimers || []).forEach((t) => this.homey.clearTimeout(t));
    this._repeatTimers = [];
    if (value === 'idle') return;
    const count = this.getSetting('repeat_count') || 0;
    const delay = (this.getSetting('repeat_delay') || 2) * 1000;
    for (let i = 1; i <= count; i++) {
      this._repeatTimers.push(this.homey.setTimeout(() => {
        this.client.action(this.getData().id, ACTION[value])
          .then(() => this.log(`repeat ${i}/${count}: ${ACTION[value]}`))
          .catch((err) => this.error(`repeat ${i} failed:`, err.message));
      }, delay * i));
    }
  }

  async onUninit() {
    if (this._idleTimer) this.homey.clearTimeout(this._idleTimer);
    (this._repeatTimers || []).forEach((t) => this.homey.clearTimeout(t));
    await super.onUninit();
  }

}

module.exports = ShutterDevice;
