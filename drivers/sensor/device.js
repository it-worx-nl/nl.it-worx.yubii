'use strict';

const BaseDevice = require('../../lib/BaseDevice');

/** Read-only sensors: values arrive through the hub's change feed. */
class SensorDevice extends BaseDevice {}

module.exports = SensorDevice;
