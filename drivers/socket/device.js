'use strict';

const BaseDevice = require('../../lib/BaseDevice');

/** On/off switches and plugs (optionally with power/energy measurement). */
class SocketDevice extends BaseDevice {

  async onInit() {
    this.registerCapabilityListener('onoff', (on) => this.send(on ? 'turnOn' : 'turnOff'));
    await super.onInit();
  }

}

module.exports = SocketDevice;
