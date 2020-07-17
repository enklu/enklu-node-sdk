const { schemas, schemaMap } = require('./schemas');

/**
 * Validates a Mycelium against a JSON schema.
 * @param {object} msg 
 * @param {number} msg.id
 * @param {string} msg.type
 * @param {object} msg.payload
 */
const validate = (msg) => {
  // TODO: implement!
  return false;
};

/**
 * Converts a myclium message object to a binary format
 * @param {object} msg 
 * @param {number} msg.id
 * @param {string} msg.type
 * @param {object} msg.payload
 */
const encode = (msg) => {
  // TODO: implement!
  return null;
}

module.exports = {
  validate,
  encode
};