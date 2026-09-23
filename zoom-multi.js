/**
 * Zoom Multi-Session Baileys-style Socket Engine
 * @author Tharindu Liyanage (Sanku) <https://github.com/Xnodesdevelopers>
 * @license MIT
 */

const { EventEmitter } = require('events');
const { chromium } = require('playwright');

/**
 * Factory function creating a Baileys-like connection socket
 * @param {Object} config
 */
function makeZoomSocket(config = {}) {
  const ev = new EventEmitter();
  const headless = config.headless ?? true;
  const chromiumPath = config.chromiumPath || process.env.CHROMIUM_PATH || undefined;

  let browser = null;
  const sessions = new Map(); // id -> { id, name, page, context, status }

  // Internal initialization
  const initBrowser = async () => {
    if (browser) return browser;

    browser = await chromium.launch({
      headless,
      executablePath: chromiumPath,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-gpu',
        '--mute-audio',
        '--window-position=-2000,-2000',
        '--window-size=800,600'
      ]
    });

    return browser;
  };

  /**
   * Spawn and connect a single participant
   */
  const connectParticipant = async ({ sessionId, meetingId, name, passcode = '' }) => {
    try {
      ev.emit('connection.update', {
        id: sessionId,
        name,
        status: 'connecting',
        timestamp: Date.now()
      });

      const b = await initBrowser();
      const context = await b.newContext({
        viewport: { width: 800, height: 600 },
        permissions: []
      });

      // Network Interception (Block heavy assets)
      await context.route('**/*', async (route) => {
        const type = route.request().resourceType();
        if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
          await route.abort();
        } else {
          await route.continue();
        }
      });

      const page = await context.newPage();
      const cleanId = meetingId.replace(/\s+/g, '');
      let url = `https://app.zoom.us/wc/${cleanId}/join?prefer=1&un=${encodeURIComponent(name)}`;
      if (passcode) url += `&pwd=${encodeURIComponent(passcode)}`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

      // Pass cookie modal
      const acceptCookie = page.locator('#onetrust-accept-btn-handler');
      if (await acceptCookie.isVisible({ timeout: 2500 }).catch(() => false)) {
        await acceptCookie.click().catch(() => {});
      }

      // Bypass AV permissions
      const bypassAv = page.locator(
        '.pepc-permission-dialog__footer-button, [role="button"]:has-text("Continue without microphone and camera")'
      ).first();
      try {
        await bypassAv.waitFor({ state: 'visible', timeout: 6000 });
        await bypassAv.click({ force: true });
      } catch {}

      // Fill passcode if missing from query params
      const pwdInput = page.locator('#input-for-pwd');
      if (await pwdInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        if (passcode) await pwdInput.fill(passcode);
      }

      // Enter display name
      const nameInput = page.locator('#input-for-name');
      if (await nameInput.isVisible({ timeout: 4000 }).catch(() => false)) {
        await nameInput.fill('');
        await nameInput.fill(name);
      }

      // Click Join
      const joinBtn = page.locator('button.preview-join-button.zm-btn__outline--blue');
      try {
        await joinBtn.waitFor({ state: 'visible', timeout: 8000 });
        await joinBtn.click({ force: true });
      } catch {
        await page.keyboard.press('Enter');
      }

      const sessionData = {
        id: sessionId,
        name,
        context,
        page,
        status: 'open'
      };

      sessions.set(sessionId, sessionData);

      ev.emit('connection.update', {
        id: sessionId,
        name,
        status: 'open',
        timestamp: Date.now()
      });

      return { sessionId, success: true };
    } catch (err) {
      ev.emit('connection.update', {
        id: sessionId,
        name,
        status: 'close',
        error: err.message,
        timestamp: Date.now()
      });
      return { sessionId, success: false, error: err.message };
    }
  };

  return {
    ev,

    /**
     * Join one or multiple participants
     * @param {Object} payload
     * @param {string} payload.meetingId
     * @param {string} [payload.passcode]
     * @param {string[]} payload.participants
     */
    async join({ meetingId, passcode = '', participants = [] }) {
      if (!meetingId || !participants.length) {
        throw new Error('meetingId and participants array are required');
      }

      const tasks = participants.map((name, idx) => {
        const sessionId = `zoom_session_${Date.now()}_${idx}`;
        return connectParticipant({ sessionId, meetingId, name, passcode });
      });

      return await Promise.all(tasks);
    },

    /**
     * Send message into the chat (Baileys-like sendMessage)
     * @param {string|'all'} targetSessionId - 'all' or specific session ID
     * @param {Object} content - { text: string }
     */
    async sendMessage(targetSessionId, content) {
      if (!content || !content.text) {
        throw new Error('Payload format must be { text: string }');
      }

      let targets = [];
      if (targetSessionId === 'all') {
        targets = Array.from(sessions.values());
      } else {
        const target = sessions.get(targetSessionId);
        if (target) targets.push(target);
      }

      if (targets.length === 0) {
        throw new Error(`No active sessions found for target: ${targetSessionId}`);
      }

      const results = [];

      for (const session of targets) {
        try {
          const chatBtn = session.page.locator(
            'button[aria-label="open the chat panel"], button:has(span.footer-button-base__button-label:has-text("Chat"))'
          ).first();

          if (await chatBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await chatBtn.click();
            await session.page.waitForTimeout(400);
          }

          const editor = session.page.locator('div.tiptap.ProseMirror[contenteditable="true"]').first();
          await editor.waitFor({ state: 'visible', timeout: 5000 });
          await editor.click();
          await session.page.keyboard.type(content.text);

          const sendBtn = session.page.locator('button.chat-rtf-box__send[aria-label="send"]').first();
          if (await sendBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await sendBtn.click();
          } else {
            await session.page.keyboard.press('Enter');
          }

          ev.emit('messages.upsert', {
            sessionId: session.id,
            name: session.name,
            message: content.text,
            status: 'sent',
            timestamp: Date.now()
          });

          results.push({ id: session.id, success: true });
        } catch (err) {
          results.push({ id: session.id, success: false, error: err.message });
        }
      }

      return results;
    },

    /**
     * Get active participants memory store
     */
    getParticipants() {
      return Array.from(sessions.values()).map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status
      }));
    },

    /**
     * Disconnect a single session or all sessions
     * @param {string} [sessionId]
     */
    async end(sessionId) {
      if (sessionId) {
        const s = sessions.get(sessionId);
        if (s) {
          await s.context.close().catch(() => {});
          sessions.delete(sessionId);
          ev.emit('connection.update', { id: sessionId, status: 'close', timestamp: Date.now() });
        }
        return;
      }

      // Close all
      for (const [id, s] of sessions.entries()) {
        await s.context.close().catch(() => {});
        ev.emit('connection.update', { id, status: 'close', timestamp: Date.now() });
      }
      sessions.clear();

      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
      }
    }
  };
}

module.exports = { makeZoomSocket };
