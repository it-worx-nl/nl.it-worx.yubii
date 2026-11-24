'use strict';

const BaseDevice = require('../../lib/BaseDevice');

/** Switches with the "light" role and dimmers (HC3 value 0-99). */
class LightDevice extends BaseDevice {

  async onInit() {
    if (this.hasCapability('dim')) {
      this.registerMultipleCapabilityListener(['onoff', 'dim'], async ({ onoff, dim }) => {
        if (dim !== undefined) return this.send('setValue', [Math.round(dim * 99)]);
        return this.send(onoff ? 'turnOn' : 'turnOff');
      }, 300);
    } else {
      this.registerCapabilityListener('onoff', (on) => this.send(on ? 'turnOn' : 'turnOff'));
    }
    await super.onInit();
  }

}

module.exports = LightDevice;
