const { schemas, schemaMap } = require('./schemas');
const { 
  typeFromRef,
  getAllProperties,
  getSchemaType 
} = require('./schemaUtils');

/**
 * Decodes a buffer containg a Mycelium event.
 * @param {Buffer} data The raw Mycelium event buffer.
 */
const decode = (data) => {
  if (!data || data.length < 3) {
    console.error('Invalid message data');
    return null;
  }

  const len = data.readUInt16BE();
  const id = data.readUInt16BE(2);
  data = data.slice(4);
  
  const event = schemaMap.idToEvent[id];
  const schema = schemas[event];
  
  const decoded = decodePayload(schema, data, schema.definitions || []);

  return {
    id,
    event,
    payload: decoded.payload,
  }
};

/**
 * Decodes the next object in a Mycelium event.
 * @param {object} schema The JSON schema for the message type.
 * @param {Buffer} data The Mycelium message buffer.
 * @param {Array<object>} definitions The definitions from the root of the schema.
 */
const decodePayload = (schema, data, definitions) => {
  const properties = getAllProperties(schema, definitions) || {};

  let decoded = { data, payload: null };
  const type = getSchemaType(schema);

  if (!type) {
    return decoded;
  }

  switch (type) {
    case "integer": {
      if (schema.format === 'int32') {
        decoded.payload = decoded.data.readInt32BE();
        decoded.data = decoded.data.slice(4);
      } else {
        decoded.payload = decoded.data.readInt16BE();
        decoded.data = decoded.data.slice(2);
      }
      return decoded;
    }
    case "number": {
      decoded.payload = decoded.data.readFloatBE();
      decoded.data = decoded.data.slice(4);
      return decoded;
    }
    case "boolean": {
      decoded.payload = decoded.data.readUInt8();
      decoded.data = decoded.data.slice(1);
      return decoded;
    }
    case "string": {
      const len = data.readUInt16BE();
      const end = len + 2;
      decoded.payload = decoded.data.toString('ascii', 2, end);
      decoded.data = decoded.data.slice(end);
      return decoded;
    }
    case "array":
      const items = schema.items || {};
      const arrRef = items['$ref'] || '';
      const refType = typeFromRef(arrRef);
      const definition = definitions[refType];
      decoded.payload = [];
      
      const len = decoded.data.readUInt16BE();
      decoded.data = decoded.data.slice(2);

      for (let i = 0; i < len; i++) {
        const item = decodePayload(definition, decoded.data, definitions);
        decoded.data = item.data;
        decoded.payload.push(item.payload);
      }

      return decoded;
    case "object": {
      const keys = Object.keys(properties).sort();
      decoded.payload = {};

      const alloc = decoded.data.readUInt8();
      decoded.data = decoded.data.slice(1);

      if (!alloc) {
        return decoded;
      }

      for (const key of keys) {
        const property = properties[key] || {};
        const oneOf = property.oneOf;
        let item = {};
        if (oneOf && oneOf[oneOf.length-1]) {
          const ref = oneOf[oneOf.length-1]['$ref'] || '';
          const refType = typeFromRef(ref);
          const definition = definitions[refType];
          item = decodePayload(definition, decoded.data, definitions);
        } else {
          item = decodePayload(property, decoded.data, definitions);
        }
        decoded.data = item.data;
        decoded.payload[key] = item.payload;
      }

      return decoded;
    }
    case 'map': {
      const len = decoded.data.readUInt16BE();
      decoded.data = decoded.data.slice(2);
      decoded.payload = {};
      
      const additionalProperties = schema.additionalProperties;
      const mapProps = getAllProperties(additionalProperties, definitions);

      for (let i = 0; i < len; i++) {
        // first get key
        const keyItem = decodePayload({ type:'string' }, decoded.data, definitions);
        const key = keyItem.payload;
        decoded.data = keyItem.data;

        // and then the value
        const valItem = decodePayload(mapProps, decoded.data, definitions);
        decoded.data = valItem.data;
        decoded.payload[key] = valItem.payload;
      }

      return decoded;
    }
  }
  return decoded;
}

module.exports = {
  decode
};
