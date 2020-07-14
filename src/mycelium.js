const { schemas, schemaMap } = require('./schemas')

const decode = (data) => {
  const len = data.readUInt16BE();
  const id = data.readUInt16BE(2);
  const alloc = data.readUInt8(4);
  
  const event = schemaMap.idToEvent[id];
  const schema = schemas[event];

  console.log(`received ${event} event`);
  //console.log(JSON.stringify(schema, null, 2));
  const payload = decodePayload(schema, data, 5)
  return {
    id,
    event,
    payload,
  }
};

const decodePayload = (schema, data, index) => {
  const additionalProperties = schema.additionalProperties || {};
  const properties = schema.properties || {};
  const definitions = schema.definitions || {};
  const format = schema.format || '';

  let type = schema.type;
  let decoded = {};
  let ref = null;

  if (Array.isArray(type)) {
    for (t of type) {
      if (t !== "null" && t !== "undefined") {
        type = t;
        break;
      } 
    }
  }

  if (!type) {
    return null;
  }

  switch (type) {
    case "integer": {
      
      break;
    }
    case "number":
      break;
    case "boolean": {
      
      break;
    }
    case "string":
      break;
    case "array":
      return [];
      break;
    case "object": {
      const keys = Object.keys(properties);
      keys.sort();

      for (key of keys) {
        const property = properties[key] || {};
        const oneOf = property.oneOf;
        if (oneOf && oneOf[oneOf.lenght-1]) {
          const ref = oneOf[oneOf.length-1]['$ref'] || '';
          const refSplit = ref.split('/');
          const refType = refSplit[refSplit.length-1];
          const definition = definitions[refType];
          decoded[key] = decodePayload(definition, data, index);
        } else {
          decoded[key] = decodePayload(property, data, index);
        }
      }

      break;
    }
  }
  return decoded;
}

module.exports = {
  decode
};
