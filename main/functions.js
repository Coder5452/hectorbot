// Necessary variables
const queue = new Map();
const {
  prefix,
  token,
} = require('./config.json');

// Import dependencies
const fs = require('fs');
const ytdl = require('ytdl-core');
const ytsr = require('youtube-sr');
const ytpl = require('ytpl');
const fetch = require('node-fetch');
const path = require('path');
const mm = require('music-metadata');


// Parse message functions
function parseMsg( strIn ) {
  var wrkStr = strIn;
  var strArray = new Array();
  var b = 0;
  
  for ( var i = 0; i < wrkStr.length; i++ ) {
    // Parse quoted sections as a single arg
    if ( wrkStr.charAt(i) === '"' ) {
      b = i;
      
      if ( wrkStr.indexOf( '"', i+1 ) != -1 ) {
        i = wrkStr.indexOf( '"', i+1 );
        strArray.push(wrkStr.substring(b+1, i));
        b = i;
        i++;
      } else {
        strArray.push( wrkStr.substring( b+1, wrkStr.length ) );
        break;
      }
    }
    
    // Parse command args by spaces
    else if ( i == wrkStr.length-1 ) {
      strArray.push(wrkStr.substring(b+1, i+1));
      break;
    }
    else if ( wrkStr.charAt(i) === ' ' ) {
      strArray.push(wrkStr.substring(b+1, i));
    
      b = i;
    }
  }
  
  // Basic logging and return
  console.log( '\n' );
  console.log( strArray );
  return strArray;
}

/* Queuing functions */
// Main queuing function
async function queueMain ( message, serverQueue, args ) {
  return new Promise(async(resolve,reject)=>{
    // Second arguments parsing
    switch ( args[1] ) {
      // Check for missing args
      case undefined:
        resolve('Usage: .queue <list/remove/clear/save>');
        break;
        
      // List current song queue
      case 'list':
        listQueue(message,serverQueue).then(res=>resolve(res)).catch(err=>resolve(err));
        break;
        
      // Remove song from queue
      case 'remove':
        queueRemove(message,serverQueue,args).then(res=>resolve(res)).catch(err=>resolve(err));
        break;
        
      case 'clear':
        clearQueue(message,serverQueue).then(res=>resolve(res)).catch(err=>resolve(err));
        break;
        
      case 'save':
        saveQueue(message,serverQueue).then(res=>resolve(res)).catch(err=>reject(err));
        break;
        
      default:      
        resolve('Invalid command.');
        break;
    }
  });
}

// List queue
function listQueue( message, serverQueue ) {
  return new Promise( (resolve, reject ) => {
    // Check if the queue is empty or doesn't exist
    if ( !serverQueue || serverQueue.songs.length == 0 ) {
      reject('There are no songs in the queue');
    }
    // List all songs in queue and log it in the console.
    else {
      let output = '';
      for ( var i = 0; i < serverQueue.songs.length; i++ ) {
        output += '\n' + ('`' + (i+1) + '.` **' + serverQueue.songs[i].title + '**    ||<' + serverQueue.songs[i].url + '>||');
      }
      resolve( output );
    }
  });
}

// create queue
function createQueue( message ) {
  // Create a queue for a local server
  let local = {
    textChannel: message.channel,
    voiceChannel: message.member.voice.channel,
    connection: null,
    dispatcher: null,
    songs: [],
    roles: [],
    volume: .1,
    playing: false,
  };
  
  return local;
}

// remove song from queue
function queueRemove( message, serverQueue, args ) {
  return new Promise((resolve,reject)=>{
    // If no song specified reject
    if(args.length<3) reject('Please specify which song to remove.');
    else if ( serverQueue.songs.length < 1 ) reject('No songs in the queue');
    else {
      try {
        // Remove song and resolve
        let num = args[2]-1;
        let name = serverQueue.songs[num].title;
        serverQueue.songs.splice( num, 1 );
        queue.set( message.guild.id, serverQueue );
        
        resolve('**'+name+'** was removed from the queue from position '+(num+1));
      }catch(err){reject(err);}
    }
  });
}

// clear queue
function clearQueue( message, serverQueue ) {
  return new Promise((resolve,reject)=>{
    try {
      serverQueue.songs = [];
      queue.set(message.guild.id, serverQueue);
      resolve('Queue cleared.');
    }catch(err){reject(err);}
  });
}



