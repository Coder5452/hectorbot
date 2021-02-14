const fs = require('fs');
const ytdl = require('ytdl-core-discord');

module.exports.Queue = class Queue {
  constructor( inVC, inTC, inVol, inRoles ) {
    this.voiceChannel = !inVC?null:inVC;
    this.textChannel = inTC;
    this.guildID = inTC.guild.id;
    this.dispatcher = null;
    this.songs = [];
    this.roles = !inRoles?[]:inRoles;
    this.volume = !inVol?.1:inVol;
    this.playing = false;
    this.paused = false;
  }

  // Setter functions
  setVC( vc ) { this.voiceChannel = vc; }
  setDisp( disp ) { this.dispatcher = disp; }
  setSongs( songlist ) { this.songs = songlist; }
  setRoles( rolelist ) { this.roles = rolelist; }
  setVolume( inVol ) {
    this.volume = inVol;

    if ( this.dispatcher )
      this.dispatcher.setVolumeLogarithmic(this.volume);

    this.saveQueue();

    return `Changed volume to **${inVol*100}%**.`;
  }

  // Getter methods
  getVC() { return this.voiceChannel; }
  getDisp() { return this.dispatcher; }
  getSongs() { return this.songs; }
  getRoles() { return this.roles; }
  getVolume() { return this.volume; }

  /* FUNCTIONS */
  // Send a message to textChannel
  sendMessage( message ) {
    this.textChannel.send( message );
    return `Sent message: "${message}"\n`;
  }

  // Get the song queue listed in pages of <= 10
  queuePages() {
    try {
      // Set return str and the starting index pos
      let numPages = Math.ceil(this.songs.length/10),
          pages = [];

      // Create a matrix of song pages
      for ( var i = 0; i < numPages; i++ ) {
        let page = [];

        for ( var r = i*10; r < i*10+10 && r < this.songs.length; r++ ) {
          page.push( this.songs[r] );
        }

        pages.push(page);
      }

      // Return an embed
      return pages;
    }catch(err){return err}
  }

  // Move a song from one position to another
  moveSong( oldPos, newPos ) {
    try {
      // Save the song being moved
      let song = this.songs[oldPos];

      // Remove the song and replace it in the new pos
      this.songs.splice( oldPos, 1 );
      this.songs.splice( newPos, 0, song );

      // Return moved song
      return {
        title: song.title,
        url: song.url,
        type: song.type,
        oldPos: oldPos,
        newPos: newPos
      };
    }catch(err){return err}
  }

  // Shuffle the songs in the queue
  shuffleQueue() {
    try {
      if ( this.songs.length < 2 )
        return 'The queue is too small to shuffle';

      // Remove the first song to avoid playing twice
      let firstSong = this.songs[0]; this.songs.shift();
      let m = this.songs.length, t, i;

      // Randomize the queue
      while (m) {
        i = Math.floor(Math.random()*m--);
        t = this.songs[m];
        this.songs[m] = this.songs[i];
        this.songs[i] = t;
      }

      // Readd firstSong and return
      this.songs.unshift( firstSong );
      return 'Shuffled the queue.';
    }catch(err){return err}
  }

  // Remove a song form the queue
  removeSong( indexPos ) {
    if ( indexPos > this.songs.length )
      return new RangeError(`${indexPos} too large of value`);

    // Remove the songs
    let song = this.songs[indexPos]
    this.songs.splice( indexPos, 1 );

    return {
      title: song.title,
      url: song.url,
      type: song.type,
      iPos: indexPos
    };
  }

  // Clear the queue
  clearQueue() {
    this.songs = [];
    return true;
  }

  // Save the queue to file
  saveQueue() {
    try {
      let saveData = {
        roles: this.roles,
        volume: this.volume
      }

      fs.writeFileSync(
        `${__dirname}\\server_configs\\${this.guildID}.txt`,
        JSON.stringify(saveData)
      );

      return true;
    }catch(err){return err}
  }

  // Load a queue from file
  async loadQueue() {
    try {
      let data = await JSON.parse(
        await fs.readFileSync(`${__dirname}\\server_configs\\${this.guildID}.txt`)
      );

      this.roles = data.roles;
      this.volume = data.volume;

      return data;
    }catch(err){console.error('>>Load queue error<<\nNo file to read from.\n')}
  }

  // Queue songs from array
  queueSongs( songs ) {
    songs.forEach(element=>{
      this.songs.push(element);
    });
    return songs;
  }

  // Play audio from queue
  playAudio( message, djEvent ) {
    return new Promise(async(resolve,reject)=>{
      var song = this.songs[0],
          con = await this.voiceChannel.join();

      // Download song from youtube if online, else play local file
      if (song.type==0)
        this.dispatcher = con.play(
          await ytdl(song.url, {quality:'highestaudio'}),
          {bitrate:'auto',type:'opus',volume:this.volume/10}
        );
      else
        this.dispatcher = con.play( song.url, {bitrate:'auto'} );

      // Log any errors with audiostream and playback
      this.dispatcher.on('error', (err)=>reject(err));

      // Notify user on audio start and set volume
      this.dispatcher.on('start', ()=>{
        this.dispatcher.setVolumeLogarithmic( this.volume );
        message.channel.send(
          `Started playing **${song.title}**\n${song.type==0?`<${song.url}>`:'*Local File*'}`
        );
      });

      // Cycle songs, end listeners, and resolve
      this.dispatcher.on('finish', ()=>{
        this.songs.shift();

        djEvent.removeAllListeners('skip');
        djEvent.removeAllListeners('info');
        djEvent.removeAllListeners('suggestion');

        return resolve(`**${song.title}** finished.`);
      });

      // Skip event listender
      djEvent.on('skip', ()=>{
        this.dispatcher.end();
        return resolve(`**${song.title}** skipped.`);
      });

      // String truncation for char limit handling
      function truncateStr( string, length ) {
        if ( string.length < length )
          return string;
        else
          return `${string.substr(0, length)}...`
      }

      // Info event listener
      djEvent.on('info', async(eMsg)=>{
        // Fetch pertinent info
        let info = await ytdl.getInfo( song.url );
        info = await info.videoDetails;

        // Send emebed with info
        message.channel.send({embed: {
          color: 0x54cf0,
          thumbnail: {
            url: info.thumbnails[3].url,
            height: info.thumbnails[3].height,
            width: info.thumbnails[3].width
          },
          title: info.title,
          description: truncateStr(info.description, 2000),
          footer: { text: info.video_url }
        }});
      });

      // Suggest command event listener
      djEvent.on('suggestion', async(message)=>{
        let info = await ytdl.getInfo(song.url),
            songs = [];

        // Get # of songs from info and convert into a playlist
        for ( var i = 0; i < 5 && i < info.related_videos.length; i++ ) {
          songs.push({
            title: info.related_videos[i].title,
            url: `https://www.youtube.com/watch?v=${info.related_videos[i].id}`,
            type: 0
          });
        }

        // Generate a queue string from the playlist
        let output = '';
        songs.forEach((element,index)=>{
          output += `\`${index+1}.\`\t${element.title}\n`;
        });

        // Send embed with song suggestions
        message.channel.send({embed: {
          color: 0x54c0f0,
          title: `Songs related to ${song.title}.`,
          description: output,
          footer: { text: 'Please type a number one through five to add a suggested song.' }
        }});

        // Create a message collector for the response
        const filter = m => m.author == message.author;
        const reply = message.channel.createMessageCollector(filter,{time:20000});

        // Check if collected message has necessary data
        reply.on('collect', inMsg=>{
          let msg = inMsg.content.split()[0]-1;

          if ( !isNaN(msg) ) {
            // Cancel if input is less than 1
            if ( msg < 0 )
              reply.stop('Cancelling operation.');
            else if ( msg >= songs.length )
              message.channel.send('Number too high');
            else {
              this.songs.push( songs[msg] );
              reply.stop(`Added **${songs[msg].title}** to the queue.`);
            }
          }
          else
            message.channel.send('Invalid response.');
        });

        // Send message when collector ends
        reply.on('end', (collection,reason)=>{message.channel.send(
          `${reason!='time'?reason:''}\nPlease use **.dj suggest** again to add another song.`
        )});
      });
    });
  }

  // Stop audio playback
  stopAudio() {
    if ( this.dispatcher != null ) {
      this.songs = [];
      this.playing = false;
      this.dispatcher.end();
      this.setDisp(null);
      this.voiceChannel.leave();

      return('Music playback stopped');
    }
    else
      return('No music playing.');
  }

  // Pause audio playback
  pauseAudio() {
    if ( this.paused )
      return 'Audio already paused.';
    else if ( this.dispatcher == null )
      return 'No audio paying.';
    else {
      this.paused = true;
      this.dispatcher.pause();
      return 'Audio paused.';
    }
  }

  // Resume audio playback
  resumeAudio() {
    if ( !this.paused )
      return 'Audio not paused.';
    else if ( this.dispatcher == null )
      return 'No audio playing.';
    else {
      this.paused = false;
      this.dispatcher.resume();
      return 'Audio unpaused';
    }
  }

  // Add role to check for
  addRole( role ) {
    if ( this.roles.length >= 5 )
      return 'A maximum of five roles are allowed.';

    this.roles.push( role );
    this.saveQueue( this.guildID );

    return `Added <@&${role}> to the list.`;
  }

  // Remove role to check for
  removeRole( roleIndex ) {
    if ( this.roles.length < 1 )
      return 'No roles to remove';

    if ( roleIndex > this.roles.length-1 )
      return 'Number too high.';

    let role = this.roles[roleIndex];
    this.roles.splice( roleIndex, 1 );
    this.saveQueue( this.guildID );

    return `Removed <@&${role}> from the list.`;
  }

  // Roles toString
  listRoles() {
    if ( this.roles.length < 1 )
      return -1;

    let output = '';

    this.roles.forEach((element,index)=>{
      output += `\n\`${index+1}.\`\t<@&${element}>`;
    });

    return output;
  }
}
