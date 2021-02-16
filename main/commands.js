// Import dependencies
const ytsr = require('ytsr');
const ytpl = require('ytpl');
const eventEmitter = require('events');
const djEvent = new eventEmitter();

/* Command parser */
function queue( message, serverQueue, inCMD, client ) {
  return new Promise((resolve,reject)=>{
    // Decline if user is not in a VC
    if ( !message.member.voice.channel )
      resolve('You must be in a voice channel to use this command.');
    else {
      switch ( inCMD[1] ) {
        case 'list':
          list( message, serverQueue )
            .then(res=>resolve(res))
            .catch(err=>reject(err));
          break;

        case 'shuffle':
          return resolve(serverQueue.shuffleQueue());
          break;

        case 'move': {
          if ( !inCMD[2] || !inCMD[3] )
            return resolve('Usage: .queue move <song position> <new position>');

          let song = serverQueue.moveSong( inCMD[2]-1, inCMD[3]-1 );
          return resolve(`Moved **${song.title}** to position **${song.newPos}**.`)
        } break;

        case 'remove': {
          if ( !inCMD[2] )
            return resolve('Usage: .queue remove <song position>');

          let song = serverQueue.removeSong( inCMD[2]-1 );
          return resolve(`**${song.title}** removed from the queue.`);
        } break;

        case 'clear':
          serverQueue.clearQueue();
          return resolve(`Queue cleared.`);
          break;

        default:
          return resolve(`Not a command: **${inCMD.join(' ')}**`);
          break;
      }
    }
  });
}

function dj( message, serverQueue, inCMD, client ) {
  return new Promise(async(resolve,reject)=>{
    if ( !message.member.voice.channel )
      resolve('You must be in a voice channel to use this command.');
    else
      switch ( inCMD[1] ) {
        case 'add':
          add( message, serverQueue, inCMD, djEvent )
            .then(res=>{return resolve(res)})
            .catch(err=>{return reject(err)});
          break;

        case 'skip':
          if ( !serverQueue.playing )
            return resolve('No music playing');

          djEvent.emit('skip', message);
          return;
          break;

        case 'stop':
          return resolve(serverQueue.stopAudio());
          break;

        case 'pause':
          return resolve(serverQueue.pauseAudio());
          break;

        case 'resume':
          return resolve(serverQueue.resumeAudio());
          break;

        case 'play':
          play( message, serverQueue, djEvent )
            .then(res=>{return resolve(res)})
            .catch(err=>{return reject(err)});
          break;

        case 'info':
          if ( !serverQueue.playing )
            return resolve('No music playing');

          djEvent.emit('info', message);
          return resolve('Fetching song information.');

          break;

        case 'suggest':
          if ( !serverQueue.playing )
            return resolve('No music playing');

          djEvent.emit('suggestion', message);
          return resolve('Fetching suggestions.');
          break;

        case 'volume':
          if ( !inCMD[2] )
            return resolve('Usage: .dj vol <volume>')

          return resolve(serverQueue.setVolume(inCMD[2]/100,message.guild.id));
          break;

        default:
          return resolve(`Not a command: **${inCMD.join(' ')}**`);
          break;
      }
  });
}

function role( message, serverQueue, inCMD, client ) {
  return new Promise(async(resolve,reject)=>{
    switch (inCMD[1]) {
      case 'add': {
        return resolve(serverQueue.addRole(inCMD[2].slice(3,-1)));
      }
        break;

      case 'remove': {
        return resolve(serverQueue.removeRole(inCMD[2]-1));
      }
        break;

      case 'list':
        try {
          let roleList = serverQueue.listRoles();

          if ( roleList == -1 )
            return resolve(`${message.guild.name} has no roles`);

          return resolve({embed:{
            color: 0x54c0f0,
            title: `${message.guild.name} role list.`,
            description: roleList
          }});
        }catch(err){return reject(err)}
        break;

      default:
        return resolve(`Not a command:\n**${inCMD.join(' ')}**`);
        break;
    }
  });
}

function test( message, serverQueue, inCMD, client ) {
  return new Promise(async(resolve,reject)=>{
    if ( message != null && message.author.id != 122902985314533379 )
      reject('Test commands are only available to owner');
    else {
      try {
        switch( inCMD[1] ) {
          case 'cmdTest':
            console.log('Test command recieved.');
            return resolve(`Command system validated.${inCMD.length>2?`\n${inCMD[2]}`:''}`);
            break;

          case 'shutdown':
            client.destroy();
            process.exit();
            break;

          case 'print':
            console.log(serverQueue);
            return resolve('Done.');
            break;

          case 'scan':
            console.log(await serverQueue.scanDir(inCMD[2]));
            break;

          default:
            return resolve(`Not a command: **${inCMD.join(' ')}**`);
            break;
        }
      }catch(err){reject(err)}
    }
  });
}

function mod( message, serverQueue, inCMD, client ) {
	return new Promise(async(resolve,reject)=>{
		switch (inCMD[1]) {
			case 'prune':
        if ( inCMD[2] = '' || typeof inCMD[2] === 'number' || inCMD[2] > 100 )
          resolve('Third argument necessary and must be a number equal or less than 100.');
        else
          message.channel.bulkDelete(100, true)
            .then(msgs=>resolve(`Deleted ${msgs.size} messages.`))
            .catch(err=>reject(err));
				break;

      case 'clearChannel':
        var channel = message.channel;
        channel.clone();
        channel.delete();

			default:
				return resolve(`Not a command: **${inCMD.join(' ')}**`);
		}
	});
}

// Export file functions
module.exports = {
  queue, dj, role, test, mod,
  sleep
};


