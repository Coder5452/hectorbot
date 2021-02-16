// Program start message
console.clear();
console.log(`HectorBot discord music and general use bot!\n\n`)


// Import dependencies
const Discord = require('discord.js');
const fs = require('fs');

const slash = require('./slash/slashCMD.js');
const cmdLib = require('./commands.js');
const Queue = require('./queueClass.js').Queue;

var {
  autoLogin,
  prefix,
  token,
} = require('./config.json');
var MasterQueue = new Map();


// Create discord client
const client = new Discord.Client();
if (autoLogin) client.login(token);

// Discord event logging
client.on('ready', ()=>{
  console.log(`\nReady, logged in as ${client.user.tag}\n`);
  client.user.setPresence({game:{name:'music.',type:'playing'}});
});
client.on('error', (err)=>console.error(err));



/* Discord Command parsing */
// try to compact this down a bit with the same method on subcommands?
client.on('message', async inMessage => {
  // Command elimination
  if ( !inMessage.content.startsWith(prefix) ) return;
  else if ( !inMessage.guild ) return;
  else if ( inMessage.author.bot ) return;

  // Fetch serverQueue, create new one if unavailable
  var inServerQueue = await MasterQueue.get(inMessage.guild.id);
  if ( !inServerQueue ){
    inServerQueue = new Queue( inMessage.member.voice.channel, inMessage.channel );
    await inServerQueue.loadQueue();

    MasterQueue.set(inMessage.guild.id,inServerQueue);
  }

  // Check if the server has role specififc commands enabled
  let roles = inServerQueue.getRoles();
  if ( roles.length < 1 ) {
    const hasRole = (role) => inMessage.member.roles.cache.has(role);
    if ( roles.some(hasRole) ) {
      inMessage.channel.send('You do not have the DJ role.');
      return;
    }
  }

  // Parse the incoming command
  var inCMD = await parseMsg( inMessage.content, true );

  // Find correct command and do the stuff!
  try {
    cmdLib[inCMD[0]]( inMessage, inServerQueue, inCMD, client )
      .then(res=>{
        if(res!='')
          inMessage.channel.send(res)
            .then(msg=>msg.delete({timeout:60000,reason:"bot message clean up"}).catch(err=>{throw err;}))
            .catch(err=>{throw err;})
      })
      .catch(err=>{throw err;});
  }catch(err){
    if ( err instanceof TypeError )
      inMessage.channel.send(`Not a command: **${inCMD.join(' ')}**`);
    else
      console.error(err);
  }
  inMessage.delete({timeout:120000,reason:"bot message clean up"}).catch(err=>console.error(err));
});

/* Slash Command Parsing */
client.ws.on('INTERACTION_CREATE', async interaction => {
  slash.slashParse( client, interaction )
    .then(r=>slash.interReply(client,interaction,r))
    .then(e=>console.error(e));
});


/* Create UI i/o stream */
const readline = require('readline');
const cmdLine = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '',
  tabSize: 2,
  completer:
  (line)=>{
    const completions = 'autoLogin clear globalSay login shutdown'.split(' ');
    const hits = completions.filter((c)=>c.startsWith(line));
    return [hits.length ? hits : completions, line ];
  },
});

/* Command Parsing */
cmdLine.on('line', async (input)=>{
  // Parse args
  var inCMD = await parseMsg(input);

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
        var keys = Array.from( MasterQueue.keys() );

        // Send a message to all servers
        for ( var i = 0; i < keys.length; i++ )
          MasterQueue.get( keys[i] ).sendMessage(inCMD[1]);

        console.log(`Sent message: "${inCMD[1]}"\n`);
      }catch(err){console.error(err)}
      break;

    case 'clear':
      console.clear();
      console.log(`Console cleared.\n`)
      break;

    case 'shutdown':
      client.destroy();
      process.exit();
      break;

  }

  return;
});

// Autologin toggle
function toggleLogin () {
  autoLogin = !autoLogin;

  fs.writeFileSync( './config.json', JSON.stringify({autoLogin,prefix,token},null,'  ') );
  console.log(`Autologin set to: ${autoLogin}\n`);
  client.login(token);
}

// Parse message functions
function parseMsg( strIn, prune ) {
  return new Promise((resolve,reject)=>{
    prune = prune?true:false;
    // Seperate incoming commands by whitespace and add to an array
    var workArray = prune?
          strIn.substring(1,strIn.length).split(' '):
          strIn.split(' '),
        returnArray = [],
        iPos = -1;

    try {
      for ( var i = 0; i < workArray.length; i++ ) {
        // Check if current item starts with a quotation
        if ( workArray[i].startsWith('"') ) {
          iPos = i;

          // Find the next quotation mark or the end of the string
          for ( var r = i; r < workArray.length; r++ ){
            if ( workArray[r].endsWith('"') || r == workArray.length-1 ) {
              let outStr = workArray.slice( iPos, r+1 ).join(' ');

              // Trim quotation marks if necessary and add to the array
              returnArray.push(
                outStr.endsWith('"')?
                outStr.substring(1,outStr.length-1):
                outStr.substring(1,outStr.length)
              );

              // Set i pos and cancel r loop
              i = r;
              r = workArray.length;
            }
          }
        }
        else
          // Push argument into the return array
          returnArray.push( workArray[i] );
      }

      // Get rid of empty command arguments in case of double spaces
      returnArray.forEach((element,index)=>{
        if ( element == '' )
          returnArray.splice( index, 1 );
      });

      resolve(returnArray);
    }catch(err){reject(err)}
  });
}
