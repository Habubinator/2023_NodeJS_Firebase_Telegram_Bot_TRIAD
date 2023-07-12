const TelegramBot = require('node-telegram-bot-api');
const token = '6271769906:AAHZpJDpkWpxnxWpi8PohIZp66ZZ-1AcAxk';
const bot = new TelegramBot(token, {polling: true});
bot.setMyCommands([{ command: '/start', description: 'Найти чат' },
                   { command: '/next', description: 'Найти следующий диалог' },
                   { command: '/stop', description: 'Завершить этот диалог' },
                   { command: '/share', description: 'Поделиться своим аккаунтом'}])
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

  remove(element) {
    let removed = 0;
    for (let i = this.head; i < this.tail; i++) {
      if (this.elements[i] === element) {
        delete this.elements[i];
        removed++;
      } else {
        this.elements[i - removed] = this.elements[i];
      }
    }
    this.tail -= removed;
  }

  exit(index) {
    delete this.elements[index];
  }
}

// Классы очереди и пользователя в очереди с заделом на будущее

class UserQueue {
  constructor() {
    this.queue = new Queue();
  }

  add(id) {
    this.queue.enqueue(new WaitUser(id));
  }

  find() {
    let arrayOfFoundPeople = [
      this.queue.dequeue(),
      this.queue.dequeue(),
      this.queue.dequeue()
    ];
    return arrayOfFoundPeople;
  }

  exit(userId) {
    for (let i = this.queue.head; i < this.queue.tail; i++) {
      if (this.queue.elements[i]?.id === userId) {
        this.queue.elements[i] = undefined;
        this.queue.head++
        break;
      }
    }
  }
  

  checkIfCouldBeInitialized() {
    if (this.queue.length >= 3) {
      return true;
    }
    return false;
  }

  isUserInQueue(userId) {
    for (let i = this.queue.head; i < this.queue.tail; i++) {
      if (this.queue.elements[i]?.id === userId) {
        return true;
      }
    }
    return false;
  }
}


class WaitUser{
  constructor(id){
    this.id = id;
    this.colour = this.pickColour(userQueue.queue.tail)
  }
   
