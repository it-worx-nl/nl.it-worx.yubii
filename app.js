'use strict';

const Homey = require('homey');
const HubManager = require('./lib/HubManager');

class YubiiApp extends Homey.App {

  async onInit() {
    this.hubs = new HubManager(this.homey);

    this.homey.flow.getActionCard('garagedoor_stop')
      .registerRunListener(async ({ device }) => device.stop());
    this.log('Yubii Home & Fibaro HC3 app started');
  }

}

module.exports = YubiiApp;
