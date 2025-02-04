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
app.use('/code', pairRoute);
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
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Arial', sans-serif;
        }
        body {
          background: url('https://i.imgur.com/74NG4nf.jpeg') no-repeat center center/cover;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          text-align: center;
        }
        .header {
          font-size: 24px;
          font-weight: bold;
          background: linear-gradient(45deg, #ff6ec4, #7873f5, #00d4ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 15px;
          padding: 30px;
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        a {
          display: inline-block;
          margin: 15px;
          padding: 15px 25px;
          background-color: #25d366;
          color: white;
          text-decoration: none;
          border-radius: 10px;
          font-size: 18px;
          box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.3);
        }
        a:hover {
          background-color: #128C7E;
        }
        .footer {
          font-size: 14px;
          margin-top: 30px;
          font-weight: bold;
          background: linear-gradient(45deg, #ff0000, #ff7300, #ffeb00, #48ff00, #00ffd9, #006aff, #cc00ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: rainbowText 4s infinite alternate;
        }
        @keyframes rainbowText {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="header">Pʟᴀᴛɪɴᴜᴍ-V2 Pairing</div>
      <div class="container">
        <h2>Select Pairing Method</h2>
        <a href="/pair">Pair via Phone Number</a>
        <a href="/qr">Pair via QR Code</a>
      </div>
      <div class="footer">Made by Jupiterbold</div>
    </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`⏩ Server running on http://localhost:${PORT}`);
});

module.exports = app;
