const net = require('net');
const {Mycelium} = require('./index');

const MYCELIUM_IP = process.env.MYCELIUM_IP;
const MYCELIUM_PORT = process.env.MYCELIUM_PORT;
const JWT = process.env.JWT;

const mycelium = new Mycelium();

mycelium.on('message', (msg) => {
  console.log(`received ${msg.event} event`);
  console.log(JSON.stringify(msg, null, 2));
});

mycelium.on('connect', () => {
  console.log('connected to mycelium!');
  mycelium.login(JWT);
});

mycelium.connect(MYCELIUM_PORT, MYCELIUM_IP);
