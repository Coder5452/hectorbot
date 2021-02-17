const fs = require('fs');
const ytdl = require('ytdl-core-discord');
const path = require('path');

module.exports.Queue = class Queue {
  constructor(inVC, inTC, inVol, inRoles/* , inNewMemRole */) {
    this.voiceChannel = !inVC ? null : inVC;
    this.textChannel = inTC;
    this.guildID = inTC.guild.id;
    this.dispatcher = null;
    this.songs = [];
    this.roles = !inRoles ? [] : inRoles;
    // this.newMemberRole = !inNewMemRole ? null : inNewMemRole;
    this.volume = !inVol ? 0.1 : inVol;
    this.playing = false;
    this.paused = false;
  }

  // Setter functions
  setVC(vc) {
    this.voiceChannel = vc;
  }

  setDisp(disp) {
    this.dispatcher = disp;
  }

  setSongs(songlist) {
    this.songs = songlist;
  }

  setRoles(rolelist) {
    this.roles = rolelist;
  }

  setVolume(inVol) {
    this.volume = inVol;

    if (this.dispatcher) {
      this.dispatcher.setVolumeLogarithmic(this.volume);
    }

    this.saveQueue();

    return `Changed volume to **${inVol * 100}%**.`;
  }

  // setNewMemberRole(roleID) {
  //   this.newMemberRole = roleID;
  // }

  // Getter methods
  getVC() {
    return this.voiceChannel;
  }

  getDisp() {
    return this.dispatcher;
  }

  getSongs() {
    return this.songs;
  }

  getRoles() {
    return this.roles;
  }

  getVolume() {
    return this.volume;
  }

  /* FUNCTIONS */
  // Send a message to textChannel
  sendMessage(message) {
    this.textChannel.send(message);
    return `Sent message: "${message}"\n`;
  }

  // Get the song queue listed in pages of <= 10
  queuePages() {
    try {
      if (this.songs.length < 1) return -1;

      // Set return str and the starting index pos
      const numPages = Math.ceil(this.songs.length / 10);
      const pages = [];

      // Create a matrix of song pages
      for (let i = 0; i < numPages; i++) {
        const page = [];

        for (let r = i * 10; r < i * 10 + 10 && r < this.songs.length; r++) {
          page.push(this.songs[r]);
        }

        pages.push(page);
      }

      // Return an embed
      return pages;
    } catch (err) {return err;}
  }

  // Move a song from one position to another
  moveSong(oldPos, newPos) {
    try {
      // Save the song being moved
      const song = this.songs[oldPos];

      // Remove the song and replace it in the new pos
      this.songs.splice(oldPos, 1);
      this.songs.splice(newPos, 0, song);

      // Return moved song
      return {
        title: song.title,
        url: song.url,
        type: song.type,
        oldPos,
        newPos,
      };
    } catch (err) {return err;}
  }

  // Shuffle the songs in the queue
  shuffleQueue() {
    try {
      if (this.songs.length < 2) {
        return 'The queue is too small to shuffle';
      }

      // Remove the first song to avoid playing twice
      const firstSong = this.songs[0]; this.songs.shift();
      let m = this.songs.length;
      let t; let i;

      // Randomize the queue
      while (m) {
        i = Math.floor(Math.random() * m--);
        t = this.songs[m];
        this.songs[m] = this.songs[i];
        this.songs[i] = t;
      }

      // Readd firstSong and return
      this.songs.unshift(firstSong);
      return 'Shuffled the queue.';
    } catch (err) {return err;}
  }

  // Remove a song form the queue
  removeSong(indexPos) {
    if (indexPos > this.songs.length) {
      return new RangeError(`${indexPos} too large of value`);
    }

    // Remove the songs
    const song = this.songs[indexPos];
    this.songs.splice(indexPos, 1);

    return {
      title: song.title,
      url: song.url,
      type: song.type,
      iPos: indexPos,
    };
  }

  // Clear the queue
  clearQueue() {
    this.songs.splice(1, this.songs.length - 1);
    return true;
  }

  // Save the queue to file
  saveQueue() {
    try {
      const saveData = {
        roles: this.roles,
        volume: this.volume,
      };

      fs.writeFileSync(
          path.join(__dirname, `\\server_configs\\${this.guildID}.txt`),
          JSON.stringify(saveData),
      );

      return true;
    } catch (err) {return err;}
  }

  // Load a queue from file
  async loadQueue() {
    try {
      const data = await JSON.parse(
          await fs.readFileSync(path.join(__dirname, `\\server_configs\\${this.guildID}.txt`)),
      );

      this.roles = data.roles;
      this.volume = data.volume;

      return data;
    } catch (err) {console.error(err);}
  }

  // Queue songs from array
  queueSongs(songs) {
    songs.forEach((element) => {
      this.songs.push(element);
    });
    return songs;
  }

  // Play audio from queue
  async playAudio(message, djEvent) {
    const song = this.songs[0];
    const con = await this.voiceChannel.join();

    // Download song from youtube if online, else play local file
    if (song.type === 0) {
      this.dispatcher = con.play(
          await ytdl(song.url, { quality: 'highestaudio' }),
          { bitrate: 'auto', type: 'opus', volume: this.volume / 10 },
      );
    } else {
      this.dispatcher = con.play(song.url, { bitrate: 'auto' });
    }

    return new Promise((resolve, reject) => {
      // Log any errors with audiostream and playback
      this.dispatcher.on('error', (err) => reject(err));

      // Notify user on audio start and set volume
      this.dispatcher.on('start', () => {
        this.dispatcher.setVolumeLogarithmic(this.volume);
        message.channel.send(
            `Started playing **${song.title}**\n${song.type === 0 ? `<${song.url}>` : '*Local File*'}`,
        );
      });

      // Cycle songs, end listeners, and resolve
      this.dispatcher.on('finish', () => {
        this.songs.shift();

        djEvent.removeAllListeners('skip');
        djEvent.removeAllListeners('info');
        djEvent.removeAllListeners('suggestion');

        return resolve(`**${song.title}** finished.`);
      });

      // Skip event listender
      djEvent.on('skip', () => {
        this.dispatcher.end();
        return resolve(`**${song.title}** skipped.`);
      });

      // String truncation for char limit handling
      function truncateStr(string, length) {
        if (string.length < length) {
          return string;
        }
        return `${string.substr(0, length)}...`;
      }

      // Info event listener
      djEvent.on('info', async (eMsg) => {
        // Fetch pertinent info
        let info = await ytdl.getInfo(song.url);
        info = await info.videoDetails;

        // Send emebed with info
        message.channel.send({
          embed: {
            color: 0x54cf0,
            thumbnail: {
              url: info.thumbnails[3].url,
              height: info.thumbnails[3].height,
              width: info.thumbnails[3].width,
            },
            title: info.title,
            description: truncateStr(info.description, 2000),
            footer: {
              text: info.video_url,
            },
          },
        });
      });

      // Suggest command event listener
      djEvent.on('suggestion', async (message) => {
        const info = await ytdl.getInfo(song.url);
        const songs = [];

        // Get # of songs from info and convert into a playlist
        for (let i = 0; i < 5 && i < info.related_videos.length; i++) {
          songs.push({
            title: info.related_videos[i].title,
            url: `https://www.youtube.com/watch?v=${info.related_videos[i].id}`,
            type: 0,
          });
        }

        // Generate a queue string from the playlist
        let output = '';
        songs.forEach((element, index) => {
          output += `\`${index + 1}.\`\t${element.title}\n`;
        });

        // Send embed with song suggestions
        message.channel.send({
          embed: {
            color: 0x54c0f0,
            title: `Songs related to ${song.title}.`,
            description: output,
            footer: { text: 'Please type a number one through five to add a suggested song.' },
          },
        });

        // Create a message collector for the response
        const filter = (m) => m.author === message.author;
        const reply = message.channel.createMessageCollector(filter, { time: 20000 });

        // Check if collected message has necessary data
        reply.on('collect', (inMsg) => {
          const msg = inMsg.content.split()[0] - 1;

          if (!isNaN(msg)) {
            // Cancel if input is less than 1
            if (msg < 0) {
              reply.stop('Cancelling operation.');
            } else if (msg >= songs.length) {
              message.channel.send('Number too high');
            } else {
              this.songs.push(songs[msg]);
              reply.stop(`Added **${songs[msg].title}** to the queue.`);
            }
          } else {
            message.channel.send('Invalid response.');
          }
        });

        // Send message when collector ends
        reply.on('end', (collection, reason) => {
          message.channel.send(
              `${reason !== 'time' ? reason : ''}\nPlease use **.dj suggest** again to add another song.`,
          );
        });
      });
    });
  }

  // Stop audio playback
  stopAudio() {
    if (this.dispatcher != null) {
      this.songs = [];
      this.playing = false;
      this.dispatcher.end();
      this.setDisp(null);
      this.voiceChannel.leave();

      return 'Music playback stopped';
    }
    return 'No music playing.';
  }

  // Pause audio playback
  pauseAudio() {
    if (this.paused) {
      return 'Audio already paused.';
    } else if (this.dispatcher == null) {
      return 'No audio paying.';
    }

    this.paused = true;
    this.dispatcher.pause();
    return 'Audio paused.';
  }

  // Resume audio playback
  resumeAudio() {
    if (!this.paused) {
      return 'Audio not paused.';
    } else if (this.dispatcher == null) {
      return 'No audio playing.';
    }

    this.paused = false;
    this.dispatcher.resume();
    return 'Audio unpaused';
  }

  // Add role to check for
  addRole(role) {
    if (this.roles.length >= 5) {
      return 'A maximum of five roles are allowed.';
    }

    this.roles.push(role);
    this.saveQueue();

    return `Added <@&${role}> to the list.`;
  }

  // Remove role to check for
  removeRole(roleIndex) {
    if (this.roles.length < 1) {
      return 'No roles to remove';
    }

    if (roleIndex > this.roles.length - 1) {
      return 'Number too high.';
    }

    const role = this.roles[roleIndex];
    this.roles.splice(roleIndex, 1);
    this.saveQueue();

    return `Removed <@&${role}> from the list.`;
  }

  // Roles toString
  listRoles() {
    if (this.roles.length < 1) {
      return -1;
    }

    let output = '';

    this.roles.forEach((element, index) => {
      output += `\n\`${index + 1}.\`\t<@&${element}>`;
    });

    return output;
  }

  // Scan a directory and return object with all subDirs and .mp3 files
  async scanDir(targetDir) {
    const list = await fs.readdirSync(targetDir, { withFileTypes: true });

    return new Promise((resolve, reject) => {
      try {
        const curDirLst = [];

        for (let i = 0; i < list.length; i++) {
          if (list[i].isDirectory()) {
            let dirCon;
            this.scanDir(`${targetDir}\\${list[i].name}`)
                .then(async (result) => {dirCon = await result;})
                .catch((error) => {throw error;});

            curDirLst.push({
              name: list[i].name,
              content: dirCon,
            });
          } else if (list[i].name.endsWith('.mp3')) {
            curDirLst.push(list[i].name);
          }
        }

        return resolve(curDirLst);
      } catch (err) {return reject(err);}
    });
  }
};
