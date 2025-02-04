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
  res.sendFile(path.join(__dirname, 'qr.html'));
});

// Home page where users can choose the pairing method
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pʟᴀᴛɪɴᴜᴍ-V2 Pairing Methods</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          background: url('https://i.imgur.com/74NG4nf.jpeg') no-repeat center center/cover;
          color: white;
          margin-top: 50px;
        }
        h1 {
          font-size: 32px;
          margin-bottom: 30px;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.6);
        }
        a {
          display: inline-block;
          margin: 20px;
          padding: 20px;
          width: 250px;
          background: rgba(0, 0, 0, 0.5);
          color: white;
          text-decoration: none;
          border-radius: 10px;
          font-size: 18px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
          transition: all 0.3s ease;
        }
        a:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }
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
