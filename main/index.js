// Program start message
console.clear();
console.log('HectorBot discord music and general use bot!\n\n');

// Import dependencies
const Discord = require('discord.js');
const fs = require('fs');

const readline = require('readline');
const slash = require('./slash/slashCMD.js');
const cmdLib = require('./commands.js');
const { Queue } = require('./queueClass.js');

let {
  autoLogin,
  prefix,
  token,
} = require('./config.json');

const MasterQueue = new Map();

// Create discord client
const client = new Discord.Client();
if (autoLogin) client.login(token);

// Discord event logging
client.on('ready', () => {
  console.log(`\nReady, logged in as ${client.user.tag}\n`);
  client.user.setPresence({
    activity: {
      name: 'music.',
      type: 'playing',
    },
    status: 'online',
  });
});
client.on('error', (err) => console.error(err));

/* Discord Command parsing */
// try to compact this down a bit with the same method on subcommands?
client.on('message', async (inMessage) => {
  // Command elimination
  if (!inMessage.content.startsWith(prefix)) return;
  if (!inMessage.guild) return;
  if (inMessage.author.bot) return;

  // Fetch serverQueue, create new one if unavailable
  let inServerQueue = await MasterQueue.get(inMessage.guild.id);
  if (!inServerQueue) {
    inServerQueue = new Queue(
        inMessage.member.voice.channel,
        inMessage.channel,
    );
    await inServerQueue.loadQueue();

    MasterQueue.set(inMessage.guild.id, inServerQueue);
  }

  // Check if the server has role specififc commands enabled
  const roles = inServerQueue.getRoles();
  if (roles.length !== 0) {
    const hasRole = (role) => inMessage.member.roles.cache.has(role);
    if (!roles.some(hasRole)) {
      inMessage.channel.send('You do not have the DJ role.');
      return;
    }
  }

  // Parse the incoming command
  const inCMD = await parseMsg(inMessage.content, true);

  // Find correct command and do the stuff!
  try {
    cmdLib[inCMD[0]](inMessage, inServerQueue, inCMD, client)
        .then((res) => {
          if (res !== '') {
            inMessage.channel.send(res).catch((err) => {throw err;});
          }
        })
        .catch((err) => {
          throw err;
        });
  } catch (err) {
    if (err instanceof TypeError) {
      inMessage.channel.send(`Not a command: **${inCMD.join(' ')}**`);
    } else console.error(err);
  }
});

/* Slash Command Parsing */
client.ws.on('INTERACTION_CREATE', async (interaction) => {
  slash.slashParse(client, interaction)
      .then((r) => slash.interReply(client, interaction, r))
      .then((e) => console.error(e));
});

/* Create UI i/o stream */
const cmdLine = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '',
  tabSize: 2,
  completer:
  (line) => {
    const completions = 'autoLogin clear globalSay login shutdown'.split(' ');
    const hits = completions.filter((c) => c.startsWith(line));
    return [hits.length ? hits : completions, line];
  },
});

/* Command Parsing */
cmdLine.on('line', async (input) => {
  // Parse args
  const inCMD = await parseMsg(input);

  // Check command and run appropriate function
  switch (inCMD[0]) {
    case 'autoLogin':
      toggleLogin();
      break;

    case 'login':
      client.login(token);
      break;

    case 'globalSay':
      try {
        // Get all active servers
        const keys = Array.from(MasterQueue.keys());

        // Send a message to all servers
        for (let i = 0; i < keys.length; i++) {
          MasterQueue.get(keys[i]).sendMessage(inCMD[1]);
        }
        console.log(`Sent message: "${inCMD[1]}"\n`);
      } catch (err) {
        console.error(err);
      }
      break;

    case 'clear':
      console.clear();
      console.log('Console cleared.\n');
      break;

    case 'shutdown':
      client.destroy();
      process.exit();
      break;
  }
});

// Autologin toggle
function toggleLogin() {
  autoLogin = !autoLogin;

  fs.writeFileSync(
      './config.json',
      JSON.stringify({ autoLogin, prefix, token }, null, '  '),
  );
  console.log(`Autologin set to: ${autoLogin}\n`);
  client.login(token);
}

// Parse message functions
function parseMsg(strIn, prune) {
  return new Promise((resolve, reject) => {
    prune = !!prune;
    // Seperate incoming commands by whitespace and add to an array
    const workArray = prune ?
      strIn.substring(1, strIn.length).split(' ') :
      strIn.split(' ');
    const returnArray = [];
    let iPos = -1;

    try {
      for (let i = 0; i < workArray.length; i++) {
        // Check if current item starts with a quotation
        if (workArray[i].startsWith('"')) {
          iPos = i;

          // Find the next quotation mark or the end of the string
          for (let r = i; r < workArray.length; r++) {
            if (workArray[r].endsWith('"') || r === workArray.length - 1) {
              const outStr = workArray.slice(iPos, r + 1).join(' ');

              // Trim quotation marks if necessary and add to the array
              returnArray.push(
                outStr.endsWith('"') ?
                  outStr.substring(1, outStr.length - 1) :
                  outStr.substring(1, outStr.length),
              );

              // Set i pos and cancel r loop
              i = r;
              r = workArray.length;
            }
          }
        } else returnArray.push(workArray[i]);
      }

      // Get rid of empty command arguments in case of double spaces
      returnArray.forEach((element, index) => {
        if (element === '') {
          returnArray.splice(index, 1);
        }
      });

      resolve(returnArray);
    } catch (err) {
      reject(err);
    }
  });
}