/* DJ Functions */
// DJ Main
function dj( message, serverQueue, args ) {
  return new Promise(async(resolve,reject)=>{
    switch (args[1]) {
      case 'add':
        search(message,serverQueue,args)
          .then(res=>resolve(res))
          .catch(err=>reject(err));
        break;
        
      case 'play':
        play(message,serverQueue,args)
          .then(res=>queue.set(message.guild.id,res))
          .catch(err=>resolve(err));
        break;
        
      case 'stop':
        stop( serverQueue )
          .then(res=>resolve(res))
          .catch(err=>reject(err));
        break;
        
      case 'skip':
        skip(message,serverQueue)
          .then(res=>resolve(res))
          .catch(err=>reject(err));
        break;
        
      case 'vol':
      case 'volume':
        volume(message,serverQueue,args)
          .then(res=>resolve(res))
          .catch(err=>reject(err));
        break;
        
      default:
        resolve('Usage: .dj <add/play/stop/skip/volume>');
        break;
    }
  });
}

// put song into queue
function queueSong( message, serverQueue, inSongs ) {
  return new Promise( async (resolve, reject ) => {
    var outputTxt = '';
    try {
      // Add all of the songs from inSongs 
      for( let i = 0; i < inSongs.length; i++ ) {
        serverQueue.songs.push( inSongs[i] )
        outputTxt += 'Added **'+inSongs[i].title+'** to the queue.\n';
      }
      // Resolve the new queue
      queue.set( message.guild.id, serverQueue );
      resolve( outputTxt );
    }catch (err) {reject(err);}
  });
}

// Search command
function search( message, serverQueue, args ) {
  return new Promise(async(resolve, reject) => {
    var addSongs = [];
    if ( args.length < 2 ) reject('Need something to search for');
    else if ( args[2].indexOf('&list=') != -1 ) {
      // Search songs through youtube
      for ( let i = 2; i < args.length; i++ ) {
        await ytSearchPl(args[i])
          .then(res=>addSongs = addSongs.concat(res))
          .catch(err=>{reject(err);return;});
      }
    }
    else {
      // Search songs through youtube
      for ( let i = 2; i < args.length; i++ ) {
        await ytSearch(args[i])
          .then(res=>addSongs.push(res))
          .catch(err=>reject(err));
      }
    }
    // Queue the new songs
    queueSong(message,serverQueue,addSongs)
      .then(res=>{
        if (!serverQueue.playing)
          play(message,serverQueue).catch(err1=>{reject(err1);return;});
        resolve(res);
        })
      .catch(err=>reject(err));
  });
}

// Search youtube
function ytSearch( srchStr ) {
  return new Promise( async (resolve, reject) => {
    try {
      let srch;
      // Search youtube for provided string
      await ytsr.search( srchStr, { limit: 1 } )
        .then(vid=>srch=vid[0])
        .catch(err=>{reject(err);return;});
      
      resolve({
        title: srch.title,
        url: "http://www.youtube.com/watch?v=" + srch.id,
        type: 0,
      });
    }catch(err){reject(err)}
  });
}

// Test
function ytSearchPl(srchStr) {
  return new Promise(async(resolve,reject)=>{
    try {
      let playlist;
      await ytpl(srchStr)
        .then(plls=>playlist=plls.items)
        .catch(err=>{reject(err);return;});
      
      let returnPlaylist = [];
      for ( let i = 0; i < playlist.length; i++ ) {
        returnPlaylist[i] = {
          title: playlist[i].title,
          url: playlist[i].url_simple,
          type: 0,
        }
      }
      resolve(returnPlaylist);
    }catch(err){reject(err);}
  })
}

// Return song object when provided absolute path
function getMeta( args ) {
  return new Promise((resolve,reject)=>{
    mm.parseFile( args[1] )
    .then(d=>resolve( { name: d.common.artist, url: args[1], type: 1 } ))
    .catch(err=>reject(err));
  });
}

