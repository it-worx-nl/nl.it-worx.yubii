// Tests for device classification. Fixtures are SYNTHETIC examples modelled on the Fibaro HC3 device
// structure (type/baseType/properties/actions) — not captured from a real HC3. Real Yubii shutters are tested live.
'use strict';
const assert = require('assert');
const { classify, toCapabilityValues } = require('../lib/classify');
const A = (...n) => Object.fromEntries(n.map((x) => [x, 0]));
const cases = [
  ['Nice-rolluik (echt, Yubii)', { type: 'com.fibaro.remoteBaseShutter', baseType: 'com.fibaro.remoteController', properties: { categories: ['blinds'], deviceRole: 'BlindsWithoutPositioning' }, actions: A('open', 'close', 'stop') }, 'shutter', ['windowcoverings_state']],
  ['Z-Wave rolluik met stand', { type: 'com.fibaro.rollerShutter', properties: { value: 40, categories: ['blinds'] }, actions: A('open', 'close', 'stop', 'setValue') }, 'shutter', ['windowcoverings_state', 'windowcoverings_set']],
  ['Nice-poort', { type: 'com.fibaro.remoteGate', properties: { categories: ['gates'], deviceRole: 'Gate' }, actions: A('open', 'close', 'stop') }, 'garagedoor', ['garagedoor_closed']],
  ['Dimmer met vermogen', { type: 'com.fibaro.FGD212', baseType: 'com.fibaro.multilevelSwitch', properties: { value: 50, power: 12.3, energy: 4.2, categories: ['lights'] }, actions: A('turnOn', 'turnOff', 'setValue') }, 'light', ['onoff', 'dim', 'measure_power', 'meter_power']],
  ['Schakelaar als lamp', { type: 'com.fibaro.binarySwitch', properties: { value: true, deviceRole: 'Light' }, actions: A('turnOn', 'turnOff') }, 'light', ['onoff']],
  ['Stopcontact met meting', { type: 'com.fibaro.FGWP102', baseType: 'com.fibaro.binarySwitch', properties: { value: false, power: 0, energy: 1.1, categories: ['other'] }, actions: A('turnOn', 'turnOff') }, 'socket', ['onoff', 'measure_power', 'meter_power']],
  ['Bewegingssensor', { type: 'com.fibaro.FGMS001v2', baseType: 'com.fibaro.motionSensor', properties: { value: false, batteryLevel: 80, tamper: false }, actions: {} }, 'sensor', ['alarm_motion', 'measure_battery', 'alarm_tamper']],
  ['Deursensor', { type: 'com.fibaro.doorSensor', properties: { value: true, batteryLevel: 95 }, actions: {} }, 'sensor', ['alarm_contact', 'measure_battery']],
  ['Temperatuursensor', { type: 'com.fibaro.temperatureSensor', properties: { value: 21.5 }, actions: {} }, 'sensor', ['measure_temperature']],
  ['Waterlek', { type: 'com.fibaro.floodSensor', properties: { value: false }, actions: {} }, 'sensor', ['alarm_water']],
  ['Gebruiker (niet ondersteund)', { type: 'HC_user', properties: {}, actions: A('sendPush') }, null, null],
  ['Verborgen apparaat', { type: 'com.fibaro.binarySwitch', visible: false, properties: {}, actions: A('turnOn', 'turnOff') }, null, null],
];
let ok = 0;
for (const [name, dev, driver, caps] of cases) {
  const c = classify(dev);
  assert.strictEqual(c ? c.driver : null, driver, `${name}: driver`);
  if (caps) assert.deepStrictEqual(c.capabilities, caps, `${name}: capabilities`);
  ok++;
}
// value mapping
assert.deepStrictEqual(toCapabilityValues({}, ['onoff', 'dim'], { value: 99 }), { onoff: true, dim: 1 });
assert.deepStrictEqual(toCapabilityValues({}, ['onoff', 'dim'], { value: 0 }), { onoff: false, dim: 0 });
assert.deepStrictEqual(toCapabilityValues({ primary: 'alarm_motion', kind: 'bool' }, ['alarm_motion', 'measure_battery'], { value: true, batteryLevel: 55 }), { alarm_motion: true, measure_battery: 55 });
assert.deepStrictEqual(toCapabilityValues({ primary: 'measure_temperature', kind: 'number' }, ['measure_temperature'], { value: '19.5' }), { measure_temperature: 19.5 });
assert.deepStrictEqual(toCapabilityValues({}, ['garagedoor_closed'], { value: 0 }), { garagedoor_closed: true });
assert.deepStrictEqual(toCapabilityValues({}, ['onoff', 'measure_power'], { power: 7.5 }), { measure_power: 7.5 });
// The pair view must be identical in every driver (Homey needs one copy per driver)
const fs = require('fs');
const views = fs.readdirSync(`${__dirname}/../drivers`).map((d) => fs.readFileSync(`${__dirname}/../drivers/${d}/pair/connect.html`, 'utf8'));
assert.ok(views.every((v) => v === views[0]), 'connect.html differs between drivers');
console.log(`classify: ${ok} gevallen + 6 waarde-omzettingen + ${views.length}× identieke connect.html OK`);
