/**
 * Decode base64 string from an array
 * @param {BufferSource} bufferSource
 * @returns {string}
 */
function arrayToBase64(bufferSource) {
  return Buffer.from(bufferSource).toString("base64");
}

/**
 * Encode base64 string into an array
 * @param {String} base64String
 * @returns {Uint8Array}
 */
function base64ToArray(base64String) {
  return Buffer.from(base64String, 'base64');
}

/**
 * Decode string from an array
 * @param {BufferSource} bufferSource
 * @returns {string}
 */
function arrayToString(bufferSource) {
  const utf8Decoder = new TextDecoder()
  return utf8Decoder.decode(bufferSource)
}

/**
 * Encode string into an array
 * @param {String} string
 * @returns {Uint8Array}
 */
function stringToArray(string) {
  const utf8Encoder = new TextEncoder()
  return utf8Encoder.encode(string)
}

/**
 * Encode JSON object into base64 string
 * @param {Object} json
 * @returns {string}
 */
function jsonToBase64(json) {
  const jsonString = JSON.stringify(json)
  return Buffer.from(jsonString).toString("base64");
}

/**
 * Decode JSON object from base64 string
 * @param {string} b64string
 * @returns {Object}
 */
function base64ToJson(b64string) {
  const string = Buffer.from(b64string, 'base64');
  return JSON.parse(string);
}

/**
 * Transform an array into data URL
 * @param {BufferSource} bufferSource
 * @returns {Promise.<string>}
 */
 function arrayToDataUrl(bufferSource) {
  // const blob = new Blob([bufferSource])
  // return URL.createObjectURL(blob)
}

/**
 * Transform data URL into an array
 * @param {string} dataUrl
 * @returns {Promise.<Uint8Array>}
 */
async function dataUrlToArray(dataUrl) {
  // const res = await fetch(dataUrl)
  // const blob = await res.blob()
  // return blobToArray(blob)
}

/**
 * Transform file blob into an array
 * @param {Blob} blob
 * @returns {Promise.<Uint8Array>}
 */
async function blobToArray(blob) {
  // const fileBuffer = await new Response(blob).arrayBuffer()
  // const fileArray = Buffer.from(fileBuffer)
  // return fileArray
}

module.exports = {
  arrayToBase64,
  base64ToArray,
  arrayToString,
  stringToArray,
  jsonToBase64,
  base64ToJson,
  arrayToDataUrl,
  dataUrlToArray,
  blobToArray
}