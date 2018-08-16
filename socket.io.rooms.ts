import io = require('socket.io');
import * as https from 'https';
import {ChatRooms} from './DB/Models';
import {helpers} from './helpers';
import {ChatRoom, Message} from './types';
let passportSocketIo = require('passport.socketio');

let socketIDMap: {[key: string]: string} = {};
let roomsPath = '/socket.io/rooms';

let roomsCache: {[key: string]: ChatRoom} = {};

async function getRoomFromCache(roomID: string) {
  if (!roomsCache[roomID]) {
    roomsCache[roomID] = await ChatRooms.getRoomByID(roomID);
    roomsCache[roomID].connected = 0;
  }
  return roomsCache[roomID];
}
async function increaseConnectedCount(roomID: string) {
  let chatRoom = await getRoomFromCache(roomID);
  chatRoom.connected++;
  return chatRoom;
}
async function decreaseConnectedCount(roomID: string) {
  let chatRoom = await getRoomFromCache(roomID);
  chatRoom.connected--;
  if (chatRoom.connected < 1) {
    delete roomsCache[roomID];
  }
  return chatRoom;
}

let sio: io.Server;
export function init(
    server: https.Server, cookieParser: any, sessionStore: any,
    secret: string) {
  sio = io(server, {path: roomsPath});
  sio.use(passportSocketIo.authorize({
    // the same middleware you registrer in express
    key: 'connect.sid',  // the name of the cookie where express/connect stores
                         // its session_id
    secret: secret,      // the session_secret to parse the cookie
    store:
        sessionStore,  // we NEED to use a sessionstore. no memorystore please
  }));
  sio.on('connection', (socket) => {
    let user = socket.request.user;
    if (!user) {
      console.error('socket doesn\'t have user assigned to it', socket);
      return;
    }
    socketIDMap[socket.id] = user._id;
    socket.on('disconnect', () => {
      delete socketIDMap[socket.id];
    });
    socket.on('join', async (roomID: string) => {
      let room = await increaseConnectedCount(roomID);
      if (!room) {
        socket.emit('error', `room with room id ${roomID} doesn't exist`);
        return;
      }
      socket.join(roomID, (err) => console.log(err));
      socket.emit('joined', room);
    });
    socket.on('leave', async (roomID: string) => {
      let room = await decreaseConnectedCount(roomID);
      if (!room) {
        socket.emit('error', `room with room id ${roomID} doesn't exist`);
        return;
      }
      socket.join(roomID, (err) => console.log(err));
      socket.emit('left', room);
    });
    socket.on('msg', async (msg: Message) => {
      msg.date = new Date();
      msg.from = user._id;
      let room = await getRoomFromCache(msg.roomID);
      if (!room) {
        throw `${msg.roomID} doesn't exists`;
      }
      if (room.members.find(uID => uID === user._id)) {
        socket.to(msg.roomID).emit('msg', msg);
      }
    });
  })
}
