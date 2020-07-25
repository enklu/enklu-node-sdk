const { schemas, schemaMap } = require('./schemas');
const { 
  typeFromRef,
  getAllProperties,
  getSchemaType 
} = require('./schemaUtils');

const ALLOC_SIZE = 4096;

/**
 * Validates a Mycelium against a JSON schema.
 * @param {object} msg The message object.
 * @param {number} msg.id The multiplayer message id. If not present, `msg.type` is required.
 * @param {string} msg.event The multiplayer message name. If not present, `msg.id` is required.
 * @param {object} msg.payload The message body.
 */
const validate = (msg) => {
  let event = msg.event;
  if (!event) {
     event = schemaMap.idToEvent[msg.id];
  }

  let schema = schemas[event];

  if (!schema) {
    return false;
  }

  // TODO: validate against every field

  return true;
};

/**
 * Recursively converts a myclium message object to a binary format
 * @param {object} msg The message object.
 * @param {number} msg.id The multiplayer message id. If not present, `msg.type` is required.
 * @param {string} msg.type The multiplayer message name. If not present, `msg.id` is required.
 * @param {object} msg.payload The message body.
 */
const encode = (msg) => {
  let event = msg.event;
  let id = msg.id;

  if (!event) {
     event = schemaMap.idToEvent[id];
  }

  if (!id) {
    id = schemaMap.eventToId[event];
  }

  let schema = schemas[event];

  if (!schema) {
    return null;
  }

  let buffers = [];
  let offset = 0;
  let buffer = getBufferWithRoom(buffers, offset, 0)
  // save space for length
  buffer.buffer.writeUInt16BE(0);
  // encode id
  buffer.buffer.writeUInt16BE(id, 2);
  offset = buffer.offset + 4;
  // encode payload
  const res = encodeFields(msg.payload, schema, schema.definitions, { buffers, offset })
  buffers = res.buffers;
  offset = res.offset;

  let size = 0;
  for (let i = 0; i < buffers.length - 1; i++) {
    size += buffers[i].length;
  }
  size += offset;
  let encoded = Buffer.concat(buffers, size);

  // write message length
  encoded.writeUInt16BE(size - 2);
  return encoded;
}

/**
 * Recursively encode a message payload based on a Json schema.
 * 
 * @param {object} payload 
 * @param {object} schema 
 * @param {Array<object>} definitions 
 * @param {object} bufferParams 
 * @param {Buffer[]} bufferParams.buffers
 * @param {number} bufferParams.offset
 */ 
const encodeFields = (payload, schema, definitions, { buffers, offset }) => {
  if (!buffers || !Array.isArray(buffers) || !buffers.length) {
    return { offset, buffers };
  }

  const type = getSchemaType(schema);
  const properties = getAllProperties(schema, definitions);

  switch (type) {
    case 'integer': {
      if (schema.format === 'int32') {
        let buffer = getBufferWithRoom(buffers, offset, 4);
        buffer.buffer.writeInt32BE(payload, offset);
        offset = buffer.offset + 4;
      } else {
        buffer = getBufferWithRoom(buffers, offset, 4);
        buffer.buffer.writeInt16BE(payload, offset);
        offset = buffer.offset + 2;
      }
      
      return { offset, buffers };
    }
    case 'number': {
      let buffer = getBufferWithRoom(buffers, offset, 4);
      buffer.buffer.writeFloatBE(payload, offset);
      offset = buffer.offset + 4;
      return { offset, buffers };
    }
    case 'boolean': {
      let buffer = getBufferWithRoom(buffers, offset, 1);
      buffer.buffer.writeUInt8(payload, offset);
      offset = buffer.offset + 1;
      return { offset, buffers };
    }
    case 'string': {
      const len = payload.length;
      const total = len + 2;
      let buffer = getBufferWithRoom(buffers, offset, total);
      buffer.buffer.writeUInt16BE(len, offset);
      offset = buffer.offset + 2;
      buffer.buffer.write(payload, offset);
      offset += len;
      return { offset, buffers };
    }
    case 'array': {
      const items = schema.items || {};
      const arrRef = items['$ref'] || '';
      const refType = typeFromRef(arrRef);
      const definition = definitions[refType];

      let buffer = getBufferWithRoom(buffers, offset, 2);
      buffer.buffer.writeUInt16BE(payload.length, offset);
      offset = buffer.offset + 2;

      for (let item of payload) {
        const res = encodeFields(item, definition, definitions, { buffers, offset });
        offset = res.offset;
        buffers = res.buffers;
      }

      return { offset, buffers };
    }
    case 'object': {
      let buffer = getBufferWithRoom(buffers, offset, 1);
      const allocated = !!payload;
      buffer.buffer.writeUInt8(allocated, offset);
      offset = buffer.offset + 1;

      if (!allocated) {
        return { offset, buffers };
      }

      const keys = Object.keys(properties).sort();
      for (const key of keys) {
        const field = payload[key];
        if (field === null || field === undefined) {
          continue;
        }
        const property = properties[key];
        const oneOf = property.oneOf;
        let item = {};
        if (oneOf && oneOf[oneOf.length - 1]) {
          const ref = oneOf[oneOf.length - 1]['$ref'] || '';
          const refType = typeFromRef(ref);
          const definition = definitions[refType];
          item = encodeFields(field, definition, definitions, { buffers, offset });
        } else {
          item = encodeFields(field, property, definitions, { buffers, offset });
        }
        offset = item.offset;
        buffers = item.buffers;
      }

      return { offset, buffers };
    }
    case 'map': {
      const keys = Object.keys(payload).sort();
      let buffer = getBufferWithRoom(buffers, offset, 2);
      buffer.buffer.writeUInt16BE(keys.length, offset);
      offset = buffer.offset + 2;

      const additionalProperties = schema.additionalProperties;
      const mapProps = getAllProperties(additionalProperties, definitions);

      for (const key of keys) {
        // first encode the key
        buffer = getBufferWithRoom(buffers, offset, 2);
        buffer.offset.writeUInt16BE(key.length, offset);
        offset = buffer.offset + 2;

        // then the value
        const val = payload[key];
        const res = encodeFields(val, mapProps, definitions, { buffers, offset });

        offset = res.offset;
        buffers = res.buffers;
      }

      return { buffers, offset };
    }
  }

  return { offset, buffers };
}

/**
 * Finds or allocates a buffer with enough space to write the specified number of bytes.
 * @param {Buffer[]} buffers The array of buffers to evaluate.
 * @param {number} offset The write offset for the most recently used buffer.
 * @param {number} size The number of bytes that need to be written.
 */
const getBufferWithRoom = (buffers, offset, size) => {
  if (!buffers.length) {
    return addNewBuffer(buffers);
  }
  
  let buffer = buffers[buffers.length - 1];
  const roomLeft = buffer.length - offset;
  if (roomLeft >= size) {
    return { buffer, offset };
  }

  buffers[buffers.length - 1] = buffer.slice(0, buffer.length - roomLeft + 1);
  return addNewBuffer(buffers);
}

/**
 * Allocates a new buffer and adds it to the collection.
 * 
 * @param {Buffer[]} buffers 
 */
const addNewBuffer = (buffers) => {
  let buffer = Buffer.allocUnsafe(ALLOC_SIZE);
  buffers.push(buffer);
  return { buffer, offset: 0 };
};

module.exports = {
  validate,
  encode
};