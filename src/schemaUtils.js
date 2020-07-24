/**
 * Parses a $ref entry in a schema.
 * @param {string} str 
 */
const typeFromRef = (str) => { 
  const refSplit = str.split('/');
  return refSplit[refSplit.length-1];
}

/**
 * Recursively searchs a schema for inherited properties.
 * @param {object} schema 
 * @param {object[]} definitions 
 */
const getAllProperties = (schema, definitions) => {
  const allOf = schema.allOf || [];
  let properties = schema.properties || {};

  for (const oneOf of allOf) {
    if (oneOf['$ref']) {
      const refType = typeFromRef(oneOf['$ref']);
      const definition = definitions[refType];
      properties = {
        ...properties,
        ...getAllProperties(definition, definitions)
      };
    }

    if (oneOf.properties) {
      properties = {
        ...properties,
        ...oneOf.properties
      };
    }
  }

  return properties;
}

/**
 * Extracts a type from a JSON schema.
 * @param {object} schema 
 */
const getSchemaType = (schema) => {
  let type = schema.type || 'object';

  if (schema.additionalProperties) {
    type = 'map';
  }

  if (Array.isArray(type)) {
    for (const t of type) {
      if (t !== "null" && t !== "undefined") {
        type = t;
        break;
      } 
    }
  }

  return type;
}

module.exports = {
  typeFromRef,
  getAllProperties,
  getSchemaType
}