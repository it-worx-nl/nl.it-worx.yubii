'use strict';

const Homey = require('homey');
const { setupPairing } = require('../../lib/pairing');

class Driver extends Homey.Driver {

  async onPair(session) {
    setupPairing(this, session, 'socket');
  }

}

module.exports = Driver;
