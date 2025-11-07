const axios = require("axios");

//const API_BASE = "http://localhost:8080/api/chat";

async function postMessageToSpring(chatId, message, token) {
    return axios.post(
        `http://localhost:8080/api/chats/${chatId}/messages`,
        message,
        {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        }
    );
}

module.exports = { postMessageToSpring };
