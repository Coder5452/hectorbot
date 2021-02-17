// Import dependencies
const ytsr = require('ytsr');
const ytpl = require('ytpl');
const EventEmitter = require('events');
const djEvent = new EventEmitter();

/* Command parser */
function queue(message, serverQueue, inCMD, client) {
  return new Promise((resolve, reject) => {
    // Decline if user is not in a VC
    if (!message.member.voice.channel) {
      resolve('You must be in a voice channel to use this command.');
    } else {
      switch (inCMD[1]) {
        case 'list':
          list(message, serverQueue)
              .then((res) => resolve(res))
              .catch((err) => reject(err));
          break;

        case 'shuffle':
          resolve(serverQueue.shuffleQueue());
          break;

        case 'move': {
          if (!inCMD[2] || !inCMD[3]) {
            resolve('Usage: .queue move <song position> <new position>');
          }

          const song = serverQueue.moveSong(inCMD[2] - 1, inCMD[3] - 1);
          resolve(`Moved **${song.title}** to position **${song.newPos + 1}**.`);
        } break;

        case 'remove': {
          if (!inCMD[2]) {
            resolve('Usage: .queue remove <song position>');
          }

          const song = serverQueue.removeSong(inCMD[2] - 1);
          resolve(`**${song.title}** removed from the queue.`);
        } break;

        case 'clear':
          serverQueue.clearQueue();
          resolve(`Queue cleared.`);
          break;

        default:
          resolve(`Not a command: **${inCMD.join(' ')}**`);
          break;
      }
    }
  });
}

function dj(message, serverQueue, inCMD, client) {
  return new Promise((resolve, reject) => {
    if (!message.member.voice.channel) {
      resolve('You must be in a voice channel to use this command.');
    } else {
      switch (inCMD[1]) {
        case 'add':
          if (!inCMD[2]) resolve('Usage: .dj add "srch1" "srch2" "srch3"...');
          else {
            add(message, serverQueue, inCMD, djEvent)
                .then((res) => {resolve(res);})
                .catch((err) => {resolve(err);});
          }
          break;

        case 'skip':
          if (!serverQueue.playing) {
            resolve('No music playing');
          }

          djEvent.emit('skip', message);
          break;

        case 'stop':
          resolve(serverQueue.stopAudio());
          break;

        case 'pause':
          resolve(serverQueue.pauseAudio());
          break;

        case 'resume':
          resolve(serverQueue.resumeAudio());
          break;

        case 'info':
          if (!serverQueue.playing) {
            resolve('No music playing');
          }

          djEvent.emit('info', message);
          resolve('Fetching song information.');
          break;

        case 'suggest':
          if (!serverQueue.playing) {
            resolve('No music playing');
          }

          djEvent.emit('suggestion', message);
          resolve('Fetching suggestions.');
          break;

        case 'volume':
          if (!inCMD[2]) {
            resolve('Usage: .dj vol <volume>');
          }

          resolve(serverQueue.setVolume(inCMD[2] / 100, message.guild.id));
          break;

        default:
          resolve(`Not a command: **${inCMD.join(' ')}**`);
          break;
      }
    }
  });
}

function role(message, serverQueue, inCMD, client) {
  return new Promise((resolve, reject) => {
    switch (inCMD[1]) {
      case 'add':
        if (message.mentions.roles.size === 0) resolve('Usage: **.role add @ROLE**');
        else resolve(serverQueue.addRole(Array.from(message.mentions.roles.keys())[0]));
        break;

      case 'remove':
        if (!inCMD[2]) resolve('Usage: .role remove <role position>');
        else resolve(serverQueue.removeRole(inCMD[2] - 1));
        break;

      case 'list':
        try {
          const roleList = serverQueue.listRoles();

          if (roleList === -1) {
            resolve(`${message.guild.name} has no roles`);
          }

          resolve({
            embed: {
              color: 0x54c0f0,
              title: `${message.guild.name} role list.`,
              description: roleList,
            },
          });
        } catch (err) {reject(err);}
        break;

      default:
        resolve(`Not a command:\n**${inCMD.join(' ')}**`);
        break;
    }
  });
}

function test(message, serverQueue, inCMD, client) {
  return new Promise((resolve, reject) => {
    if (message != null && message.author.id !== '122902985314533379') {
      resolve('Test commands are only available to owner');
    } else {
      try {
        switch (inCMD[1]) {
          case 'cmdTest':
            console.log('Test command recieved.');
            resolve(`Command system validated.${inCMD.length > 2 ? `\n${inCMD[2]}` : ''}`);
            break;

          case 'shutdown':
            client.destroy();
            process.exit();
            break;

          case 'print':
            console.log(serverQueue);
            resolve('Done.');
            break;

          case 'scan':
            console.log(serverQueue.scanDir(inCMD[2]));
            break;

          default:
            resolve(`Not a command: **${inCMD.join(' ')}**`);
            break;
        }
      } catch (err) {reject(err);}
    }
  });
}

function mod(message, serverQueue, inCMD, client) {
  return new Promise((resolve, reject) => {
    switch (inCMD[1]) {
      case 'prune':
        if (inCMD[2] = '' || typeof inCMD[2] === 'number' || inCMD[2] > 100) {
          resolve('Third argument necessary and must be a number equal or less than 100.');
        } else {
          message.channel.bulkDelete(100, true)
              .then((msgs) => resolve(`Deleted ${msgs.size} messages.`))
              .catch((err) => reject(err));
        }
        break;

      case 'clearChannel': {
        const channel = message.channel;
        channel.clone();
        channel.delete();
      } break;

      default:
        resolve(`Not a command: **${inCMD.join(' ')}**`);
    }
  });
}

