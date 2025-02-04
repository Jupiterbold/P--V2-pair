// index.js

const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;

require('events').EventEmitter.defaultMaxListeners = 500;

// Import routes
const pairRoute = require('./pair');
const qrRoute = require('./qr');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (e.g., CSS, JS)
app.use(express.static(path.join(__dirname)));

// Routes

// Route for phone number pairing functionality
app.use('/code', pairRoute);

// Route for QR code pairing functionality
app.use('/qrCode', qrRoute);

// Route for 'pair.html' (Phone number method)
app.get('/pair', (req, res) => {
  res.sendFile(path.join(__dirname, 'pair.html'));
});

// Route for 'Qr.html' (QR code method)
app.get('/qr', (req, res) => {
  res.sendFile(path.join(__dirname, 'Qr.html'));
});

// Home page where users can choose the pairing method
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pʟᴀᴛɪɴᴜᴍ-V2 Pairing Methods</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background-color: #f0f0f0; }
        h1 { color: #333; }
        a {
          display: inline-block;
          margin: 20px;
          padding: 20px;
          width: 200px;
          background-color: #4CAF50;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          font-size: 18px;
        }
        a:hover { background-color: #45a049; }
      </style>
    </head>
    <body>
      <h1>Select Pairing Method</h1>
      <a href="/pair">Pair via Phone Number</a>
      <a href="/qr">Pair via QR Code</a>
    </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`⏩ Server running on http://localhost:${PORT}`);
});

module.exports = app;