/* LOCAL FUNCTION */
// List queue
function list( message, serverQueue ) {
  return new Promise(async(resolve,reject)=>{
    // Check if the queue is empty or doesn't exist
    if ( !serverQueue || serverQueue.songs.length == 0 )
      return resolve('There are no songs in the queue');

    // Get the page numbers
    var currPage = 1;
    var numPages = Math.ceil(serverQueue.songs.length/10);

    // Draw initial queue and create reaction collector to cycle pages
    message.channel.send(await drawQueue(serverQueue,message,currPage))
      .then(async(msg)=>{
        // React with emoji controls
        await msg.react('◀️').catch(err=>{throw err;});
        await msg.react('▶️').catch(err=>{throw err;});

        // Create reaction collector to detect reactions
        const filter = (r,u)=>r.emoji.name==='◀️'||r.emoji.name==='▶️'&&u!=msg.author;
        const contols = await msg.createReactionCollector( filter, {time:60000} );

        // Check for reactions and edit queue embed appropriately
        contols.on('collect', async(r,u)=>{
          numPages = Math.ceil(serverQueue.songs.length/10);

          // Indrement/decrement depending on reaction
          currPage = await r.emoji.name=='▶️'?currPage++:currPage--;

          // Edit queue page if the page number doesn't exist outside of pages range
          if ( currPage > numPages )
            currPage = numPages;
          if ( currPage < 1 )
            currPage = 1;

          // Edit message
          msg.edit(await drawQueue(serverQueue,message,currPage))
            .catch(err=>{throw err;});

          // Remove any added reactions to make cycling easier
          r.users.remove(await  u);
        });

        // Send a message when the collector stops
        contols.on('end', ()=>{
          resolve('Please use *.queue list* again if you want to see use queue');
        });
    }).catch(err=>reject(err));


  });
}

// DrawQueue function to avoid clogging main file
function drawQueue( serverQueue, message, pageNum ) {
  let queueContent = serverQueue.queuePages(),
      output = '';

  queueContent[pageNum-1].forEach((element,index)=>{
    output += `\n\`${`${index+1}.`.padEnd(3)}\`\t${element.title}`;
  });

  // Create embed and pass it
  return {embed: {
    color: 0x54c0f0,
    title: `${message.guild.name} song queue.`,
    description: output,
    footer: { text: `Page ${pageNum}/${queueContent.length}` }
  }};
}

// Play audio in queue
function play( message, serverQueue, djEvent ) {
  return new Promise(async(resolve,reject) => {
    try {
      // Check if there are songs in the queue
      if ( serverQueue.songs.length < 1 )
        return resolve('No songs in the queue');

      // See if user is in a VC
      const vc = message.member.voice.channel;
      if ( !vc )
        return resolve( 'You must be in a voice channel to play music' );
      else
        serverQueue.voiceChannel = vc;

      // Check if perms are met
      const perms = vc.permissionsFor( message.client.user );
      if ( !perms.has('CONNECT') || !perms.has('SPEAK') )
        return resolve("Bot doesn't have necessary perms to join the voice channel.");
      else if ( !serverQueue.songs[0] )
        return resolve( 'No songs in queue' );


      // Set up loop for queued songs
      serverQueue.playing = true;
      while ( serverQueue.songs.length > 0 ) {
        await serverQueue.playAudio( message, djEvent )
          .then(res=>message.channel.send(res))
          .catch(err=>{throw err;});
      }

      serverQueue.stopAudio();
      return resolve('No song left in queue.');
    }catch(err){return reject(err);}
  });
}

// Add song to queue
function add( message, serverQueue, inCMD, djEvent ) {
  return new Promise(async(resolve,reject)=>{
    try {
      let args = inCMD;
      if ( args.length < 3 )
        return resolve('Need something to search for');

      // Remove extra arguments and create a return var
      args.splice(0,2);
      var toAdd = [];

      // Resolve a youtube link (or playlist) for every arguemtn
      for ( const element of args ) {
        if ( element.indexOf('list=') != -1 )
          await ytSearchPl( element )
            .then(res=>toAdd=toAdd.concat(res))
            .catch(err=>{throw err;});
        else
          await ytSearch( element )
            .then(res=>{toAdd.push(res)})
            .catch(err=>{throw err;});
      }

      // Queue songs
      await serverQueue.queueSongs( toAdd );

      // Return confirmation message
      let output = '';
      toAdd.forEach((element)=>output += `\n**${element.title}** added to the queue.`);
      message.channel.send(output);

      // Start playing songs
      if ( !serverQueue.playing )
        play( message, serverQueue, djEvent )
          .then(res=>{return resolve(res)})
          .catch(err=>{throw err;});
    }catch(err){return reject(err)}
  });
}

// Search youtube
function ytSearch( srchStr ) {
  return new Promise(async(resolve,reject)=>{
    try {
      const srch = await ytsr.getFilters(srchStr);
      const filter = await srch.get('Type').get('Video');
      const video = await ytsr( filter.url, { limit: 1} );

      return resolve({
        title: video.items[0].title,
        url: video.items[0].url,
        type: 0,
      });
    }catch(err){return reject(err)}
  });
}

// Search youtube playlist
function ytSearchPl( playlistURL ) {
  return new Promise((resolve,reject)=>{
    try {
      // Create return array
      var playlist = [];

      //return resolve video metadata from a playlist's url
      ytpl( playlistURL )
        .then(res=>{
          res.items.forEach(video=>{
            playlist.push({
              title: video.title,
              url: video.shortUrl,
              type: 0
            });
          });
         return resolve( playlist );
        })
        .catch(err=>{throw err;});
    }catch(err){return reject(err)}
  });
}

// Wait function for rate limiting
function sleep( milliseconds ) {
  return new Promise((resolve,reject)=>{
    setTimeout(resolve, milliseconds);
  });
}
