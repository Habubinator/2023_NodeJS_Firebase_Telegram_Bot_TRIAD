const TelegramBot = require('node-telegram-bot-api');
const token = '6271769906:AAHZpJDpkWpxnxWpi8PohIZp66ZZ-1AcAxk';
const bot = new TelegramBot(token, {polling: true});

var testdb = {
    users: {
        user_1: {
            id: "1",
            age: 18,
            reputation : 10 
        }
    },
    chats: {
        chat1: {
            first_person_id : "1",
            second_person_id : "2",
            thirs_person_id : "3"  
        },
        chat2: {
            first_person_id : "4",
            second_person_id : "5",
            thirs_person_id : "6"  
        }
    }
}

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
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  // send a message to the chat acknowledging receipt of their message
  bot.sendMessage(chatId, 'Received your message');
});