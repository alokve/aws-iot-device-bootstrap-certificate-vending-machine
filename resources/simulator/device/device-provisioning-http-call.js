const https = require('https');
const crypto = require("crypto");
const args = process.argv;
let device_uid =args[2];
let hostname =args[3];
let path =args[4];
let method =args[5];

//console.log(`#Device_UID: ${device_uid} ; hostname: ${hostname} ; path ${path} ; method : ${method}` );

//Salt will be securely stored on the device
const secret_salt="YOUR_SECRET_SALT";
let device_token = calculateToken(device_uid, secret_salt);

const data = JSON.stringify({
  device_uid: device_uid,
  device_token: device_token
});

// Calling Certificate Vending machine 
const options = {
  hostname: hostname, 
  port: 443,
  path: path,
  method: method,
  headers: {
    'Content-Type': 'application/json'
  },
};

console.log ("#Calling CERTIFICATE VENDING MACHINE... with Device_UID and Device Token ...")
const req = https.request(options, res => {
  var response = '';
  res.on('data', d => {
    //  process.stdout.write(d);
    response += d;
  });

  res.on('end', d => {
    //console.log(response);
    response = JSON.parse(response);
    // saving the certificate and key files on local and iot.properties file
    if (response.payload && response.payload.certificates && response.payload.certificates.root_ca&& response.payload.endpoint) {
      writeFileContent('./certs/root-CA.crt', response.payload.certificates.root_ca);
      writeFileContent('./certs/thing.cert.pem', response.payload.certificates.device_certificate);
      writeFileContent('./certs/thing.private.key', response.payload.keyPair.privateKey);
      writeFileContent('./certs/thing.public.key', response.payload.keyPair.publicKey);
      writeFileContent('./iot.properties', `IOT_ENDPOINT=${response.payload.endpoint}`);

      console.log("# Certificate and Keys downloaded to the device .. DEVICE PROVISIONING COMPLETE ....");
      console.log("# ..................................................................................");
      console.log(`IOT_ENDPOINT=${response.payload.endpoint}`)
    }
    else
    {
      console.log(`#Device Provisioning Error : ${response}`);
      //console.log(` statusCode: ${response.statusCode}`);
    }

  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();

//
const fs = require('fs/promises');
const { Console } = require('console');

async function writeFileContent(filepath, content) {
  try {
    // const content = 'Some content!';
    await fs.writeFile(filepath, content);
  } catch (err) {
    console.log(err);
  }
}

function calculateToken(device_uid,secret_salt)
{
// string to be hashed
const DEVICE_UID = device_uid;

// secret or salt to be hashed with
const secret = secret_salt;

// create a sha-256 hasher
const sha256Hasher = crypto.createHmac("sha256", secret);

// hash the string
// and set the output format
const hash = sha256Hasher.update(DEVICE_UID).digest("hex");

// A unique sha256 hash
console.log("# DeviceToken calculated: ", hash); 
return hash;
}