// Export file functions
module.exports = {
  queue,
  dj,
  role,
  test,
  mod,
  sleep,
};


/* LOCAL FUNCTION */
// List queue
function list(message, serverQueue) {
  return new Promise((resolve, reject) => {
    // Check if the queue is empty or doesn't exist
    if (!serverQueue || serverQueue.songs.length === 0) {
      resolve('There are no songs in the queue');
    }

    // Get the page numbers
    let currPage = 1;
    let numPages = Math.ceil(serverQueue.songs.length / 10);

    // Draw initial queue and create reaction collector to cycle pages
    message.channel.send(drawQueue(serverQueue, message, currPage))
        .then(async (msg) => {
        // React with emoji controls
          await msg.react('◀️').catch((err) => {throw err;});
          await msg.react('▶️').catch((err) => {throw err;});

          // Create reaction collector to detect reactions
          const filter = (r, u) => (r.emoji.name === '◀️' || r.emoji.name === '▶️') && u !== msg.author;
          const contols = await msg.createReactionCollector(filter, { time: 60000 });

          // Check for reactions and edit queue embed appropriately
          contols.on('collect', async (r, u) => {
            numPages = Math.ceil(serverQueue.songs.length / 10);

            // Indrement/decrement depending on reaction
            if (r.emoji.name === '▶️') currPage++;
            else currPage--;

            // Edit queue page if the page number doesn't exist outside of pages range
            if (currPage > numPages) {
              currPage = numPages;
            }
            if (currPage < 1) {
              currPage = 1;
            }

            // Edit message
            msg.edit(await drawQueue(serverQueue, message, currPage))
                .catch((err) => {
                  throw err;
                });

            // Remove any added reactions to make cycling easier
            r.users.remove(await u);
          });

          // Send a message when the collector stops
          contols.on('end', () => {
            resolve('Please use *.queue list* again if you want to see use queue');
          });
        }).catch((err) => reject(err));
  });
}

// DrawQueue function to avoid clogging main file
function drawQueue(serverQueue, message, pageNum) {
  const queueContent = serverQueue.queuePages();
  let output = '';

  queueContent[pageNum - 1].forEach((element, index) => {
    output += `\n\`${`${index + 1}.`.padEnd(3)}\`\t${element.title}`;
  });

  // Create embed and pass it
  return {
    embed: {
      color: 0x54c0f0,
      title: `${message.guild.name} song queue.`,
      description: output,
      footer: {
        text: `Page ${pageNum} / ${queueContent.length}`,
      },
    },
  };
}

// Play audio in queue
async function play(message, serverQueue, djEvent) {
  try {
    // Check if there are songs in the queue
    if (serverQueue.songs.length < 1) {
      return 'No songs in the queue';
    }

    // See if user is in a VC
    const vc = message.member.voice.channel;
    if (!vc) {
      return 'You must be in a voice channel to play music';
    } else {
      serverQueue.voiceChannel = vc;
    }

    // Check if perms are met
    const perms = vc.permissionsFor(message.client.user);
    if (!perms.has('CONNECT') || !perms.has('SPEAK')) {
      return 'Bot doesn\'t have necessary perms to join the voice channel.';
    } else if (!serverQueue.songs[0]) {
      return 'No songs in queue';
    }


    // Set up loop for queued songs
    serverQueue.playing = true;
    while (serverQueue.songs.length > 0) {
      await serverQueue.playAudio(message, djEvent)
          .then((res) => message.channel.send(res))
          .catch((err) => {throw err;});
    }

    serverQueue.stopAudio();
    return 'No song left in queue.';
  } catch (err) {console.error(err);}
}

// Add song to queue
async function add(message, serverQueue, inCMD, djEvent) {
  try {
    if (inCMD.length < 3) return Promise.resolve('Need something to search for.');

    inCMD.splice(0, 2);
    let toAdd = [];

    // Resolve a youtube link (or playlist) for every arguemtn
    for (const element of inCMD) {
      if (element.indexOf('list=') !== -1) {
        await ytSearchPl(element)
            .then((res) => {toAdd = toAdd.concat(res);})
            .catch((err) => {throw err;});
      } else {
        await ytSearch(element)
            .then((res) => {toAdd.push(res);})
            .catch((err) => {throw err;});
      }
    }

    // Queue songs
    serverQueue.queueSongs(toAdd);

    // Start playing songs
    if (!serverQueue.playing) {
      play(message, serverQueue, djEvent);
    }

    // Return confirmation message
    let output = '';
    await toAdd.forEach((element) => {output += `\n**${element.title}** added to the queue.`;});
    return Promise.resolve(output);
  } catch (err) {return Promise.reject(err);}
}

// Search youtube
async function ytSearch(srchStr) {
  try {
    const srch = await ytsr.getFilters(srchStr);
    const filter = srch.get('Type').get('Video');
    const video = await ytsr(filter.url, { limit: 1 });

    const out = {
      title: video.items[0].title,
      url: video.items[0].url,
      type: 0,
    };

    return (out);
  } catch (err) {console.error(err);}
}

// Search youtube playlist
function ytSearchPl(playlistURL) {
  return new Promise((resolve, reject) => {
    try {
      // Create return array
      const playlist = [];

      // resolve video metadata from a playlist's url
      ytpl(playlistURL)
          .then((res) => {
            res.items.forEach((video) => {
              playlist.push({
                title: video.title,
                url: video.shortUrl,
                type: 0,
              });
            });
            resolve(playlist);
          })
          .catch((err) => {throw err;});
    } catch (err) {resolve(err);}
  });
}

// Wait function for rate limiting
function sleep(milliseconds) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, milliseconds);
  });
}
