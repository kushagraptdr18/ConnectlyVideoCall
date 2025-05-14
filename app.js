const express = require('express');
const app = express();
const path = require('path');
const dotenv = require("dotenv");

dotenv.config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const http = require('http');
const server = http.createServer(app);
const socketIo = require('socket.io');
const io = socketIo(server);

app.set('view engine', 'ejs');


let waitingUser=[];
let rooms=[];

app.get('/', (req, res) => {
    res.render('index');
});



app.get("/chat/:name",(req,res)=>{
    

    res.render('chat',{name:req.params.name});
})





io.on("connection", (socket) => {
    // console.log("A user connected:", socket.id);

    socket.on("userInfo", (data) => {
        if (waitingUser.length > 0) {
            let user = waitingUser.shift();

            const roomName = `${socket.id}-${user.socket.id}`;
            socket.join(roomName);
            user.socket.join(roomName);

            rooms.push({
                roomName: roomName,
                sender:socket,
                receiver: user.socket,
                senderName:data.name,
                receiverName:user.name
            });

            io.to(roomName).emit("joined", {
                roomName: roomName,
                receiverName: user.name,
                senderName: data.name
            });

        } else {
            socket.emit("notJoined", { message: "You are all alone..." });
            waitingUser.push({ name: data.name, socket: socket });
        }
    });

   socket.on("skipUser", (data) => {
    // Find and remove the current room
    const roomIndex = rooms.findIndex(r => r.roomName === data.roomName);
   
    if (roomIndex === -1) return;
    const room = rooms[roomIndex];
    rooms.splice(roomIndex, 1);

    const currentUser = socket;
    const currentUserName = room.sender.id === socket.id ? room.senderName : room.receiverName;

    const skippedUser = room.sender.id === socket.id ? room.receiver : room.sender;
    const skippedUserName = room.sender.id === socket.id ? room.receiverName : room.senderName;

    // Leave current room
    currentUser.leave(room.roomName);
    skippedUser.leave(room.roomName);

    // === STEP 1: Handle the one who clicked skip ===
    let newUserForCurrent = waitingUser.find(u => u.socket.id !== skippedUser.id);
    if (newUserForCurrent) {
        // Remove the matched user from the waiting list
        waitingUser = waitingUser.filter(u => u.socket.id !== newUserForCurrent.socket.id);

        const newRoomName = `${currentUser.id}-${newUserForCurrent.socket.id}`;
        currentUser.join(newRoomName);
        newUserForCurrent.socket.join(newRoomName);

        rooms.push({
            roomName: newRoomName,
            sender: currentUser,
            receiver: newUserForCurrent.socket,
            senderName: currentUserName,
            receiverName: newUserForCurrent.name
        });

        io.to(newRoomName).emit("joined", {
            roomName: newRoomName,
            senderName: currentUserName,
            receiverName: newUserForCurrent.name
        });
    } else {
        // No match, add to waiting list
        currentUser.emit("notJoined", { message: "You are all alone..." });
        waitingUser.push({ name: currentUserName, socket: currentUser });
    }

    // === STEP 2: Handle the skipped user ===
    let newUserForSkipped = waitingUser.find(u => u.socket.id !== currentUser.id);
    if (newUserForSkipped) {
        // Remove the matched user from the waiting list
        waitingUser = waitingUser.filter(u => u.socket.id !== newUserForSkipped.socket.id);

        const newRoomName = `${skippedUser.id}-${newUserForSkipped.socket.id}`;
        skippedUser.join(newRoomName);
        newUserForSkipped.socket.join(newRoomName);

        rooms.push({
            roomName: newRoomName,
            sender: skippedUser,
            receiver: newUserForSkipped.socket,
            senderName: skippedUserName,
            receiverName: newUserForSkipped.name
        });

        io.to(newRoomName).emit("joined", {
            roomName: newRoomName,
            senderName: skippedUserName,
            receiverName: newUserForSkipped.name
        });
    } else {
        // No match, add to waiting list
        skippedUser.emit("notJoined", { message: "You are all alone..." });
        waitingUser.push({ name: skippedUserName, socket: skippedUser });
    }
});


socket.on("sendMessage", (data) => {
  // Send to other user in the same room
  socket.to(data.room).emit("receiveMessage", {
    message: data.message,
    sender: data.sender
  });
});

   
    socket.on("signalingMessage",function(data){
        socket.broadcast.to(data.room).emit("signalingMessage",data.message)        
    })

    socket.on("callUser",function({room}){

        socket.broadcast.to(room).emit("incomingCall")
    })

    socket.on("acceptCall",function({room}){
        socket.broadcast.to(room).emit("callAccepted")
    })

    socket.on("rejectCall",function({room}){
        socket.broadcast.to(room).emit("callRejected")
    })


    socket.on("disconnect", () => {
      
        // console.log("A user disconnected:", socket.id);

        // Remove from waiting users
        waitingUser = waitingUser.filter(user => user.socket.id !== socket.id);

        // Notify and clean up rooms
        rooms = rooms.filter(r => {
            if (r.receiver.id === socket.id) {
                waitingUser.push({name:r.senderName,socket:r.sender})
                r.sender.emit("notJoined", { message: "User has left." });
                return false; // Remove room
            } else if (r.sender.id === socket.id) {
                waitingUser.push({name:r.receiverName,socket:r.receiver})
                r.receiver.emit("notJoined", { message: "User has left." });
                return false; // Remove room
            }
            return true; // Keep room
        });
    });
    socket.on("hangupCall", ({ room }) => {
    // Notify the other user in the room
    socket.to(room).emit("hangupCall");
  });
});

const port = process.env.PORT||3000

server.listen(port, () => {
    console.log(`Server running on port ${port}` );
});