// Play function
function play( message, serverQueue ) {  
  return new Promise( async (resolve, reject) => {
    // Set current song
    const song = serverQueue.songs[0];
    
    // See if user is in a VC
    const vc = message.member.voice.channel;
    if ( !vc ) {resolve( 'You must be in a voice channel to play music' ); return;}
    // Set vars
    const perms = vc.permissionsFor( message.client.user );
    // Check if conditions are met
    if ( !perms.has('CONNECT') || !perms.has('SPEAK') ) {resolve("Bot doesn't have necessary perms to join the voice channel."); return;}
    else if ( !serverQueue.songs[0] ) {resolve( 'No songs in queue' ); return;}
    
    if ( song.type == 0 ) {
      // Attempt to connect to youtube and play the song
      try {
        serverQueue.playing = true;
        serverQueue.connection = await serverQueue.voiceChannel.join();
        serverQueue.dispatcher = serverQueue.connection
          .play( await ytdl(song.url, {highwatermark: 1<<25, quality: 'highestaudio'}) )
          .on('finish', () => {
            serverQueue.songs.shift();
            saveQueue( message, serverQueue ).catch( err => console.error(err));
            if ( serverQueue.songs.length < 1 )
              stop(serverQueue).catch(err=>console.error(err));
            else if ( serverQueue.playing )
              play(message, serverQueue).catch(error=>console.error(error));
          })
          .on('error', error=>{reject(error); return;});
        serverQueue.dispatcher.setVolume( serverQueue.volume );
        serverQueue.dispatcher.on('start', ()=>message.channel.send('Started playing: **' + song.title + '**\n<' + song.url + '>'));
        serverQueue.dispatcher.on('error', (err)=>console.error(err));
        resolve(serverQueue);
      }catch(err){reject(err);}
    }else {
      resolve('Not supporting local files yet.');
    }
  });
}

// Stop function
function stop( serverQueue ) {
  return new Promise((resolve, reject)=>{
    try {
      if (serverQueue.playing) {
        serverQueue.playing = false;
        serverQueue.songs = [];
        serverQueue.dispatcher.end();
        serverQueue.voiceChannel.leave();
        resolve('Music stopped');
      }else resolve('No music playing');
    }catch (err) {reject(err);}
  });
}

// Skip function
function skip( message, serverQueue ) {
  return new Promise((resolve,reject)=>{
    if ( serverQueue.songs.length < 2 ) {
      stop( serverQueue );
      resolve('No songs left in queue');
    } else {
      serverQueue.songs.shift();
      saveQueue(message, serverQueue).catch(err=>{reject(err);return;});
      play(message, serverQueue).catch(err=>console.error(err));
      
      resolve('Skipped song.');
    }
  });
}

// Volume command
function volume( message, serverQueue, args ) {
  return new Promise((resolve,reject)=>{
    if ( !args[2] ) resolve('Usage: .dj vol <Volume Number>')
    
    try {
      serverQueue = queue.get( message.guild.id );
      console.log( args[2]/100 );
      serverQueue.volume = args[2]/100;
      
      try {serverQueue.dispatcher.setVolume(serverQueue.volume);}
      catch(err){console.log('No dispatcher')}
      
      queue.set( message.guild.id, serverQueue );
      saveQueue( message, serverQueue );
      resolve('Saved volume at *'+args[2]+'%*.');
    }catch(err){resolve(err);}
  });
}


/* File functions */
// Save to file function
function saveQueue( message, serverQueue ) {
  return new Promise( (resolve, reject) => {
    // Only save what is necessary
    let saveData = { 
      songs: serverQueue.songs,
      roles: serverQueue.roles,
      volume: serverQueue.volume,
    };
    
    // Attempt to save the file
    try {
      fs.writeFileSync( '..\\server_configs\\' + message.guild.id + '.json', JSON.stringify(saveData, null, '  ') );
      resolve('Config saved.');
    }
    // Log errors and return false in case of failure
    catch (err) {
      console.log(err);
      resolve(err);
    }
  });
}

// Load from file function
function loadQueue( message, serverQueue ) {
  return new Promise( (resolve, reject) => {
    var local = createQueue(message);
    
    try {
      let data = fs.readFileSync( '..\\server_configs\\' + message.guild.id + '.json' );
      
      // Parse the data
      local = Object.assign( local, JSON.parse(data));
      
      // Set the data into the master and resolve
      queue.set( message.guild.id, local );
      resolve( local );
    }
    catch (err) {
      reject( createQueue(message) );
    }
  });
}

