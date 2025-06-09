const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const session = require('express-session'); // Add this for session support

const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const ADMIN_PASSWORD = "luckyyt623"; // Change this to your secret password

// Session middleware
app.use(session({
    secret: 'change_this_secret',
    resave: false,
    saveUninitialized: true
}));

// Middleware to parse JSON bodies
app.use(express.json());

// Serve your static files (index.html etc)
app.use(express.static('public'));

// Admin login route
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Invalid password' });
    }
});

// Admin panel route (requires login)
app.get('/admin', (req, res) => {
    if (req.session.isAdmin) {
        // Serve your admin panel HTML here (admin.html)
        res.sendFile(__dirname + '/public/admin.html');
    } else {
        res.status(401).send('Unauthorized');
    }
});

// Add your existing WebSocket and ticket logic here
// ...

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});