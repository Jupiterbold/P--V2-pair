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
  // Clear previous session files before starting a fresh pairing process
  removeFile('./session');

  // Capture and sanitize the provided number (if any)
  let providedNumber = req.query.number ? req.query.number.replace(/[^0-9]/g, '') : null;
  
  async function PrabathPair() {
    // Create a new auth state instance with a fresh session folder.
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    try {
      let PrabathPairWeb = makeWASocket({
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

      // If the phone pairing path is used and the client is not registered, request a pairing code.
      if (!PrabathPairWeb.authState.creds.registered) {
        await delay(1500);
        if (providedNumber) {
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

      // Save credentials on updates.
      PrabathPairWeb.ev.on('creds.update', saveCreds);

      // Monitor connection changes.
      PrabathPairWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
          try {
            // Wait for the connection to stabilize.
            await delay(10000);
            const authPath = './session/';
            // Determine the target jid for sending the session info.
            let targetJid;
            if (providedNumber) {
              // Form a WhatsApp jid from the provided number (ensure it is in international format).
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

            // Upload the session file to MEGA.
            const mega_url = await upload(
              fs.createReadStream(authPath + 'creds.json'),
              `${randomMegaId()}.json`
            );

            // Extract a session ID from the MEGA URL.
            const sessionId = mega_url.replace('https://mega.nz/file/', '');

            // Send the session ID to the appropriate WhatsApp jid.
            await PrabathPairWeb.sendMessage(targetJid, { text: sessionId });
            console.log(`Session ID sent to ${targetJid}`);

          } catch (e) {
            console.error("Error during connection open:", e);
            exec('pm2 restart prabath');
          }

          await delay(100);
          // Clear session files.
          removeFile('./session');

          // Attempt to fully logout/close the socket so that a new pairing can occur.
          if (typeof PrabathPairWeb.logout === "function") {
            try {
              await PrabathPairWeb.logout();
              console.log("Logged out successfully.");
            } catch (logoutErr) {
              console.error("Logout error:", logoutErr);
              // If logout fails, force close the websocket connection.
              if (PrabathPairWeb.ws) PrabathPairWeb.ws.close();
            }
          } else {
            if (PrabathPairWeb.ws) PrabathPairWeb.ws.close();
          }
          return; // End processing after successful pairing.
        } else if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode !== 401
        ) {
          // If the disconnection is temporary, try pairing again after a delay.
          await delay(10000);
          PrabathPair();
        }
      });
    } catch (err) {
      console.error("Pairing error:", err);
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