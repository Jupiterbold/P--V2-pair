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
app.use(express.static(path.join(__dirname))); // Serve static files (CSS, JS, etc.)

// Routes for pairing
app.use('/code', pairRoute);  
app.use('/qrCode', qrRoute);  

// Serve the pairing pages
app.get('/pair', (req, res) => res.sendFile(path.join(__dirname, 'pair.html')));
app.get('/qr', (req, res) => res.sendFile(path.join(__dirname, 'qr.html')));

// Home Page - Full-screen, responsive layout
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pʟᴀᴛɪɴᴜᴍ-V2 Pairing Methods</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
        body { 
          background: url('https://i.imgur.com/74NG4nf.jpeg') no-repeat center center/cover; 
          height: 100vh; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center; 
          text-align: center; 
          color: white;
        }
        .container {
          background: rgba(0, 0, 0, 0.6);
          padding: 25px;
          border-radius: 15px;
          width: 90%;
          max-width: 400px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
        }
        h1 {
          font-size: 24px;
          margin-bottom: 20px;
        }
        .option {
          display: block;
          background: linear-gradient(135deg, #25d366, #128C7E);
          color: white;
          text-decoration: none;
          padding: 15px;
          border-radius: 10px;
          font-size: 18px;
          margin: 10px 0;
          transition: 0.3s;
        }
        .option:hover {
          background: linear-gradient(135deg, #128C7E, #075e54);
          transform: scale(1.05);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Select Pairing Method</h1>
        <a href="/pair" class="option">📞 Pair via Phone Number</a>
        <a href="/qr" class="option">📷 Pair via QR Code</a>
      </div>
    </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

module.exports = app;
