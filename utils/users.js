const users = new Map(); // socketId → userId

function addUser(socketId, userId) {
    users.set(socketId, userId);
}

function removeUser(socketId) {
    users.delete(socketId);
}

function getUser(socketId) {
    return users.get(socketId);
}

module.exports = {
    addUser,
    removeUser,
    getUser
};
