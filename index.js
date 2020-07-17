const mycelium = require('./src/mycelium');

const MYCELIUM_IP = process.env.MYCELIUM_IP;
const MYCELIUM_PORT = process.env.MYCELIUM_PORT;
const JWT = process.env.JWT;

const LOGIN_MSG = 17797;
const ALLOC = 1;

const LOGIN_ARR = [
  Buffer.from(new Uint8Array([LOGIN_MSG >> 8, LOGIN_MSG, ALLOC, JWT.length >> 8, JWT.length])),
  Buffer.from(JWT, 'ascii')
];

const LOGIN_BYTES = Buffer.concat(LOGIN_ARR);

const sendMessage = (msg, data) => {
  setTimeout(() => {
    try {
      const len = data.length;
      console.log(`Sending ${msg} message of length ${len} bytes`);
      const lenArr = new Uint8Array([len >> 8, len]);
      const output = Buffer.concat([Buffer.from(lenArr), data]);
      const success = client.write(output);
      if (!success) {
        console.error(`Error sending ${msg} message`);
      }
    } catch (e) {
      console.error(e)
    }
  }, 2000)
};


const client = new net.Socket();
client.connect(MYCELIUM_PORT, MYCELIUM_IP, () => {
  console.log('connected to mycelium');
  sendMessage('login', LOGIN_BYTES)
});

client.on('data', (data) => {
  try {
    event = mycelium.decode(data);
    console.log(JSON.stringify(event, null, 2));
  } catch(e) {
    console.error(e);
  }
});

client.on('close', () => {
  console.log('connection to mycelium closed');
});

client.on('error', (err) => {
  console.error(err);
});

module.exports = {
  ...mycelium
};
