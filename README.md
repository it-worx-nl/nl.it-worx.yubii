# Yubii Home & Fibaro HC3 for Homey

Unofficial [Homey Pro](https://homey.app) app that controls the devices of a **Nice Yubii Home** or **Fibaro Home Center 3 / HC3 Lite** over the local network — no cloud.

App ID: `nl.it-worx.yubii` · Test version: <https://homey.app/a/nl.it-worx.yubii/test/>

## Supported devices

| Device | Homey | Status |
|---|---|---|
| Shutters / blinds / awnings (incl. Nice one-way RF) | open, close, stop; position slider when the shutter reports its position | tested |
| Gates / garage doors (Nice) | open, close, stop flow card | beta |
| Lights / dimmers | on/off, dim | beta |
| Switches / plugs | on/off, power and energy when measured | beta |
| Sensors | motion, door/window, water, smoke, heat, CO, temperature, humidity, light, battery, tamper | beta |

*Beta* = implemented against the HC3 REST API but not yet verified on real hardware. Reports are welcome.

## How it works

- **Discovery:** Homey MAC discovery on the Fibar Group prefix `ac:17:02`, confirmed through the public `GET /api/settings/info`; falls back to probing the local /24 for that endpoint. No credentials are sent while searching.
- **Commands:** `POST /api/devices/{id}/action/{name}` with Basic Auth.
- **State:** one shared connection per hub follows the change feed `GET /api/refreshStates?last=N`. This is a long-poll: without changes the hub holds the request for about 30 seconds.
- **Login lockout:** the hub blocks logins after 4 failed attempts, so the app never retries automatically after HTTP 401.
- **One-way RF shutters** (`com.fibaro.remoteBaseShutter`) report no state; the app shows the last command and offers an optional blind repeat of open/close.

## Development

```bash
npm install -g homey
node test/classify.test.js     # unit tests (synthetic HC3 device fixtures)
node test/api-smoke.js         # read-only check against a real hub, reads ~/.yubii.env
homey app install              # install on your Homey Pro
```

## Support

Issues: <https://github.com/it-worx-nl/nl.it-worx.yubii/issues> · E-mail: homeysupport@it-worx.nl

Developed by Jean-Marc Zohlandt — [IT WORX](https://it-worx.nl). Not affiliated with Nice or Fibaro.

## License

MIT
