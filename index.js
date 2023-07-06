const TelegramBot = require('node-telegram-bot-api');
const token = '6271769906:AAHZpJDpkWpxnxWpi8PohIZp66ZZ-1AcAxk';
const bot = new TelegramBot(token, {polling: true});
const {initializeApp, cert} = require("firebase-admin/app")
const {getFirestore} = require("firebase-admin/firestore")
// const { getAnalytics } = require("firebase/analytics")
const serviceAccount = require('./triadFirebaseKey.json')

// Имплементация очереди, для оптимизации поиска

class Queue {
  constructor() {
    this.elements = {};
    this.head = 0;
    this.tail = 0;
  }
  enqueue(element) {
    this.elements[this.tail] = element;
    this.tail++;
  }
  dequeue() {
    const item = this.elements[this.head];
    delete this.elements[this.head];
    this.head++;
    return item;
  }
  peek() {
    return this.elements[this.head];
  }
  get length() {
    return this.tail - this.head;
  }
  get isEmpty() {
    return this.length === 0;
  }
}

// Классы очереди и пользователя в очереди с заделом на будущее

class userQueue{
  constructor(){
    this.queue = new Queue()
  }

  add(id){
    this.queue.enqueue(new waitUser(id));
  }

  find(){
    
  }
  
}

class waitUser{
  constructor(id){
    this.id = id;
  }
}

// Запуск бота

bot.on("polling_error", console.log);

initializeApp({
    credential: cert(serviceAccount)
})

const db = getFirestore()
module.exports = {db}

const usersDb = db.collection('users');

// // Matches "/echo [whatever]"
// bot.onText(/\/echo (.+)/, (msg, match) => {
//   // 'msg' is the received Message from Telegram
//   // 'match' is the result of executing the regexp above on the text content
//   // of the message

//   const chatId = msg.chat.id;
//   const resp = match[1]; // the captured "whatever"

//   // send back the matched "whatever" to the chat
//   bot.sendMessage(chatId, resp);
// });

// // Matches "/echo [whatever]"
// bot.onText(/\/start (.+)/, (msg, match) => {

//     const chatId = msg.chat.id;
//     const resp = match[1]; // the captured "whatever"
  
//     // send back the matched "whatever" to the chat
//     bot.sendMessage(chatId, resp);
//   });

// Когда приходит сообщение боту, то оно встает в очередь в самом API 

bot.on('message', async (msg) => {
    if (!msg.from.is_bot) {
      console.log(msg);
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      createUser(userId);
      bot.sendMessage(chatId, 'Received your message');
    }
  });
  
// Добавление пользователя в бд 

async function createUser(id) {
    try {
      const userJson = {
        id: id,
        age: 0,
        reputation: 0,
        language: 'RU'
      };
      if(await checkUserNew(id)){
        const docRef = await usersDb.add(userJson);
        console.log('User created with ID:', docRef.id);
      }
    } catch (error) {
      console.log('Error creating user:', error);
    }
  }

// Проверка есть ли пользователь в бд

async function checkUserNew(id){
  try{
    usersDb.get().then((querySnapshot) => {
      querySnapshot.forEach((userDoc) => {
          if (userDoc.data().id == id){
            return false;
          }
      })
      return true;
  })
  }catch(error){
    console.log(error)
  }
}