// Scan directory 
function dirScan( message, args ) {
  return new Promise( async (resolve, reject) => {
    try {
      let list = await fs.readdirSync( args[1], { withFileTypes: true } );
      let curDirLst = [];
      
      for ( let i = 0; i < list.length; i++ ) {
        if ( list[i].isDirectory() ) {
          let dirCon;
          await dirScan( message, [ 'scan', args[1] + '\\' + list[i].name ] ).then( result => dirCon = result ).catch( error => console.log(error) );
          
          curDirLst.push({
            name: list[i].name,
            content: dirCon,
          });
        }else if ( list[i].name.endsWith('.mp3') ) curDirLst.push( list[i].name );
      }
      
      resolve(curDirLst);
    }catch (err) {
      reject(err);
    }
  });
}

// Play a local file !! TESTING !!
function localPlay( message, serverQueue, args ) {
  return new Promise(async(resolve,reject)=>{
    console.log( path.basename('D:\\Music\\Music\\Red Hot Chili Peppers\\Californication\\06 Californication.mp3') );
    
    serverQueue.connection = await serverQueue.voiceChannel.join();
    serverQueue.dispatcher = await serverQueue.connection
      .play( 'D:\\Music\\Music\\Red Hot Chili Peppers\\Californication\\06 Californication.mp3', { volume: 0.1 } )
      .on('finish',()=>{resolve('done');})
      .on('error',err=>{reject(err);});
  });
}


/* Role commands */
// Role cmd parser
function roleMain( message, serverQueue, args ) {
  return new Promise(async(resolve,reject)=>{
    switch (args[1]) {
      case 'add':
        addRole( message, serverQueue, args )
          .then(res=>resolve(res))
          .catch(err=>reject(err));
        break;
        
      case 'rm':
      case 'remove':
        remRole( message, serverQueue, args )
          .then(res=>resolve(res))
          .catch(err=>reject(err));
        break;
        
      case 'ls':
      case 'list':
        listRole( serverQueue )
          .then(res=>resolve(res))
          .catch(err=>reject(err));
        break;
        
      default:
        resolve('Usage: .role <add/remove/list>');
        break;
    }
  });
}

// Add role
function addRole( message, serverQueue, args ) {
  return new Promise((resolve,reject)=>{
    try {
      serverQueue.roles.push(args[2].slice(3,-1));
      saveQueue( message, serverQueue );
      resolve(args[2] + ' added to the role list');
    }catch(err){reject(err);}
  });
}

// Remove role
function remRole( message, serverQueue, args ) {
  return new Promise((resolve,reject)=>{
    try {
      if ( serverQueue.roles.length < 1 ) {resolve('No roles to remove');return;}
      else if ( args.length < 3 ) {resolve('Need a role to remove')}
      else {
        try {
          // Remove song and resolve
          let num = args[2]-1, name = serverQueue.roles[num];
          serverQueue.roles.splice( num, 1 );
          saveQueue( message, serverQueue );
          
          resolve(''+name+' was removed.');
        }catch(err){reject(err);}
      }
    } catch(e){reject(e);}
  });
}

// List roles
function listRole( serverQueue ) {
  return new Promise((resolve,reject)=>{
    try {
      let roles = serverQueue.roles, out = '';
      for ( var i = 0; i < roles.length; i++ )
        out += '`'+(i+1)+'.`\t<@&'+roles[i]+'>\n';
      
      if (out == '')
        out = 'No roles.'
      
      resolve(out);
    }catch(err){reject(err);}
  });
}


/* Owner commands */
// Test main
function testMain( message, serverQueue, args, client ) {
  return new Promise(async(resolve,reject)=>{
    if ( message.author.id != 122902985314533379 ) reject('Test commands are only available to owner');
    else {
      switch (args[1]) {
        // Print to console debugger
        case 'print':
          console.log( serverQueue );
          break;
          
        case 'cmd':
          cmdTest(message,args).then(res=>resolve(res)).catch(err=>reject(err));
          break;
          
        case 'shutdown':
        case 'exit':
          saveQueue(message,serverQueue,args)
          .then(res=>{
            message.channel.send(res);
            shutdown(message,client).catch(err=>reject(err));
          }).catch(err=>reject(err));
          break;
          
        case 'reconnect':
          reconnect(message,client).then(res=>resolve(res)).catch(err=>reject(err));
          break;
          
        case 'repeat':
          repeat( message, args );
          break;
          
        case 'debug':
          client.on('debug', console.log);
          break;
          
        default:
          resolve('Invalid.').then(res=>resolve(res)).catch(err=>reject(err));
          break;
      }
    }
  });
}

