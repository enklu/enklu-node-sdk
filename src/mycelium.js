const { decode } = require('./decoder');
const { validate, encode } = require('./encoder');
const { schemaMap } = require('./schemas');
const net = require('net');

const MYCELIUM_IP = process.env.MYCELIUM_IP || 'cloud.enklu.com';
const MYCELIUM_PORT = process.env.MYCELIUM_PORT || '10103';
const EVENTS = ['MESSAGE', 'CONNECT', 'ERROR', 'CLOSE', 'DRAIN'];

/**
 * Facilitates encoding and decoding of events from a Mycelium multiplayer server.
 * @event message Invoked when a Mycelium message is received.
 * @event connect Invoked when a TCP connection is established.
 * @event error Invoked when an error is encountered.
 * @event close Invoked when the TCP connection is closed.
 * @event drain Invoked when all data has been read from the socket.
 * @event (message-type) Invoked for specific message schema type, such as `scenediffevent`
 */
class Mycelium {
  constructor() {
    this._listeners = {};
    this._buffers = [];
    this._client = new net.Socket();
    this._client.on('data', (data) => {
      this._ingestData(data);
    });
    this._client.on('error', (err) => this._emit('error', err));
    this._client.on('drain', () => this._emit('drain'));
    this._client.on('close', (isErr) => this._emit('close', isErr));
  }

  /**
   * Opens a TCP connection with the multiplayer server.
   * @param {string} ip 
   * @param {string} port 
   */
  connect(ip=MYCELIUM_IP, port=MYCELIUM_PORT) {
    this._client.connect(ip, port, () => {
      this._emit('connect');
    })
    return this;
  }

  /**
   * Closes the connection to the multiplayer server.
   */
  close()  {
    this._client.destroy();
    return this;
  }

  /**
   * Log in to the multiplayer server with a token provided by the authoring api. Note
   * that this is a different token than is used to communicate _with_ the authoring API.
   * @param {string} jwt 
   */
  login(jwt) {
    const event = 'LoginRequest'
    const id = schemaMap.eventToId[event];

    const msg = {
      id,
      event,
      payload: {
        jwt: jwt
      }
    };
    return this.sendMessage(msg);
  }

  /**
   * Sends a notification to a member or all members of the room.
   * @param {string} type Internal id of message type, defined by the user.
   * @param {any} [payload] The data to send. If it is an object, will be encoded as a string.
   * @param {string} [memberId] An optional id of a specific recipient. If not included, all members besides the sender will receive the message.
   */
  broadcast(type, payload='', memberId='') {
    const event = 'NotificationEvent';

    if (!type) {
      this._emitSendError(event, '"type" parameter is required.');
      return;
    }

    if (typeof payload !== 'string') {
      payload = JSON.stringify(payload);
    } 
    
    const id = schemaMap.eventToId[event];
    const msg = {
      event,
      id,
      payload: {
        type,
        memberId,
        payload
      }
    };
    this.sendMessage(msg);
  }

  /**
   * Send a heartbeat to the server to keep the room alive.
   * @param {number} [pingId] An optional ping id. If not provided, one is generated.
   */
  ping(pingId=0) {
    const event = 'PingRequest';
    const id = schemaMap.eventToId[event];
    const max = 255;
    
    if (!pingId) {
      // generate a random UInt8 1-255
      pingId = Math.ceil(Math.random() * max);
    } else {
      // ensure it'll fit in a byte.
      pingId = Math.min(pingId, max);
    }

    const msg = {
      event,
      id,
      payload: {
        pingId
      }
    };
    this.sendMessage(msg);
  }

  /**
   * Repond to a ping request. This is most commonly used to respond 
   * immedately to a PingRequest event from the server.
   * @param {number} pingId The id of a previous PingEvent.
   */
  pingBack(pingId) {
    const event = 'PingRequest';

    if (!pingId) {
      this._emitSendError(event, '"pingId" parameter is required.');
      return;
    }

    const id = schemaMap.eventToId[event];
    pingId = Math.min(pingId, 255);

    const msg = {
      event,
      id,
      payload: {
        pingId
      }
    };
    this.sendMessage(msg);
  }

  /**
   * Send a message to the multiplayer server.
   * @param {object} msg 
   * @param {number} msg.id
   * @param {string} msg.event
   * @param {object} msg.payload
   */
  sendMessage(msg) {
    // validate
    if (!validate(msg)) {
      this._emit('error', new Error('Invalid message'));
      return this;
    }

    // encode
    let encoded;
    try {
      encoded = encode(msg);
    } catch (err) {
      this._emit('error', err);
      return this;
    }

    if (!encoded) {
      this._emit('error', new Error('Unable to encode message'))
      return this;
    }
    
    try {
      this._client.write(encoded);
    } catch (err) {
      this._emit('error', err);
    }

    return this;
  }

  /**
   * Register a function for an event.
   * @param {string} event 
   * @param {function} handler 
   */
  on(event, handler) {
    const upper = event.toUpperCase();
    if (EVENTS.indexOf(upper) < 0 || !handler) {
      return;
    }

    if (!this._listeners[upper]) {
      this._listeners[upper] = [];
    }

    this._listeners[upper].push(handler);
    return this;
  }

  /**
   * Remove a registration for an event
   * @param {string} event 
   * @param {function} handler 
   */
  off(event, handler) {
    const handlers = this._listeners[event.toUpperCase()] || [];
    for (const i in handlers) {
      if (handlers[i] === handler) {
        handlers.splice(i, 1);
        break;
      }
    }
    return this;
  }

  /**
   * Emits an error message to the client.
   * @param {string} event The event type the error pertains to.
   * @param {string} message An informative message.
   */
  _emitSendError(event, message) {
    const err = `Error sending ${event}: ${message}`;
    this._emit('error', new Error(err));
  }

  /**
   * Queue up data for processing
   * @param {Buffer} buffer 
   */
  _ingestData(buffer) {
    this._buffers.push(buffer);
    
    try {
      this._processBuffers();
    } catch (err) {
      this._emit('error', err);
    }
  }

  /**
   * Inspect buffers and decode any messages
   */
  _processBuffers() {
    // check if we have a full message
    const len = this._buffers[0].readUInt16BE() + 2;
    const available = this._buffers.map((b) => b.length).reduce((a,b) => a + b);

    // if not, wait
    if (available < len) {
      return;
    }

    // get the data for the current message
    let data = Buffer.concat(this._buffers, len);
    let used = 0;

    // make sure we keep the remaining data
    while(used < data.length && this._buffers.length) {
      const left = len - used;
      if (this._buffers[0].length <= left) {
        const shifted = this._buffers.shift();
        used += shifted.length;
      } else {
        this._buffers[0] = this._buffers[0].slice(left);
        used += left;
      }
    }

    let decoded = decode(data);

    if (!decoded) {
      this._emit('error', new Error('Failed to decode message'));
      return;
    }

    this._emit('message', decoded);
    this._emit(decoded.event.toUpperCase(), decoded);

    // there may be another message queued up
    if (this._buffers.length) {
      this._processBuffers()
    }
  }

  /**
   * Fire off an event
   * @param {string} event 
   * @param  {...any} args 
   */
  _emit(event, ...args) {
    const handlers = this._listeners[event.toUpperCase()] || [];
    for (const handler of handlers) {
      handler(...args);
    }
  }
};

module.exports = {
  MYCELIUM_IP,
  MYCELIUM_PORT,
  Mycelium
};
