// Import dependencies
const Discord = require('discord.js');
const {
  prefix,
  token,
} = require('./config.json');
const lib = require('./functions.js');


// Login into discord api
const client = new Discord.Client();
client.login(token);



// Debug console flags
client.once('ready', () => {
  console.log('\nReady\n');
});

//client.on('debug', console.log);



/* Command parsing */
client.on('message', async inMessage => {
  // Elimination
  if ( !inMessage.content.startsWith(prefix) ) return;
  else if ( !inMessage.guild ) return;
  else if ( inMessage.author.bot ) return;
  // Add role specific command option here
  
  // Pull server queue from master, if it doesn't exists create a new one and load config
  var inServerQueue = await lib.queue.get(inMessage.guild.id);
  if ( !inServerQueue )
    await lib.loadQueue(inMessage, inServerQueue)
      .then(res=>inServerQueue=res)
      .catch(err=>inServerQueue=err);
  
  // Check if the server has role specififc commands enabled
  if ( inServerQueue.roles.length > 0 ) {
    const hasRole = (role) => inMessage.member.roles.cache.has(role);
    if ( !inServerQueue.roles.some(hasRole) ) {
      inMessage.channel.send('You do not have the DJ role.');
      return;
    }
  }
  
  // Parse the incoming command
  var inCmd = await lib.parseMsg( inMessage.content );
  
  switch ( inCmd[0] ) {  
    // Queue main
    case 'q':
    case 'queue':
      lib.queueMain(inMessage,inServerQueue,inCmd)
        .then(res=>inMessage.channel.send(res))
        .catch(err=>console.error(err));
      break;
      
    // DJ main
    case 'd':
    case 'dj':
      lib.dj(inMessage,inServerQueue,inCmd)
        .then(res=>inMessage.channel.send(res))
        .catch(err=>console.error(err));
      break;
      
    // Role main
    case 'r':
    case 'role':
    case 'roles':
      lib.roleMain(inMessage,inServerQueue,inCmd)
        .then(res=>inMessage.channel.send(res))
        .catch(err=>console.error(err));
      break;
      
    // Test main
    case 't':
    case 'test':
      lib.testMain(inMessage,inServerQueue,inCmd,client)
        .then(res=>inMessage.channel.send(res))
        .catch(err=>console.error(err));
      break;
      
    // Help command
    case 'h':
    case 'help':
      lib.help(inMessage)
        .then(res=>inMessage.author.dmChannel.send(res))
        .catch(err=>console.error(err));
      break;
      
      
      
    /* Misc. */
    // For josh
    case 'hw':
      lib.queryGel( inMessage, inCmd );
      break;
      
    // Purge command
    case 'purge':
      lib.custPurge( inMessage, inCmd )
        .then(result=>inMessage.channel.send(result))
        .catch(err=>console.error(err));
      break;
      
    // Trello command to allow easy access to dev page
    case 'trello':
      inMessage.channel.send('The trello page for Hector is <https://trello.com/b/W6evnL6s>');
      break;
      
    // Invite command to make things easier
    case 'invite':
      inMessage.channel.send('Invite link: https://discord.com/api/oauth2/authorize?client_id=698973633577615432&permissions=66583360&scope=bot');
      break;
      
      /* Invalid command */
    default:
      inMessage.channel.send('Invalid command.\nPlease use **.queue** or **.dj** to use the bot.\nIf you want to see the full command list use **.help**');
      break;
  }
});