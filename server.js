const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// In-memory ticket store
const tickets = new Map(); // ticketId => { username, messages: [{ sender, text, timestamp }] }

// Admin password (very basic example, in production use proper auth)
const ADMIN_PASSWORD = 'myadminpassword';

// Serve static files from the 'public' directory (contains index.html and admin.html)
app.use(express.static('public'));

// WebSocket handling
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'create-ticket':
                    const ticketId = `ticket-${Date.now()}`;
                    tickets.set(ticketId, { username: data.username, messages: [] });
                    ws.send(JSON.stringify({ type: 'ticket-created', ticketId }));
                    console.log(`Ticket created: ${ticketId}`);
                    break;

                case 'ticket-message':
                    if (tickets.has(data.ticketId)) {
                        const ticket = tickets.get(data.ticketId);
                        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        ticket.messages.push({ sender: data.sender, text: data.text, timestamp });
                        // Broadcast message back to the user (in real world, you'd handle specific users)
                        ws.send(JSON.stringify({ type: 'ticket-message', ticketId: data.ticketId, sender: data.sender, text: data.text, timestamp }));
                    }
                    break;

                case 'admin-login':
                    if (data.password === ADMIN_PASSWORD) {
                        ws.isAdmin = true;
                        ws.send(JSON.stringify({ type: 'admin-login', success: true }));
                        console.log(`Admin logged in.`);
                    } else {
                        ws.send(JSON.stringify({ type: 'admin-login', success: false }));
                        console.log(`Admin login failed.`);
                    }
                    break;

                case 'get-tickets':
                    if (ws.isAdmin) {
                        const allTickets = [];
                        tickets.forEach((ticket, id) => {
                            allTickets.push({ ticketId: id, username: ticket.username, messages: ticket.messages });
                        });
                        ws.send(JSON.stringify({ type: 'all-tickets', tickets: allTickets }));
                    }
                    break;

                case 'admin-reply':
                    if (ws.isAdmin && tickets.has(data.ticketId)) {
                        const ticket = tickets.get(data.ticketId);
                        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        ticket.messages.push({ sender: 'Admin', text: data.text, timestamp });
                        // You could also broadcast this message to users, but for now let's keep it stored
                    }
                    break;
            }
        } catch (e) {
            console.error('Error:', e);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});