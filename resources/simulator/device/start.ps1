# exit if cmdlet gives error
$ErrorActionPreference = "Stop"

## Read the device paramaters from properties file ##
#!/usr/bin/env bash
# requires: Nodejs/NPM, PowerShell
# Permission to run PS scripts (for this session only):
# Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

$ScriptDir = Split-Path $script:MyInvocation.MyCommand.Path
$DevicePropertiyFile = $ScriptDir+"\device.properties"
$IOTPropertyFile = $ScriptDir+"\iot.properties"
# Getting the contents of the External Variable text file
# This file is store in plan text and is not in any special format
# We use the "raw" parameter here in Get-Content so that when we get the contents
# of the file so that our hashtable is not converted to an object
$deviceProperties = Get-Content -raw -Path $DevicePropertiyFile | ConvertFrom-StringData
$iotProperties = Get-Content -raw -Path $IOTPropertyFile | ConvertFrom-StringData
#write-host "`nPrinting `$program" 
#$deviceProperties
#$iotProperties
################################

# Check to see if device certificate file exists, download if not
If (!(Test-Path ".\certs\thing.cert.pem")) {
    "`n Initiating.. Device Provisioning ..."
    # calling the Certificate Vending Machine API endpoint to provision with device parameters
    # Device specific AWS IoT resources and downloading certificates and keys on device
    $cmdOutput =  node device-provisioning-http-call.js $deviceProperties.DEVICEID $deviceProperties.PROVISIONING_API_ENDPOINT $deviceProperties.PROVISIONING_API_PATH $deviceProperties.PROVISIONING_API_METHOD
    ## cmdOutput should return a line with property -> IOT_ENDPOINT=<IOTendpoint>
    $outputString =  $cmdOutput | out-string
    "`n Output .. $outputString"
    $outputProperties = ConvertFrom-StringData -StringData $outputString
    ## replacing the IOT_ENDPOINT property with the endpoint details returned from the provisioning API
    $iotProperties.IOT_ENDPOINT = $outputProperties.IOT_ENDPOINT
}

# install AWS Device SDK for NodeJS if not already installed
node -e "require('aws-iot-device-sdk')"
If (!($?)) {
    "`nInstalling AWS SDK..."
    npm install aws-iot-device-sdk
}

"`nRunning device client application..." 
"IOTEndpoint: "
$iotProperties.IOT_ENDPOINT
node ..\..\..\node_modules\aws-iot-device-sdk\examples\device-example.js --host-name $iotProperties.IOT_ENDPOINT --private-key .\certs\thing.private.key --client-certificate .\certs\thing.cert.pem --ca-certificate .\certs\root-CA.crt --client-id=sdk-nodejs-b3b17f7b-2065-4ff8-827d-69ffe1edfbe1
