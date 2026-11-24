'use strict';

const BaseDevice = require('../../lib/BaseDevice');

/** Nice gates / garage doors: open, close (and stop via flow). Without feedback the state is optimistic. */
class GarageDoorDevice extends BaseDevice {

  async onInit() {
    this.registerCapabilityListener('garagedoor_closed', (closed) => this.send(closed ? 'close' : 'open'));
    await super.onInit();
  }

  async stop() {
    await this.send('stop');
  }

}

module.exports = GarageDoorDevice;
