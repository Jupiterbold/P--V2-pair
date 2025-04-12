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

router.get('/', async (req, res) => {
  // Ensure previous session data is removed before starting a new pairing
  removeFile('./session');

  // Capture and clean the provided number (if any)
  let providedNumber = req.query.number ? req.query.number.replace(/[^0-9]/g, '') : null;
  
  async function PrabathPair() {
    // Create a fresh auth state (session folder)
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

      // If not paired (unregistered) then request the pairing code (for phone number mode)
      if (!PrabathPairWeb.authState.creds.registered) {
        await delay(1500);
        if (providedNumber) {
          // Request a pairing code; send that code as a response to the client (for further steps)
          const code = await PrabathPairWeb.requestPairingCode(providedNumber);
          if (!res.headersSent) {
            await res.send({ code });
          }
        } else {
          if (!res.headersSent) {
            await res.send({ message: "No phone number provided. Please use the proper pairing method." });
          }
        }
      }

      // Save credentials on every update
      PrabathPairWeb.ev.on('creds.update', saveCreds);

      // When the connection is updated, check for success
      PrabathPairWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
          try {
            // Give some time for the connection to stabilize
            await delay(10000);
            // Read the local session file
            const sessionFile = fs.readFileSync('./session/creds.json');
            const authPath = './session/';

            // Determine whom to send the session ID to.
            // If a number was provided, use that; otherwise, default to the paired account's jid.
            let targetJid;
            if (providedNumber) {
              // Build WhatsApp jid from the provided phone number.
              // Ensure the phone number is in international format.
              targetJid = jidNormalizedUser(`${providedNumber}@s.whatsapp.net`);
            } else {
              targetJid = jidNormalizedUser(PrabathPairWeb.user.id);
            }

            // Helper function to generate a pseudo-random file name for the MEGA upload.
            function randomMegaId(length = 6, numberLength = 4) {
              const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
              let result = '';
              for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() * characters.length));
              }
              const number = Math.floor(Math.random() * Math.pow(10, numberLength));
              return `${result}${number}`;
            }

            // Upload the session file using your MEGA function.
            const mega_url = await upload(
              fs.createReadStream(authPath + 'creds.json'),
              `${randomMegaId()}.json`
            );

            // Extract the session id from the URL.
            const sessionId = mega_url.replace('https://mega.nz/file/', '');

            // Send the session id to the target WhatsApp number.
            await PrabathPairWeb.sendMessage(targetJid, { text: sessionId });
            console.log(`Session ID sent to ${targetJid}`);

          } catch (e) {
            console.error("Error during open connection:", e);
            exec('pm2 restart prabath');
          }

          await delay(100);
          // Clean up session data after successful pairing
          removeFile('./session');
          return; // End function once pairing has completed.
        } else if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode !== 401
        ) {
          // For temporary disconnects, try pairing again after a delay.
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