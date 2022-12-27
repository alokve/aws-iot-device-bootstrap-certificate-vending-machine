// get crypto module
const crypto = require("crypto");

// string to be hashed
const DEVICE_UID = "DEVICE_007";

// secret or salt to be hashed with
const secret = "YOUR_SECRET_SALT";

// create a sha-256 hasher
const sha256Hasher = crypto.createHmac("sha256", secret);

// hash the string
// and set the output format
const hash = sha256Hasher.update(DEVICE_UID).digest("hex");

// A unique sha256 hash
console.log(hash); 

