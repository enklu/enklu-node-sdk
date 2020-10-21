# Enklu Multiplayer SDK for Node.Js

Every experience developed on [Enklu Cloud](cloud.enklu.com) is backed by a powerful mutliplayer service, Mycelium. The goal of this SDK is to provide external applications and devices with session-based access to experiences via Mycelium. With this SDK, you can send and receive messages to Enklu Cloud from your own servers, IoT devices, custom applications, and whatever else you can imagine.

## Installing

```
npm install @enklu/node-sdk
```

## Getting Started

An [Enklu Cloud](cloud.enklu.com) account is required to use this SDK. Once you have an account set up, you can generate a token for the authoring API.

```bash
curl -X POST 'https://cloud.enklu.com:10001/v1/email/signin' \
     -H 'Content-Type: application/json' \
     -d '{"email":"roland@druidia.com","password":"12345"}'
```

The `token` value received in a successful response can then be used to generate a multiplayer token. Each token is associated with a specific experience, so an experience Id is required as well. You can find the app id for an experience on the "My Experiences" modal or in the Inspector panel when the root element of an experience is selected in the [Enklu Cloud](cloud.enklu.com) web editor.

```bash
curl -X POST 'https://cloud.enklu.com:10001/v1/app/${your-app-id}/token' \
     -H 'Authorization: Bearer ${your-jwt-token}' \
     -H 'Content-Type: application/json' \
     -d '{}'
```

A successful respnse will contain a Json Web Token that can be used in the SDK. Now you can start sending messages.

```javascript
const {Mycelium} = require('@enklu/node-sdk');

const JWT = process.env.JWT;
const mycelium = new Mycelium();

let isLoggedIn = false;

mycelium.on('message', (msg) => {
  console.log(`received ${msg.event} event`);
  if (msg.event === 'LoginResponse') {
    isLoggedIn = true;
  }

  if (isLoggedIn) {
    mycelium.broadcast('ping', 'hello from the sdk');
  }
});

mycelium.on('connect', () => {
  console.log('connected to mycelium!');
  mycelium.login(JWT);
});

mycelium.connect();

```

The example above opens a connection to Mycelium, logs in using a previously generated multiplayer token (see [Getting Started](#getting-started)), and broadcasts the message `'hello from the sdk'` to all other clients connected to the multiplayer for the current experience. A more detailed example can be found in `src/example.js`.

# API Reference

## `connect([ip, port])`

Opens a TCP connection with the multiplayer server.

### Parameters

- `ip` (`string`): [Optional] The address of a Mycelium instance.
- `port` (`string`): [Optional] The port of a Mycelium instance.

## `login(jwt)`

Log in to the multiplayer server with a token provided by the authoring api. Note that this is a different token than is used to communicate _with_ the authoring API.

### Parameters

- `jwt` (`string`): An authentication token.

## `on(event, handler)`

Register a function for an event.

### Parameters

- `event` (`string`): The message type.
- `handler` (`function`) The handler that should receive events.

### Events

- `'message'`: Invoked when a Mycelium message is received.
- `'connect'`: Invoked when a TCP connection is established.
- `'error'`: Invoked when an error is encountered.
- `'close'`: Invoked when the TCP connection is closed.
- `'drain'`: Invoked when all data has been read from the socket.
- `(message-type)`: Invoked for specific message schema type, such as `'scenediffevent'`. For a complete list of message types, look at `src/schema/schemaMap.js`

## `off(event, handler)`

Remove a registration for an event.

### Parameters

- `event` (`string`): The message type.
- `handler` (`function`) The handler that should no longer receive events.

## `broadcast(type, [payload, memberId])`

Sends a notification to one member or all members of the room.

### Parameters

- `type` (`string`): User-defined message id.
- `payload` (`any`): [Optional] The data to send. If an object is passed, it will be encoded as a string. All recipients will receive it encoded as a string as well.
- `member` (`string`): [Optional] An optional id of a specific recipient. If not included, all members besides the sender will receive the message.

## `ping([pingId])`

Send a heartbeat to the server to keep the room alive.

### Parameters

- `pingId` (`integer`): [Optional] An optional ping id. If not provided, one is generated.

## `pingBack(pingId)`

Repond to a ping request. This is most commonly used to respond immedately to a PingRequest event from the server.

### Parameters

- `pingId` (`integer`): The id of a previous PingEvent.

## `sendMessage(msg)`

General purpose for sending messages to the multiplayer server. For a complete list of messages types, see the `JSON` schema files in `src/schema`.

### Parameters

- `msg` (`object`): The message to send.
- `msg.id` (`integer`): The message type id. Optional if `msg.event` is defined.
- `msg.event` (`string`): The message type name. Optional if `msg.id` is defined.
- `msg.payload` (`object`): The message data, which varies by message type.

## `close()`

Closes and destroys the connection to the multiplayer server.
