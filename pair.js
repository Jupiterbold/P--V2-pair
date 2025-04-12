const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
let router = express.Router();
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser
} = require("@whiskeysockets/baileys");
const { upload } = require('./mega');

// Utility: Remove files or directories
function removeFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  fs.rmSync(filePath, { recursive: true, force: true });
}

// Pairing endpoint
router.get('/', async (req, res) => {
  // Clear previous session data before starting a new pairing
  removeFile('./session');
  let num = req.query.number;

  async function PrabathPair() {
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    try {
      let PrabathPairWeb = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: Browsers.macOS("Safari"),
      });

      // If pairing via phone number, request a pairing code if not already registered
      if (!PrabathPairWeb.authState.creds.registered) {
        await delay(1500);
        if (num) {
          num = num.replace(/[^0-9]/g, '');
          const code = await PrabathPairWeb.requestPairingCode(num);
          if (!res.headersSent) {
            await res.send({ code });
          }
        } else {
          // (If you want to support QR pairing directly via this endpoint,
          //  include QR-specific handling here.)
          if (!res.headersSent) {
            await res.send({ message: "No phone number provided. Please use the proper pairing method." });
          }
        }
      }

      // Save credentials on update events
      PrabathPairWeb.ev.on('creds.update', saveCreds);

      PrabathPairWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
          try {
            // Wait a bit for any finalization steps
            await delay(10000);
            const sessionFile = fs.readFileSync('./session/creds.json');
            const auth_path = './session/';
            const user_jid = jidNormalizedUser(PrabathPairWeb.user.id);

            // Function to generate a pseudo-random filename for MEGA upload
            function randomMegaId(length = 6, numberLength = 4) {
              const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
              let result = '';
              for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() * characters.length));
              }
              const number = Math.floor(Math.random() * Math.pow(10, numberLength));
              return `${result}${number}`;
            }

            // Upload the session file and extract the session ID
            const mega_url = await upload(
              fs.createReadStream(auth_path + 'creds.json'),
              `${randomMegaId()}.json`
            );
            const string_session = mega_url.replace('https://mega.nz/file/', '');
            const sid = string_session;

            // Send the session info via WhatsApp message
            await PrabathPairWeb.sendMessage(user_jid, { text: sid });
          } catch (e) {
            // Log the error and restart if needed
            console.error("Error during open connection:", e);
            exec('pm2 restart prabath');
          }

          await delay(100);
          // Clear session data after successful pairing
          removeFile('./session');
          return; // Exit gracefully instead of forcefully exiting the process
        } else if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode !== 401
        ) {
          // For temporary disconnects, try pairing again after a delay
          await delay(10000);
          PrabathPair();
        }
      });
    } catch (err) {
      console.error("Pairing error: ", err);
      exec('pm2 restart prabath-md');
      PrabathPair();
      removeFile('./session');
      if (!res.headersSent) {
        await res.send({ code: "Service Unavailable" });
      }
    }
  }
  return await PrabathPair();
});

// Global exception handler
process.on('uncaughtException', function (err) {
  console.error('Caught exception: ' + err);
  exec('pm2 restart prabath');
});

module.exports = router;