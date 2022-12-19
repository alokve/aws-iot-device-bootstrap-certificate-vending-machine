// let crypto = require ("crypto");

const deviceId = "deviceid_001"
const salt = "MyPrivateSalt151234"

console.log(require('crypto')
  .createHash('sha256')
  .update(deviceId+salt)
  .digest('hex'));