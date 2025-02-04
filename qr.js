// qr.js

const express = require('express');
const router = express.Router();
const fs = require('fs');
const { exec } = require("child_process");
const pino = require("pino");
const qrcode = require('qrcode');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  DisconnectReason,
  jidNormalizedUser
} = require("@whiskeysockets/baileys");
const { upload } = require('./mega'); // Ensure you have 'mega.js' with the 'upload' function

function removeFile(FilePath) {
  if (fs.existsSync(FilePath)) {
    fs.rmSync(FilePath, { recursive: true, force: true });
  }
}

router.get('/', async (req, res) => {
  async function startPairing() {
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    try {
      const socket = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "fatal" }).child({ level: "fatal" })
          ),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: Browsers.macOS("Safari"),
      });

      socket.ev.on('creds.update', saveCreds);

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Send the QR code data to the client
          if (!res.headersSent) {
            qrcode.toDataURL(qr, (err, url) => {
              if (err) {
                console.error('Failed to generate QR code', err);
                res.status(500).send({ error: 'Failed to generate QR code' });
              } else {
                res.send({ qr: url });
              }
            });
          }
        }

        if (connection === 'open') {
          try {
            await delay(5000);

            const auth_path = './session/';
            const user_jid = jidNormalizedUser(socket.user.id);

            function randomMegaId(length = 6, numberLength = 4) {
              const prefix = 'PLATINUM-V2';
              const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
              let result = '';
              for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() * characters.length));
              }
              const number = Math.floor(Math.random() * Math.pow(10, numberLength));
              return `${prefix}${result}${number}`;
            }

            const mega_url = await upload(
              fs.createReadStream(auth_path + 'creds.json'),
              `${randomMegaId()}.json`
            );

            const string_session = mega_url.replace('https://mega.nz/file/', '');

            const sid = string_session;

            await socket.sendMessage(user_jid, {
              text: sid
            });

          } catch (e) {
            console.error('Error during connection open handling', e);
            exec('pm2 restart prabath');
          }

          await delay(100);
          await removeFile('./session');
          // Do not exit the process here
        } else if (connection === 'close') {
          const reason = lastDisconnect?.error?.output?.statusCode;
          console.log('Disconnected, reason:', reason);
          if (reason !== DisconnectReason.loggedOut) {
            // Reconnect if not logged out
            await delay(5000);
            startPairing();
          } else {
            // Logged out, clean up
            await removeFile('./session');
            console.log('Logged out');
            // Do not exit the process
          }
        }
      });
    } catch (err) {
      console.error('Error in startPairing', err);
      exec('pm2 restart prabath-md');
      await removeFile('./session');
      if (!res.headersSent) {
        res.status(503).send({ error: 'Service Unavailable' });
      }
    }
  }

  await startPairing();
});

process.on('uncaughtException', function (err) {
  console.error('Caught exception:', err);
  exec('pm2 restart prabath');
});

module.exports = router;
    
