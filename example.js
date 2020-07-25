const {Mycelium} = require('./index');
const readline = require("readline");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const MYCELIUM_IP = process.env.MYCELIUM_IP;
const MYCELIUM_PORT = process.env.MYCELIUM_PORT;
const JWT = process.env.JWT;

const mycelium = new Mycelium();

let isLoggedIn = false;

const prompt = () => {
  rl.question('press enter to broadcast a notification.', (txt) => {
    mycelium.sendMessage({
      event: 'NotificationEvent',
      payload: {
        type: 'broadcast',
        memberId: '',
        payload: txt
      }
    });
    prompt();
  })
};

mycelium.on('message', (msg) => {
  console.log(`received ${msg.event} event`);
  console.log(JSON.stringify(msg, null, 2));
  if (msg.event === 'LoginResponse') {
    isLoggedIn = true;
  }

  if (isLoggedIn) {
    prompt();
  }
});

mycelium.on('error', (err) => {
  console.log(err);
});

mycelium.on('connect', () => {
  console.log('connected to mycelium!');
  mycelium.login(JWT);
});

mycelium.connect(MYCELIUM_PORT, MYCELIUM_IP);
