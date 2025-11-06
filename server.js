const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { verifyChatToken } = require("./config/jwt");
const { addUser, removeUser, getUser } = require("./utils/users");
require("dotenv").config();

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ✅ When a client connects
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) return next(new Error("No token provided"));

    const user = verifyChatToken(token);
    if (!user) return next(new Error("Invalid token"));

    socket.userId = user.sub;
    next();
});

io.on("connection", (socket) => {
    console.log("User connected:", socket.userId);

    addUser(socket.id, socket.userId);

    // ✅ Join room by chatId
    socket.on("joinRoom", (chatId) => {
        socket.join(chatId);
        console.log(`User ${socket.userId} joined room ${chatId}`);
    });

    // ✅ Send message
    socket.on("sendMessage", ({ chatId, message }) => {
        const senderId = getUser(socket.id);

        io.to(chatId).emit("receiveMessage", {
            chatId,
            senderId,
            message,
            timestamp: new Date()
        });
    });

    // ✅ On disconnect
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.userId);
        removeUser(socket.id);
    });
});

server.listen(process.env.PORT, () => {
    console.log("✅ Chat service running on port", process.env.PORT);
});
