import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { config } from 'dotenv';
import cors from 'cors';
config();
const app = express();
const server = http.createServer(app);
// Add CORS headers to allow requests from neuralbms.automatacontrols.com
// Add CORS headers to allow requests from multiple domains
app.use(cors({
    origin: ['https://neuralbms.automatacontrols.com', 'http://143.198.162.31:3000'],
    methods: ['GET', 'POST'],
    credentials: true
}));

// Manually add Access-Control-Allow-Origin headers
app.use((req, res, next) => {
    const allowedOrigins = ['https://neuralbms.automatacontrols.com', 'http://143.198.162.31:3000'];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

// Update Socket.IO CORS configuration
const io = new Server(server, {
    path: '/socket.io',
    cors: {
        origin: ['https://neuralbms.automatacontrols.com', 'http://143.198.162.31:3000'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});
io.on('connection', (socket) => {
    console.log('Client connected');
    socket.on('bridgeMessage', (data) => {
        console.log('Received from client:', data);
        io.emit('bridgeMessage', data);
    });
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});
const PORT = process.env.PORT || 3099;
server.listen(PORT, () => {
    console.log(`Bridge server listening on port ${PORT}`);
});