// Test command system
function cmdTest( message, args ) {
  return new Promise((resolve,reject)=>{
    try {
      console.log('Test command recieved.');
      if ( args.length > 2 ) resolve('Command system succesfully validated.\n'+args[2]);
      else resolve('Command system succesfully validated.');
    }catch(err){reject(err);}
  });
}

// Shut the bot down
function shutdown( message, client ) {
  return new Promise( (resolve,reject) => {
    try {
      client.destroy();
      process.exit();
    }
    catch (err) {reject(err);}
  });
}

// Reconnect the bot to the VC
function reconnect( message, client ) {
  return new Promise((resolve,reject)=>{
    try {
      client.destroy();
      client.login(token);
    }
    catch(err){reject(err);return;}
    resolve('Reconnecting');
  });
}


/* Misc. */
// Your welcome josh
async function queryGel( message, args ) {
  switch ( args.length ) {
    case 2:
      args = [ 'hw', args[1], '' ];
      break;
      
    case 3:
      args[2] = ' ' + args[2];
      console.log(args[2]);
      break;
      
    default:
      args = [ 'hw', 1, '' ];
      break;
  }
  
  // Create new map for to hold data
  let content;
  
  for ( var i = 0; i < args[1]; i++ ) {
    await fetch('https://gelbooru.com/index.php?page=dapi&s=post&q=index&limit=1&json=1&tags=sort:random' + args[2] )
      .then(res => res.text())
      .then(body => content = JSON.parse(body));
    
    message.channel.send( content[0].file_url );
  }
  
  return true;
}

// Repeat command
function repeat( message, args ) {
  return new Promise((resolve,reject)=>{
    try {
      for ( var i = 0; i < args[2]; i++ ) {
        message.channel.send(args[3]);
      }
    }catch(err){reject(err);}
    resolve('Finished.');
  });
}

// Purge command
function custPurge( message, args ) {
  return new Promise((resolve,reject)=>{
    let num = args[1];
    
    try{
      args[1]++;
      
      if ( args[1] <= 100 ) {
        message.channel.bulkDelete( args[1], false );
      }else {
        for ( let i = Math.ceil( args[1] / 100 ); i > 0; i-- ) {
          if ( args[1] > 100 ) {
            message.channel.bulkDelete( 100, false );
            args[1] -= 100;
          }else {
            message.channel.bulkDelete( args[1], false );
          }
        }
      }
      resolve(num+' messages deleted.');
    }catch(err) { reject(err); }
  });
}

// Help command
function help( message ) {
  return new Promise(async(resolve,reject)=>{
    if ( !message.author.dmChannel ) await message.author.createDM();
    resolve(
      '***Hector Bot Commands List***\n\n__Queue__:\nUsage:\t**.queue <list/remove/clear>**\nList will list out all current songs (e.g. **.queue list**)\nRemove will remove a specified song from the queue (e.g. **.queue remove 2**)\nClear will remove every song from the queue (e.g. **.queue clear**)\n\n__DJ Commands__:\nUsage:\t**.dj <add/play/stop/skip/volume>**\nAdd will queue a song with a provided url or name (e.g. **.dj add "Billy Joel - Piano Man"** or **.dj add <https://www.youtube.com/watch?v=ENXvZ9YRjbo>**)\n\t-Add will queue any amount of songs you add to the command and they can be both URLs and names to search \n\t-(e.g. **.dj add "Billy Joel - Piano Man" <https://www.youtube.com/watch?v=ENXvZ9YRjbo>**)\nPlay will start playing any songs in the queue (e.g. **.dj play**)\nStop will clear the queue and make the bot stop playing music (e.g. **.dj stop**)\nSkip will skip the current song (e.g. **.dj skip**)\nVolume will set the volume that the bot uses (e.g. **.dj vol .5**)\n\t-The volume is on a scale of 0 to 1, 1 being 100% volume.'
    );
  });
}



// Export file functions
module.exports = {
  queue, saveQueue, loadQueue,
  parseMsg,
  queueMain, dj, roleMain, testMain, help,
  queryGel, repeat, custPurge,
};