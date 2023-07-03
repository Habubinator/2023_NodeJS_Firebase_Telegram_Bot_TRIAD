const TelegramBot = require('node-telegram-bot-api');
const token = '6271769906:AAHZpJDpkWpxnxWpi8PohIZp66ZZ-1AcAxk';
const bot = new TelegramBot(token, {polling: true});
const {initializeApp, cert} = require("firebase-admin/app")
const {getFirestore} = require("firebase-admin/firestore")
// const { getAnalytics } = require("firebase/analytics")
const serviceAccount = require('./triadFirebaseKey.json')

bot.on("polling_error", console.log);

initializeApp({
    credential: cert(serviceAccount)
})

const db = getFirestore()
module.exports = {db}

const usersDb = db.collection('users');

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id;
  const resp = match[1]; // the captured "whatever"

  // send back the matched "whatever" to the chat
  bot.sendMessage(chatId, resp);
});

// Matches "/echo [whatever]"
bot.onText(/\/start (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const resp = match[1]; // the captured "whatever"
  
    // send back the matched "whatever" to the chat
    bot.sendMessage(chatId, resp);
  });

// Listen for any kind of message. There are different kinds of
// messages.
bot.on('message', async (msg) => {
    if (!msg.from.is_bot) {
      console.log(msg);
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      createUser(userId);
      bot.sendMessage(chatId, 'Received your message');
    }
  });
  
  async function createUser(id) {
    try {
      const userJson = {
        id: id,
        age: 0,
        reputation: 0,
        language: 'RU'
      };
      const docRef = await usersDb.add(userJson);
      console.log('User created with ID:', docRef.id);
    } catch (error) {
      console.log('Error creating user:', error);
    }
  }