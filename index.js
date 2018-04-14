var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

var nextUserId = 1;
var socketsByUserId = {}
var matchedUserId = {}
var userWaitingForMatch = null;


app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
  var thisUserId = nextUserId++;
  socketsByUserId[thisUserId] = socket;
  if (userWaitingForMatch) {
    matchedUserId[userWaitingForMatch] = thisUserId;
    matchedUserId[thisUserId] = userWaitingForMatch;

    socketsByUserId[thisUserId].emit('control', 'userMatched');
    socketsByUserId[userWaitingForMatch].emit('control', 'userMatched');

    userWaitingForMatch = null;
  } else {
    userWaitingForMatch = thisUserId;
  }

  socket.on('chat message', function(msg){
    if (matchedUserId[thisUserId]) {
      socketsByUserId[matchedUserId[thisUserId]].emit('chat message', msg);
      socketsByUserId[thisUserId].emit('chat message', msg);
    } else {
      socketsByUserId[thisUserId].emit('control', 'noMatchYet');
    }
  });



});

http.listen(port, function(){
  console.log('listening on *:' + port);
});
