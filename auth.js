const bcrypt = require('bcrypt');
const saltRounds = 10; // Adjust for performance vs. security trade-off

// In-memory storage for users (username -> {hash})
const users = {};

async function hashPassword(password) {
  return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

async function registerUser(newUsername, newPassword) {
        const hashedPassword = await hashPassword(newPassword);
        users[newUsername] = { hash: hashedPassword };
        console.log("User registered successfully!");
        return true;
}

async function authenticateUser(username, password) {
  if (users[username]) {
    const hashedPassword = users[username].hash;
      if(await verifyPassword(password, hashedPassword))
    {
      return true; // Authentication successful
    }
  }
  return false; // Authentication failed
}


module.exports = {
  registerUser,
  authenticateUser,
};