  pickColour(colourCode){
    let temp = colourCode%3
    switch (temp){
      case 0:
        return "🟥"
      case 1:
        return "🟩"
      case 2:
        return"🟦"
    }
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
    const userId = msg.from.id;
    await createUser(userId);
    switch (msg.text) {
      case '/start':
        await startSearch(userId);
        break;
      case '/stop':
        await stopSearchOrDialog(userId);
        break;
      case "/next":
        await stopSearchOrDialog(userId);
        await startSearch(userId);
        break;
      case "/share":
        if(checkIfUserInDialog(userId)){
          forwardLinkToUsers(userId)
        }else{
          bot.sendMessage(userId, "Вы ещё не в диалоге")
        }
        break;
      default:
        if(checkIfUserInDialog(userId)){
          forwardMessageToUsers(userId, msg)
        }else{
          bot.sendMessage(userId, "Вы ещё не в диалоге")
        }
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

// Костыльная функция чтобы убрать всех пользователей-дубликатов после запуска

async function removeDuplicateUsers() {
  try {
    const usersSnapshot = await usersDb.get();
    const usersMap = new Map();

    usersSnapshot.forEach((userDoc) => {
      const userId = userDoc.data().id;
      if (usersMap.has(userId)) {
        usersMap.get(userId).push(userDoc.id);
      } else {
        usersMap.set(userId, [userDoc.id]);
      }
    });

    const deletionPromises = [];
    usersMap.forEach((docIds) => {
      if (docIds.length > 1) {
        docIds.slice(1).forEach((docId) => {
          const deletionPromise = usersDb.doc(docId).delete();
          deletionPromises.push(deletionPromise);
        });
      }
    });

    await Promise.all(deletionPromises);
    console.log('Duplicate users removed successfully.');
  } catch (error) {
    console.log('Error removing duplicate users:', error);
  }
}

async function startSearch(userId){
  let text;
  if(userQueue.isUserInQueue(userId)){
    text = "Вы уже в поиске"
  }else{
    text = 'Начинаю поиск...'
    userQueue.add(userId);
  }
  bot.sendMessage(userId, text);
}

async function stopSearchOrDialog(userId) {
  let isDialog = checkIfUserInDialog(userId);
  let sender = findUser(userId);
  let leave = false;
  let chatOfLeaver;
  if (isDialog) {
    chatList.forEach((element1) => {
      element1.forEach((element2, index) => {
        if (element2.id == userId) {
          leave = true;
          element1.splice(index, 1);
          chatOfLeaver = element1;
        }
      });
    });
    if (leave) {
      bot.sendMessage(userId, "Вы покинули диалог");
      if (chatOfLeaver) {
        chatOfLeaver.forEach((waitUser) => {
          bot.sendMessage(waitUser.id, `Аноним <tg-emoji emoji-id="5368324170671202286">${sender.colour}</tg-emoji> цвета, покинул диалог `, 
          {disable_web_page_preview: true, parse_mode: `HTML`});
        });
      }
    }
  } else {
    checkAndExitFromQueue(userId);
  }
}

function checkIfUserInDialog(userId) {
  let returnStatement = false
  chatList.forEach((element1) => {
    element1.forEach((element2) => {
      if (element2.id == userId) {
        returnStatement = true;
      }
    });
  });
  return returnStatement;
}

function checkAndExitFromQueue(userId) {
  if (userQueue.isUserInQueue(userId)) {
    userQueue.exit(userId);
    bot.sendMessage(userId, "Вы покинули поиск");
  } else {
    bot.sendMessage(userId, "Вы не в поиске");
  }
}


function forwardMessageToUsers(senderId, message) {
  const chat = findChatOfUser(senderId);
  const sender = findUser(senderId);
  if (chat) {
    chat.forEach((waitUser) => {
      if (waitUser.id != senderId) {
        try {
          if(message.text){
            bot.sendMessage(waitUser.id, `Аноним <tg-emoji emoji-id="5368324170671202286">${sender.colour}</tg-emoji>:\n` + toEscapeMSg(message.text), {disable_web_page_preview: true,
              parse_mode: `HTML`});
          }else if (message.sticker){
            bot.sendMessage(waitUser.id, `Аноним <tg-emoji emoji-id="5368324170671202286">${sender.colour}</tg-emoji>:`, {disable_web_page_preview: true,
              parse_mode: `HTML`}).then(() => {
            bot.sendSticker(waitUser.id, message.sticker.file_id);
            })
          } else if(message.photo){
            bot.sendMessage(waitUser.id, `Аноним <tg-emoji emoji-id="5368324170671202286">${sender.colour}</tg-emoji>:`, {disable_web_page_preview: true,
              parse_mode: `HTML`}).then(() => {
              bot.sendPhoto(waitUser.id, message.photo[3].file_id);
            })
          } else if(message.video){
            bot.sendMessage(waitUser.id, `Аноним <tg-emoji emoji-id="5368324170671202286">${sender.colour}</tg-emoji>:`, {disable_web_page_preview: true,
              parse_mode: `HTML`}).then(() => {
              bot.sendVideo(waitUser.id, message.video.file_id);
            })
          } else if(message.voice){
            bot.sendMessage(waitUser.id, `Аноним <tg-emoji emoji-id="5368324170671202286">${sender.colour}</tg-emoji>:`, {disable_web_page_preview: true,
              parse_mode: `HTML`}).then(() => {
              bot.sendVoice(waitUser.id, message.voice.file_id);
            })
          }else if(message.video_note){
            bot.sendMessage(waitUser.id, `Аноним <tg-emoji emoji-id="5368324170671202286">${sender.colour}</tg-emoji>:`, {disable_web_page_preview: true,
              parse_mode: `HTML`}).then(() => {
              bot.sendVideoNote(waitUser.id, message.video_note.file_id);
            })
          }else if(message.document){
            bot.sendMessage(waitUser.id, `Аноним<tg-emoji emoji-id="5368324170671202286">${sender.colour}</tg-emoji>:`, {disable_web_page_preview: true,
              parse_mode: `HTML`}).then(() => {
              bot.sendDocument(waitUser.id, message.document.file_id);
            })
          }
        } catch (error) {
          bot.sendMessage(senderId,"Неподдерживаемый тип сообщения")
        }
      }
    });
  }
}

function forwardLinkToUsers(senderId){
  const chat = findChatOfUser(senderId);
  if (chat) {
    chat.forEach((waitUser) => {
      if (waitUser.id != senderId) {
        bot.sendMessage(waitUser.id, `Пользователь поделился <a href="tg://user?id=${senderId}">ссылкой на свой аккаунт</a>`, {disable_web_page_preview: true,
        parse_mode: `HTML`});
      }else{
        bot.sendMessage(waitUser.id, `Вы поделились <a href="tg://user?id=${senderId}">ссылкой на свой аккаунт</a>`, {disable_web_page_preview: true,
        parse_mode: `HTML`});
      }
    });
  }
}

function findChatOfUser(senderId){
  let isChat = null
  chatList.forEach((chat) => {
    chat.forEach((waitUser) => {
      if (waitUser.id == senderId) {
        isChat = chat
      }
    });
  });
  return isChat;
}

function findUser(senderId){
  let isUser = null
  chatList.forEach((chat) => {
    chat.forEach((waitUser) => {
      if (waitUser.id == senderId) {
        isUser = waitUser
      }
    });
  });
  return isUser;
}

// основаня функция запуска

async function run() {
  chatList.forEach( (element, index) => {
    if(element.length <= 1){
      chatList.splice(index, 1);
    }
  })
  if (userQueue.checkIfCouldBeInitialized()) {
    let listOfPeople = userQueue.find();
    chatList.push(listOfPeople);
    listOfPeople.forEach(element => {
      bot.sendMessage(element.id, `Собеседник найден! \nВаш цвет: <tg-emoji emoji-id="5368324170671202286">${element.colour}</tg-emoji>`,{disable_web_page_preview: true,
        parse_mode: `HTML`});
    });
  }
}

function toEscapeMSg(string){
  return string
      .replace("<", "&lt")
      .replace(">", "&gt")
      .replace("&", "&amp")
      .replace("\"", "&quot")
}

removeDuplicateUsers();
