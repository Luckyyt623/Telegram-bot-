const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// In-memory store for users and tickets
const users = new Map();            // Map: ws => { username }
const tickets = new Map();          // Map: ticketId => { ownerWs, messages: [] }

// Health check route
app.get('/', (req, res) => {
  res.send('Ticket WebSocket Server is running!');
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);

      switch (data.type) {
        case 'user-join':
          handleUserJoin(ws, data.username);
          break;
        case 'create-ticket':
          handleCreateTicket(ws);
          break;
        case 'ticket-message':
          handleTicketMessage(ws, data.ticketId, data.text);
          break;
        case 'close-ticket':
          handleCloseTicket(ws, data.ticketId);
          break;
      }
    } catch (err) {
      console.error('Error:', err);
      ws.send(JSON.stringify({ type: 'error', text: 'Error parsing message.' }));
    }
  });

  ws.on('close', () => {
    const user = users.get(ws);
    if (user) {
      console.log(`Client disconnected: ${user.username}`);
      users.delete(ws);
    }
  });
});

function handleUserJoin(ws, username) {
  users.set(ws, { username });
  ws.send(JSON.stringify({ type: 'system-message', text: `Welcome, ${username}!` }));
}

function handleCreateTicket(ws) {
  const user = users.get(ws);
  if (!user) return;
  const ticketId = `ticket-${Date.now()}`;
  tickets.set(ticketId, { ownerWs: ws, messages: [] });
  ws.send(JSON.stringify({ type: 'ticket-created', ticketId }));
  console.log(`Ticket created for ${user.username}: ${ticketId}`);
}

function handleTicketMessage(ws, ticketId, text) {
  const ticket = tickets.get(ticketId);
  if (!ticket) {
    ws.send(JSON.stringify({ type: 'error', text: 'Ticket not found.' }));
    return;
  }
  const user = users.get(ws);
  const timestamp = new Date().toLocaleTimeString();
  const messageData = {
    type: 'ticket-message',
    username: user.username,
    text,
    timestamp,
    ticketId
  };

  // Send to ticket owner
  if (ticket.ownerWs.readyState === WebSocket.OPEN) {
    ticket.ownerWs.send(JSON.stringify(messageData));
  }

  // Send to admin (server operator)
  wss.clients.forEach(client => {
    if (client !== ticket.ownerWs && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ ...messageData, isAdmin: true }));
    }
  });
}

function handleCloseTicket(ws, ticketId) {
  const ticket = tickets.get(ticketId);
  if (!ticket) {
    ws.send(JSON.stringify({ type: 'error', text: 'Ticket not found.' }));
    return;
  }
  if (ticket.ownerWs === ws) {
    tickets.delete(ticketId);
    ws.send(JSON.stringify({ type: 'system-message', text: `Ticket ${ticketId} closed.` }));
    console.log(`Ticket closed: ${ticketId}`);
  } else {
    ws.send(JSON.stringify({ type: 'error', text: 'You are not authorized to close this ticket.' }));
  }
}

// Start the server
server.listen(PORT, () => {
  console.log(`WebSocket server running on ws://0.0.0.0:${PORT}`);
});