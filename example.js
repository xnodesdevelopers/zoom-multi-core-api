const { makeZoomSocket } = require('./zoom-socket');

async function startZoom() {
  const sock = makeZoomSocket({
    headless: true
  });

  sock.ev.on('connection.update', (update) => {
    const { id, name, status, error } = update;
    console.log(`[${status.toUpperCase()}] ${name || id}`, error || '');
  });

  sock.ev.on('messages.upsert', (m) => {
    console.log(`[MESSAGE SENT] ${m.name}: "${m.message}"`);
  });

  const results = await sock.join({
    meetingId: '87407887403',
    passcode: 'W9puGc',
    participants: ['Sanku_Bot_01', 'Sanku_Bot_02']
  });

  console.log('Join results:', results);

  setTimeout(async () => {
    try {
      await sock.sendMessage('all', { text: 'Sanku Engine Online' });
    } catch (e) {
      console.error(e.message);
    }
  }, 10000);
}

startZoom().catch(console.error);
