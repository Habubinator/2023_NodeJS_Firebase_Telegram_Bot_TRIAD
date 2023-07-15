const TelegramBot = require('node-telegram-bot-api');
const token = '6271769906:AAHZpJDpkWpxnxWpi8PohIZp66ZZ-1AcAxk';
const bot = new TelegramBot(token, {polling: true});
bot.setMyCommands([{ command: '/start', description: 'Найти чат' },
                   { command: '/join', description: 'Подключиться к активному чату' },
                   { command: '/next', description: 'Найти следующий диалог' },
                   { command: '/stop', description: 'Завершить этот диалог' },
                   { command: '/kick', description: "Голосование за исключение"},
                   { command: '/share', description: 'Поделиться своим аккаунтом'},
                   { command: "/report_bug", description: "Уведомить oб ошибке"}])
                   // ,
                   // { command: "/donate", description: "Отблагодарить разраба"}
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

  add(id, username) {
    this.queue.enqueue(new WaitUser(id, username));
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
  constructor(id, username){
    this.id = id;
    this.username = username
    this.kickPoints = 0;
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
        return "🟦"
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
var joinQueue = new UserQueue();
var chatList = [];
var kickAwaitArray = [];
module.exports = {db}

const usersDb = db.collection('users');

// Когда приходит сообщение боту, то оно встает в очередь в самом API 

bot.on('message', async (msg) => {
  if (!msg.from.is_bot) {
    console.log(msg);
    const userId = msg.from.id;
    const username = msg.from.username;
    await createUser(userId, username, msg);
    switch (msg.text) {
      case '/start':
        await startSearch(userId,username);
        break;
      case '/join':
        await joinChat(userId,username);
        break;
      case '/stop':
        await stopSearchOrDialog(userId);
        break;
      case "/next":
        await stopSearchOrDialog(userId);
        await startSearch(userId, username);
        break;
      case "/share":
        if(checkIfUserInDialog(userId)){
          forwardLinkToUsers(userId)
        }else{
          bot.sendMessage(userId, "Вы ещё не в диалоге")
        }
        break;
      case "/kick":
        if(!checkIfUserKicked(userId)){
          pickUserToKick(userId);
        }else{
          bot.sendMessage(userId, "Вы уже проголосовали")
        }
        break;
      case "/online":
        getOnline(userId);
        break;
      case "/report_bug":
        bot.sendMessage(userId, "Написать разработчику можно тут:\nhttps://forms.gle/WtXAR18VboHfbGvf6")
        break;
      case "/donate":
        openDonutButton(userId);
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

bot.on('callback_query', function onCallbackQuery(callbackQuery) {
  const action = callbackQuery.data.split('|');
  const msg = callbackQuery.message;
  const opts = {
    disable_web_page_preview: true,
    parse_mode: `HTML`,
    chat_id: msg.chat.id,
    message_id: msg.message_id,
  };

  if(action[0] == "kick"){
    var kicked = findUser(action[1])
    var kicker = findUser(action[2])
    var chat = findChatOfUser(kicked.id)
    var otherPerson;
    chat.forEach(kickPerson => {
      if(kickPerson.id != kicked.id && kickPerson.id != kicker.id){
        otherPerson = kickPerson;
      }
    })
    kickAwaitArray.forEach(persons => {
      if(kicker.id == persons[0]){
        persons.push(kicked.id)
      }
    })
    if(++kicked.kickPoints < 2){
      bot.sendMessage(otherPerson.id, `Аноним <tg-emoji emoji-id="5368324170671202286">${kicker.colour}</tg-emoji>`+
          `хочет выгнать из диалога анонима <tg-emoji emoji-id="5368324170671202286">${kicked.colour}</tg-emoji>.`+
          `\n Нажмите команду /kick, чтобы проголосовать за, или против`,{disable_web_page_preview: true,
            parse_mode: `HTML`})
      bot.sendMessage(kicked.id, `Аноним <tg-emoji emoji-id="5368324170671202286">${kicker.colour}</tg-emoji> запустил голосование, чтобы выгнать вас`,{disable_web_page_preview: true,
        parse_mode: `HTML`})
      bot.editMessageText(`Вы успешно проголосовали за <tg-emoji emoji-id="5368324170671202286">${kicked.colour}</tg-emoji>`, opts);
    }else{
      bot.sendMessage(kicker.id, `Аноним ${kicked.colour} был выгнан`)
      bot.sendMessage(otherPerson.id, `Аноним ${kicked.colour} был выгнан`)
      stopSearchOrDialog(kicked.id)
    }
  }else if(action[0] == "donate"){
    senderId = action[1];
    price_amount = +action[2]
    let price = [ {label: "На корм котикам", amount: 2500},
                  {label: "На корм котикам", amount: 5000},
                  {label: "На корм котикам", amount: 10000},
                  {label: "На корм котикам", amount: 20000},
                  {label: "На корм котикам", amount: 50000}
              ]
    bot.sendInvoice(senderId,"На корм котикам 🐈", "Если вам нравится то, что я сделал, то поддержите будущие мои проекты", 
  "donate","535936410:LIVE:6271769906_1c7d48e4-261d-42b3-8cef-d4da926124c5", "UAH", [price[price_amount]])
  }
});

// Добавление пользователя в бд 

async function createUser(id, username, msg) {
  try {
    const userSnapshot = await usersDb.where('username', '==', username).get();
    if (userSnapshot.empty) {
      const userJson = {
        id: id,
        username: username,
        age: 0,
        reputation: 0,
        language: msg.from.language_code
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

async function startSearch(userId, username){
  let text;
  if(joinQueue.isUserInQueue(userId)){
    joinQueue.exit(userId)
  }
  if(checkIfUserInDialog(userId)){
    text = "Вы уже в диалоге"
  }else{
    if(userQueue.isUserInQueue(userId)){
      text = "Вы уже в поиске"
    }else{
      text = 'Начинаю поиск...'
      userQueue.add(userId, username);
    }
  }
  bot.sendMessage(userId, text);
}

async function joinChat(userId, username){
  let text;
  if(userQueue.isUserInQueue(userId)){
    userQueue.exit(userId)
  }
  if(checkIfUserInDialog(userId)){
    text = "Вы уже в диалоге"
  }else{
    if(joinQueue.isUserInQueue(userId)){
      text = "Вы уже в поиске"
    }else{
      text = 'Ждем освобождения места в чате...'
      joinQueue.add(userId, username);
    }
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
      let text;
      if (sender.kickPoints >= 2) {
        text = "Bac выгнали из диалога";
      } else {
        text = "Вы покинули диалог";
      }
      bot.sendMessage(userId, text).then(() => {
        kickAwaitArray = kickAwaitArray.filter(personArray => personArray[1] !== userId);
      });
      if (chatOfLeaver) {
        if (sender.kickPoints < 2) {
          chatOfLeaver.forEach((waitUser) => {
            bot.sendMessage(waitUser.id, `Аноним <tg-emoji emoji-id="5368324170671202286">${sender.colour}</tg-emoji> цвета, покинул диалог `,
              { disable_web_page_preview: true, parse_mode: `HTML` });
            chatList = chatList.filter(element => element.length > 1);
          });
        }
      }
      sender.kickPoints = 0;
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
  if (userQueue.isUserInQueue(userId)||joinQueue.isUserInQueue(userId)) {
    userQueue.exit(userId);
    bot.sendMessage(userId, "Вы покинули поиск");
  } else {
    bot.sendMessage(userId, "Вы не в поиске");
  }
}

function checkIfUserKicked(senderId){
  let result = false;
  kickAwaitArray.forEach(person => {
    if(person[0] == senderId){
      result = true;
    }
  })
  return result;
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
  let tempuser = findUser(senderId)
  if (chat) {
    chat.forEach((waitUser) => {
      if (waitUser.id != senderId) {                                                 
        bot.sendMessage(waitUser.id, `Пользователь цвета ${tempuser.colour} поделился <a href="t.me/${tempuser.username}">ссылкой на свой аккаунт</a>: `, {disable_web_page_preview: true,
        parse_mode: `HTML`});
      }else{
        bot.sendMessage(waitUser.id, `Вы поделились <a href="t.me/${tempuser.username}">ссылкой на свой аккаунт </a>`, {disable_web_page_preview: true,
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

async function pickUserToKick(senderId){
  try {
    let chat = findChatOfUser(senderId);
    if(chat.length == 3){
      var persons = []; 
      chat.forEach(person => {
        if(person.id != senderId){
          persons.push(person)
        }
      })

      var buttonOptions = {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: `${persons[0].colour}`, callback_data: `kick|${persons[0].id}|${senderId}` }],
            [{ text: `${persons[1].colour}`, callback_data: `kick|${persons[1].id}|${senderId}` }]
          ]
        })
      };
      await bot.sendMessage(senderId, "Проголосовать за исключение: ", buttonOptions)
      kickAwaitArray.push([senderId])
    }else{
      await bot.sendMessage(senderId, "Невозможно запустить голосование, если кто-то вышел")
    } 
  } catch (error) {
    console.log(error)
  }
}

// основаня функция запуска

async function run() {
  if (userQueue.checkIfCouldBeInitialized()) {
    let listOfPeople = userQueue.find();
    chatList.push(listOfPeople);
    listOfPeople.forEach(element => {
      bot.sendMessage(element.id, `Собеседник найден! \nВаш цвет: <tg-emoji emoji-id="5368324170671202286">${element.colour}</tg-emoji>`,{disable_web_page_preview: true,
        parse_mode: `HTML`});
    });
  }

  if (joinQueue.queue.length > 0) {
    chatWithoutUser = chatList.filter(chat => chat.length !== 3)[0]
    if(chatWithoutUser){
      let colours = ["🟥","🟩","🟦"]
      let joinedUser = joinQueue.queue.dequeue()
      chatWithoutUser.forEach(element => {
        colours.forEach((element1, index) => {
          if(element1 == element.colour){
            colours.splice(index, 1);
          }
        })
      })

      joinedUser.colour = colours[0]
      chatWithoutUser.forEach(element => {
        bot.sendMessage(element.id, "К вам подключился новый аноним! \nЕго цвет: " + joinedUser.colour)
      })
      bot.sendMessage(joinedUser.id, "Вы подключились к чату! \nВаш цвет: " + joinedUser.colour)
      chatWithoutUser.push(joinedUser)
    }
  }
}

function toEscapeMSg(string){
  return string
      .replace("<", "&lt")
      .replace(">", "&gt")
      .replace("&", "&amp")
      .replace("\"", "&quot")
}

/*

*/

async function openDonutButton(userId){
  var buttonOptions = {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: `Донат в 25 грн`, callback_data: `donate|${userId}|0`}],
        [{ text: `Донат в 50 грн`, callback_data: `donate|${userId}|1`}],
        [{ text: `Донат в 100 грн`, callback_data: `donate|${userId}|2`}],
        [{ text: `Донат в 200 грн`, callback_data: `donate|${userId}|3`}],
        [{ text: `Донат в 500 грн`, callback_data: `donate|${userId}|4`}]
      ]
    })
  };
  await bot.sendMessage(userId, "Выберите пожертвование:", buttonOptions)
}

function getOnline(userId){
  try {
    let counter = 0;
    chatList.forEach(index => {
      counter += index.length
    })
    counter += userQueue.queue.length
    counter += joinQueue.queue.length
    bot.sendMessage(userId, "Текущий онлайн: "+ counter + " человек")
  } catch (error) {
    console.log(error)
  }
}

removeDuplicateUsers();
