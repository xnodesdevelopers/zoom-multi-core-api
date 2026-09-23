/**
 * Zoom Multi-Session Baileys-style Socket Engine (Non-Blocking Edition)
 * Resilient to Zoom SPA modals and dynamic DOM rendering
 * @author Tharindu Liyanage (Sanku)
 * @license MIT
 */
const { EventEmitter } = require('events');
const { chromium } = require('playwright');
const os = require('os');
const fs = require('fs');

function resolveChromiumPath() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
  const platform = os.platform();
  if (platform === 'win32') {
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    return winPaths.find(p => fs.existsSync(p)) || null;
  }
  if (platform === 'linux') {
    const linuxPaths = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome-stable'];
    return linuxPaths.find(p => fs.existsSync(p)) || null;
  }
  return null;
}

function makeZoomSocket(config = {}) {
  const ev = new EventEmitter();
  const headless = config.headless ?? true;
  const chromiumPath = config.chromiumPath || resolveChromiumPath();
  const joinDelayMs = config.joinDelayMs ?? 9000; // ← increased default (was 4000)
  const sessions = new Map();

  const connectParticipant = async ({ sessionId, meetingId, name, passcode = '' }) => {
    let browser = null;
    let context = null;

    try {
      ev.emit('connection.update', {
        id: sessionId,
        name,
        status: 'connecting',
        timestamp: Date.now()
      });

      // Slight fingerprint variation so sequential joins look less bot-like
      const viewports = [
        { width: 1280, height: 720 },
        { width: 1366, height: 768 },
        { width: 1440, height: 900 },
        { width: 1536, height: 864 }
      ];
      const viewport = viewports[Math.floor(Math.random() * viewports.length)];

      browser = await chromium.launch({
        headless,
        executablePath: chromiumPath || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--mute-audio',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      context = await browser.newContext({
        viewport,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        permissions: ['microphone', 'camera'],
        locale: 'en-US'
      });

      const page = await context.newPage();

      await page.addInitScript(() => {
        delete Object.getPrototypeOf(navigator).webdriver;
        window.chrome = { runtime: {} };
      });

      // Filter non-essential assets
      await page.route('**/*', async (route) => {
        const type = route.request().resourceType();
        if (['media', 'font'].includes(type)) {
          await route.abort();
        } else {
          await route.continue();
        }
      });

      const cleanId = meetingId.toString().replace(/\s+/g, '');
      const joinUrl = `https://app.zoom.us/wc/${cleanId}/join`;

      await page.goto(joinUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });

      // 1. OneTrust / Cookies
      const cookieBtn = page.locator('#onetrust-accept-btn-handler');
      if (await cookieBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await cookieBtn.click().catch(() => {});
      }

      // 2. Terms
      const tosAcceptBtn = page.locator('#wc_agree1, button:has-text("I Agree"), button:has-text("Agree")').first();
      if (await tosAcceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tosAcceptBtn.click().catch(() => {});
      }

      // 3. Name
      const nameInput = page.locator('input#input-for-name, input[name="user_name"]').first();
      await nameInput.waitFor({ state: 'visible', timeout: 15000 });
      await nameInput.fill('');
      await nameInput.type(name, { delay: 25 + Math.random() * 30 });

      // 4. Passcode
      const pwdInput = page.locator('input#input-for-pwd, input[name="password"]').first();
      if (await pwdInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        if (passcode) {
          await pwdInput.fill('');
          await pwdInput.type(passcode, { delay: 25 });
        }
      }

      // 5. Join click
      const joinBtn = page.locator('button.preview-join-button, button.zm-btn__outline--blue, button:has-text("Join")').first();
      await joinBtn.waitFor({ state: 'visible', timeout: 8000 });
      await joinBtn.click({ force: true });

      // 6. Secondary passcode modal
      const secondaryPwd = page.locator('#input-for-pwd, input[placeholder="Meeting Passcode"]').first();
      if (await secondaryPwd.isVisible({ timeout: 3000 }).catch(() => false)) {
        if (passcode) {
          await secondaryPwd.fill(passcode);
          const modalJoin = page.locator('button:has-text("Join"), button.zm-btn--primary').first();
          await modalJoin.click({ force: true }).catch(() => {});
        }
      }

      // 7. Audio / permission modals (non-blocking)
      for (let i = 0; i < 6; i++) {
        const audioModalBtn = page.locator([
          'button:has-text("Join Audio by Computer")',
          'button:has-text("Computer Audio")',
          'button.join-audio-by-voip__join-btn',
          'button:has-text("Continue without microphone and camera")',
          '.pepc-permission-dialog__footer-button'
        ].join(',')).first();

        if (await audioModalBtn.isVisible({ timeout: 1200 }).catch(() => false)) {
          await audioModalBtn.click({ force: true }).catch(() => {});
          break;
        }
        await page.waitForTimeout(800);
      }

      // 8. Confirm we actually joined (this was missing before)
      // Wait for either the chat button or the main meeting footer
      const joinedIndicator = page.locator(
        'button[aria-label="open the chat panel"], ' +
        'button:has(span.footer-button-base__button-label:has-text("Chat")), ' +
        '.footer-button-base__button-label, ' +
        '[class*="meeting-client"]'
      ).first();

      await joinedIndicator.waitFor({ state: 'visible', timeout: 25000 });

      // Extra settle time
      await page.waitForTimeout(2500);

      const sessionData = {
        id: sessionId,
        name,
        browser,
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
      if (browser) await browser.close().catch(() => {});
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

    async join({ meetingId, passcode = '', participants = [] }) {
      if (!meetingId || !participants.length) {
        throw new Error('meetingId and participants array are required');
      }

      const results = [];

      for (let i = 0; i < participants.length; i++) {
        const name = participants[i];
        const sessionId = `zoom_session_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;

        console.log(`[Zoom] Joining participant ${i + 1}/${participants.length}: ${name}`);

        const res = await connectParticipant({ sessionId, meetingId, name, passcode });
        results.push(res);

        // Longer + slightly randomized delay between participants
        if (i < participants.length - 1) {
          const delay = joinDelayMs + Math.floor(Math.random() * 2500);
          console.log(`[Zoom] Waiting ${Math.round(delay / 1000)}s before next participant...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }

      return results;
    },

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

      const results = [];
      for (const session of targets) {
        try {
          const chatBtn = session.page.locator(
            'button[aria-label="open the chat panel"], button:has(span.footer-button-base__button-label:has-text("Chat"))'
          ).first();

          if (await chatBtn.isVisible({ timeout: 3500 }).catch(() => false)) {
            await chatBtn.click();
            await session.page.waitForTimeout(600);
          }

          const editor = session.page.locator('div.tiptap.ProseMirror[contenteditable="true"]').first();
          await editor.waitFor({ state: 'visible', timeout: 8000 });
          await editor.click();
          await session.page.keyboard.type(content.text, { delay: 15 });

          const sendBtn = session.page.locator('button.chat-rtf-box__send[aria-label="send"]').first();
          if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
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

    getParticipants() {
      return Array.from(sessions.values()).map(s => ({
        id: s.id,
        name: s.name,
        status: s.status
      }));
    },

    async end(sessionId) {
      if (sessionId) {
        const s = sessions.get(sessionId);
        if (s) {
          await s.browser.close().catch(() => {});
          sessions.delete(sessionId);
          ev.emit('connection.update', { id: sessionId, status: 'close', timestamp: Date.now() });
        }
        return;
      }
      for (const [id, s] of sessions.entries()) {
        await s.browser.close().catch(() => {});
        ev.emit('connection.update', { id, status: 'close', timestamp: Date.now() });
      }
      sessions.clear();
    }
  };
}

module.exports = { makeZoomSocket };
