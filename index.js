const TelegramBot = require('node-telegram-bot-api');
const token = '6271769906:AAHZpJDpkWpxnxWpi8PohIZp66ZZ-1AcAxk';
const bot = new TelegramBot(token, {polling: true});
bot.setMyCommands([{ command: '/start', description: 'Найти чат' },
                   { command: '/next', description: 'Завершить этот чат и найти следующий (НЕ РАБОТАЕТ)' }])
const {initializeApp, cert} = require("firebase-admin/app")
const {getFirestore} = require("firebase-admin/firestore")
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

class UserQueue{
  constructor(){
    this.queue = new Queue()
  }

  add(id){
    this.queue.enqueue(new WaitUser(id));
  }

  find(){
    let arrayOfFoundPeople = [this.queue.dequeue(),
                              this.queue.dequeue(),
                              this.queue.dequeue()]
    return arrayOfFoundPeople;
  }
  
  checkIfCouldBeInitialized(){
    if(this.queue.length >=3){
      return true;
    }
    return false;
  }
}

class WaitUser{
  constructor(id){
    this.id = id;
  }
}

class Chat{
  constructor(listOfPeople){
    this.listOfPeople = listOfPeople
  }
}

// Запуск бота

bot.on("polling_error", console.log);

initializeApp({
    credential: cert(serviceAccount)
})

const db = getFirestore()
var userQueue = new UserQueue();
var chatList = [];
module.exports = {db}

const usersDb = db.collection('users');

// Когда приходит сообщение боту, то оно встает в очередь в самом API 

bot.on('message', async (msg) => {
  if (!msg.from.is_bot) {
    console.log(msg);
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    await createUser(userId);
    switch (msg.text) {
      case '/start':
        bot.sendMessage(chatId, 'Начинаю поиск...');
        userQueue.add(userId);
        break;
    }
    run();
  }
});

// Добавление пользователя в бд 

async function createUser(id) {
  try {
    const userSnapshot = await usersDb.where('id', '==', id).get();
    if (userSnapshot.empty) {
      const userJson = {
        id: id,
        age: 0,
        reputation: 0,
        language: 'RU'
      };
      const docRef = await usersDb.add(userJson);
      console.log('User created with ID:', docRef.id);
    }
  } catch (error) {
    console.log('Error creating user:', error);
  }
}

async function run() {
  if (userQueue.checkIfCouldBeInitialized()) {
    let listOfPeople = userQueue.find();
    chatList.push(listOfPeople);
    listOfPeople.forEach(element => {
      bot.sendMessage(element.id, 'Собеседник найден!');
    });
  }
}