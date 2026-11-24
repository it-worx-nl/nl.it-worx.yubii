'use strict';

const Homey = require('homey');
const { setupPairing } = require('../../lib/pairing');

class ShutterDriver extends Homey.Driver {

  async onPair(session) {
    setupPairing(this, session, 'shutter');
  }

}

module.exports = ShutterDriver;
