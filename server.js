const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { verifyChatToken } = require("./config/jwt");
const { addUser, removeUser, getUser } = require("./utils/users");
const { postMessageToSpring } = require("./utils/http");
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

// ✅ Online Users Map
const onlineUsers = new Map(); // userId -> Set(socketIds[])

// ✅ Authentication Middleware
// io.use((socket, next) => {
//     const token = socket.handshake.auth?.token;
//
//     if (!token) return next(new Error("No token provided"));
//
//     const user = verifyChatToken(token);
//     if (!user) return next(new Error("Invalid token"));
//
//     socket.userId = user.sub;
//     next();
// });
const jwt = require("jsonwebtoken");

// ✅ Use the Spring Boot secret
//const SPRING_SECRET = "TaK+HaV^uvCHEFsEVfypW#7g9^k*Z8$V"; // <-- put your real Spring JWT secret
const SPRING_SECRET = Buffer.from("TaK+HaV^uvCHEFsEVfypW#7g9^k*Z8$V").toString("base64");

io.use((socket, next) => {
    // const token = socket.handshake.auth?.token;
    // if (!token) return next(new Error("No token provided"));
    console.log("🔵 Incoming connection...");
    console.log("Auth data:", socket.handshake.auth);

    const token = socket.handshake.auth?.token;
    console.log("🔵 Extracted token:", token);

    if (!token) {
        console.log("🔴 No token provided");
        return next(new Error("No token provided"));
    }

    try {
        const user = jwt.verify(token, SPRING_SECRET);
        socket.userId = user.sub;  // ✅ email or user ID
        socket.springToken = token; // ✅ save original Spring JWT
        next();
    } catch (err) {
        return next(new Error("Invalid Spring JWT"));
    }
});


// ✅ Socket Connection
io.on("connection", (socket) => {
    const userId = socket.userId;
    console.log("✅ User connected:", userId);

    addUser(socket.id, userId);

    // ✅ Track online presence
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    io.emit("presence", { userId, online: true });

    // ✅ Join Chat Room
    socket.on("joinRoom", (chatId) => {
        socket.join(chatId);
        console.log(`✅ ${userId} joined room ${chatId}`);
    });

    // ✅ Send & Sync Message (Node → Spring)
    socket.on("sendMessage", async ({ chatId, message }) => {
        const senderId = getUser(socket.id);

        if (!senderId) return;

        const payload = {
            senderId,
            content: message,
        };

        // ✅ Send immediately to receivers through Socket.io
        io.to(chatId).emit("receiveMessage", {
            chatId,
            senderId,
            message,
            timestamp: new Date()
        });

        // ✅ Persist message to Spring Boot
        try {
            //await postMessageToSpring(chatId, payload, socket.handshake.auth?.token);
            await postMessageToSpring(chatId, payload, socket.springToken);
            console.log("✅ Message synced to Spring");
        } catch (e) {
            console.error("❌ Failed to sync message to Spring:", e.message);
        }
    });

    // ✅ Disconnect Event
    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", userId);

        removeUser(socket.id);

        const sockets = onlineUsers.get(userId);
        if (sockets) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
                onlineUsers.delete(userId);
                io.emit("presence", { userId, online: false });
            }
        }
    });
});

// ✅ Start Server
server.listen(process.env.PORT, () => {
    console.log("🚀 Chat service is running on port", process.env.PORT);
});

// 40{"token":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJyYWJpeWE3QGdtYWlsLmNvbSIsImlhdCI6MTc2MjUyODI2NywiZXhwIjoxNzYyNTMxODY3fQ.F7Jwhg1DPF6hIx9bbBUigkw_uUCSwawvd6bAViauR3g"}
//    42["joinRoom","690dcedfee650736609046cd"]

//   42["sendMessage", {"chatId":"690dcedfee650736609046cd","message":"Hello from Postman"}]
// ws://localhost:3001/socket.io/?EIO=4&transport=websocket ---> in the ws URL ( websocket )