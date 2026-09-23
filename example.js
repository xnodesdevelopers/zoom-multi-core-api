const { makeZoomSocket } = require('./zoom-socket');

async function startZoom() {
  // Baileys style factory setup
  const sock = makeZoomSocket({
    headless: true,
    // chromiumPath: '/usr/bin/chromium' // Arch Linux setup
  });

  // Baileys style event listener
  sock.ev.on('connection.update', (update) => {
    const { id, name, status, error } = update;

    if (status === 'connecting') {
      console.log(`[CONNECTING] Bot: ${name} (ID: ${id})`);
    } else if (status === 'open') {
      console.log(`[ONLINE] Bot joined meeting: ${name} (ID: ${id})`);
    } else if (status === 'close') {
      console.log(`[DISCONNECTED] Bot: ${name} left or failed. Reason:`, error || 'Explicit disconnect');
    }
  });

  sock.ev.on('messages.upsert', (m) => {
    console.log(`[MESSAGE SENT] ${m.name}: "${m.message}"`);
  });

  // Start joining
  await sock.join({
    meetingId: '8910111213',
    passcode: '123456',
    participants: ['Sanku_Bot_01', 'Sanku_Bot_02', 'Sanku_Bot_03']
  });

  // Send message to all (broadcast)
  setTimeout(async () => {
    await sock.sendMessage('all', { text: 'Hello !' });
  }, 10000);

  // Send message from a single bot only
  setTimeout(async () => {
    const bots = sock.getParticipants();
    if (bots.length > 0) {
      await sock.sendMessage(bots[0].id, { text: 'hello.' });
    }
  }, 15000);

  // Clean exit after 1 minute
  setTimeout(async () => {
    console.log('Terminating sessions...');
    await sock.end();
  }, 60000);
}

startZoom();
