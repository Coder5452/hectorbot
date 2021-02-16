const fs = require('fs');

/* Exported functions */
// Command parser for slash commands
function slashParse( client, inter ) {
  return new Promise(async(resolve,reject)=>{
    switch (inter.data.name) {
      case 'ping':
        resolve('Pong!');
        break;
        
      case 'info':
        infoParse( inter.data.options[0] )
          .then(r=>resolve(r))
          .catch(e=>reject(e));
        break;
        
      case 'help':
        if ( !inter.data.options )
          resolve(await fs.readFileSync(`${__dirname}/help/help.txt`, 'utf8'));
        else
          helpParse( inter.data.options[0] )
            .then(r=>resolve(r))
            .catch(e=>reject(e));
        break;
        
      case 'devcmd':
        resolve(`\`\`\`JS\n${JSON.stringify(inter.data, null, ' ')}\`\`\``);
        break;
        
      default:
        resolve(`Sorry, but *${data.name}* is not yet implemented. ¯\_(ツ)_/¯`);
        break;
    };
  });
}

// Make replying to interactions easier
function interReply( client, inter, reply ) {
  return new Promise((resolve,reject)=>{
    client.api.interactions(inter.id, inter.token).callback.post({data: {
      type: 4,
      data: {
        content: reply
      }
    }});
  });
}

module.exports = {
  slashParse, interReply
}


/* Local Functions */
// Info command parser
function infoParse( data ) {
  return new Promise(async(resolve,reject)=>{
    switch (data.value) {
      case 'trello_page':
        resolve('The trello page for Hector is:\n<https://trello.com/b/W6evnL6s>');
        break;
        
      case 'invite_link':
        resolve('Invite link:\n<https://discord.com/oauth2/authorize?client_id=698973633577615432&permissions=8&scope=bot%20applications.commands>');
        break;
        
      default:
        resolve(`Sorry, but *${data.name}* is not yet implemented. ¯\_(ツ)_/¯`);
    }
  });
}

// Help command parser
function helpParse( data ) {
  return new Promise(async(resolve,reject)=>{
    console.log(data);
    switch (data.value) {
      case 'slash_help':
        resolve(fs.readFileSync(`${__dirname}/help/slash.txt`, 'utf8'));
        break;
        
      case 'dj_help':
        resolve(fs.readFileSync(`${__dirname}/help/dj.txt`, 'utf8'));
        break;
        
      case 'queue_help':
        resolve(fs.readFileSync(`${__dirname}/help/queue.txt`, 'utf8'));
        break;
        
      case 'role_help':
        resolve(fs.readFileSync(`${__dirname}/help/role.txt`, 'utf8'));
        break;
        
      default:
        resolve(`Sorry, but *${data.name}* is not yet implemented. ¯\_(ツ)_/¯`);
        break;
    }
  });
}