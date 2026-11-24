'use strict';

/**
 * Decide which Homey driver and capabilities fit a Fibaro HC3 / Yubii Home device.
 * Based on type/baseType, properties.categories and properties.deviceRole, plus available actions.
 * Returns null for devices the app does not support (users, plugins, parent nodes, ...).
 */

const has = (d, action) => !!(d.actions && action in d.actions);
const typeOf = (d) => `${d.type || ''} ${d.baseType || ''}`.toLowerCase();
const cats = (d) => ((d.properties || {}).categories || []).map((c) => String(c).toLowerCase());
const role = (d) => String((d.properties || {}).deviceRole || '').toLowerCase();

const SENSOR_TYPES = [
  // [match in type/baseType, capability, kind]
  ['motionsensor', 'alarm_motion', 'bool'],
  ['doorwindowsensor', 'alarm_contact', 'bool'],
  ['doorsensor', 'alarm_contact', 'bool'],
  ['windowsensor', 'alarm_contact', 'bool'],
  ['floodsensor', 'alarm_water', 'bool'],
  ['smokesensor', 'alarm_smoke', 'bool'],
  ['heatdetector', 'alarm_heat', 'bool'],
  ['codetector', 'alarm_co', 'bool'],
  ['temperaturesensor', 'measure_temperature', 'number'],
  ['humiditysensor', 'measure_humidity', 'number'],
  ['lightsensor', 'measure_luminance', 'number'],
];

function extraCapabilities(d, { battery = true } = {}) {
  const p = d.properties || {};
  const caps = [];
  if (typeof p.power === 'number') caps.push('measure_power');
  if (typeof p.energy === 'number') caps.push('meter_power');
  if (battery && typeof p.batteryLevel === 'number') caps.push('measure_battery');
  if (typeof p.tamper === 'boolean') caps.push('alarm_tamper');
  return caps;
}

function classify(d) {
  if (!d || d.visible === false || d.enabled === false) return null;
  const t = typeOf(d);
  const c = cats(d);
  const r = role(d);
  const p = d.properties || {};

  // Gates and garage doors (Nice gates, garage door controllers)
  if ((c.includes('gates') || /gate|garage/.test(t) || /gate|garage/.test(r)) && has(d, 'open') && has(d, 'close')) {
    return { driver: 'garagedoor', capabilities: ['garagedoor_closed'], store: {} };
  }

  // Shutters, blinds, awnings
  if ((c.includes('blinds') || /shutter|blind|awning/.test(t) || /blind|awning/.test(r)) && has(d, 'open') && has(d, 'close')) {
    const hasPosition = typeof p.value === 'number' && d.type !== 'com.fibaro.remoteBaseShutter' && has(d, 'setValue');
    return { driver: 'shutter', capabilities: hasPosition ? ['windowcoverings_state', 'windowcoverings_set'] : ['windowcoverings_state'], store: { hasPosition } };
  }

  // Dimmers
  if (/multilevelswitch/.test(t) && has(d, 'setValue')) {
    return { driver: 'light', capabilities: ['onoff', 'dim', ...extraCapabilities(d, { battery: false })], store: {} };
  }

  // On/off switches: light when the hub says so, otherwise socket
  if ((/binaryswitch/.test(t) || (has(d, 'turnOn') && has(d, 'turnOff'))) && !/sensor/.test(t)) {
    const isLight = c.includes('lights') || r === 'light' || p.isLight === true;
    return { driver: isLight ? 'light' : 'socket', capabilities: ['onoff', ...extraCapabilities(d, { battery: false })], store: {} };
  }

  // Sensors
  for (const [match, cap, kind] of SENSOR_TYPES) {
    if (t.includes(match)) {
      return { driver: 'sensor', capabilities: [cap, ...extraCapabilities(d)], store: { primary: cap, kind } };
    }
  }

  return null;
}

/** Translate hub properties into Homey capability values for a classified device. */
function toCapabilityValues(store, capabilities, props) {
  const out = {};
  const v = props.value;
  const set = (cap, val) => { if (capabilities.includes(cap) && val !== undefined && val !== null && !Number.isNaN(val)) out[cap] = val; };

  if (capabilities.includes('onoff') && v !== undefined) {
    set('onoff', typeof v === 'boolean' ? v : Number(v) > 0);
    if (capabilities.includes('dim') && typeof v === 'number') set('dim', Math.max(0, Math.min(1, v / 99)));
  }
  if (capabilities.includes('windowcoverings_set') && typeof v === 'number') set('windowcoverings_set', Math.max(0, Math.min(1, v / 99)));
  if (capabilities.includes('garagedoor_closed') && v !== undefined) {
    // HC3: value 0 / false = closed
    set('garagedoor_closed', typeof v === 'boolean' ? !v : Number(v) === 0);
  }
  if (store.primary && v !== undefined) {
    if (store.kind === 'bool') set(store.primary, typeof v === 'boolean' ? v : Number(v) > 0 || v === 'true');
    else set(store.primary, Number(v));
  }
  if (props.power !== undefined) set('measure_power', Number(props.power));
  if (props.energy !== undefined) set('meter_power', Number(props.energy));
  if (props.batteryLevel !== undefined) set('measure_battery', Math.max(0, Math.min(100, Number(props.batteryLevel))));
  if (props.tamper !== undefined) set('alarm_tamper', !!props.tamper);
  return out;
}

module.exports = { classify, toCapabilityValues };
