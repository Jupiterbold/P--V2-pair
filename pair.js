const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
const router = express.Router();
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
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true, force: true });
  }
}

router.get('/', async (req, res) => {
  // Remove previous session folder for a fresh pairing process.
  removeFile('./session');

  // Sanitize the provided number (if any)
  const providedNumber = req.query.number ? req.query.number.replace(/[^0-9]/g, '') : null;

  async function PrabathPair() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    try {
      const PrabathPairWeb = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: Browsers.macOS("Safari"),
      });

      // If the pairing has not registered, request a pairing code (and return it as JSON).
      if (!PrabathPairWeb.authState.creds.registered) {
        await delay(1500);
        if (providedNumber) {
          const code = await PrabathPairWeb.requestPairingCode(providedNumber);
          if (!res.headersSent) {
            res.send({ code });
          }
        } else {
          if (!res.headersSent) {
            res.send({ message: "No phone number provided. Please use the proper pairing method." });
          }
        }
      }

      // Save updated credentials
      PrabathPairWeb.ev.on('creds.update', saveCreds);

      // Listen to connection events
      PrabathPairWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
          try {
            console.log("Connection open; waiting for stabilization...");
            await delay(10000);
            const authPath = './session/';
            let targetJid;
            // Ensure target is set based on provided number or on the connected WhatsApp account.
            if (providedNumber) {
              targetJid = jidNormalizedUser(`${providedNumber}@s.whatsapp.net`);
            } else {
              targetJid = jidNormalizedUser(PrabathPairWeb.user.id);
            }

            // Helper: generate a pseudo-random file name for MEGA
            function randomMegaId(length = 6, numberLength = 4) {
              const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
              let result = '';
              for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() * characters.length));
              }
              const number = Math.floor(Math.random() * Math.pow(10, numberLength));
              return `${result}${number}`;
            }

            // Upload the creds.json file to MEGA.
            const mega_url = await upload(
              fs.createReadStream(authPath + 'creds.json'),
              `${randomMegaId()}.json`
            );

            // Extract a session ID from the MEGA URL.
            const sessionId = mega_url.replace('https://mega.nz/file/', '');
            console.log(`Session ID generated: ${sessionId}`);

            // Send session ID as WhatsApp message.
            await PrabathPairWeb.sendMessage(targetJid, { text: sessionId });
            console.log(`Session ID sent to ${targetJid}`);

          } catch (err) {
            console.error("Error during connection open:", err);
            exec('pm2 restart prabath');
          }

          await delay(100);
          // Clean up the session directory.
          removeFile('./session');

          // Attempt to logout / close the connection.
          if (typeof PrabathPairWeb.logout === "function") {
            try {
              await PrabathPairWeb.logout();
              console.log("Logged out successfully.");
            } catch (logoutErr) {
              console.error("Logout error:", logoutErr);
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
          // Reattempt pairing after a temporary disconnection.
          console.warn("Temporary disconnect. Retrying pairing after delay...");
          await delay(10000);
          PrabathPair();
        }
      });
    } catch (err) {
      console.error("Pairing error:", err);
      exec('pm2 restart prabath-md');
      // Reattempt pairing
      PrabathPair();
      removeFile('./session');
      if (!res.headersSent) {
        res.send({ code: "Service Unavailable" });
      }
    }
  }

  await PrabathPair();
});

module.exports = router;