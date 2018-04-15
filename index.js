var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var distance = require('jaro-winkler');
var port = process.env.PORT || 3000;


var nextUserId = 1;
var socketsByUserId = {}
var matchedUserId = {}
var userWaitingForMatch = null;
var knowingUsers = [];
var guessingUsers = [];
var riddleForKnowingUser = {};

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

//lowercase only!
const forbiddenWords = [
  'referendum',
  'facebook',
  'leave',
  'european',
  'union',
  'eu',
  'cambridge',
  'analytica',
  'europe',
  'security',
  'invest',
  'vegan',
  'russia',
  'queen',
  'alien',
  'migrant',
  'bicycle',
  'bike',
  'cyclist',
  'jobs',
  'travel'
]

function shouldBeCensored(message) {
  split = message.split(" ");
  maxDistance = 0;
  for (let i = 0; i < split.length; i++) {
    for (let f = 0; f < forbiddenWords.length; f++) {
      maxDistance = Math.max(maxDistance, distance(split[i], forbiddenWords[f]));
    }
  }
  return maxDistance > 0.8;
}

io.on('connection', function(socket){
  var thisUserId = nextUserId++;
  socketsByUserId[thisUserId] = socket;
  if (userWaitingForMatch) {
    socketsByUserId[thisUserId].emit('control', 'youAreGuessing');
    guessingUsers.push(thisUserId);

    matchedUserId[userWaitingForMatch] = thisUserId;
    matchedUserId[thisUserId] = userWaitingForMatch;

    socketsByUserId[thisUserId].emit('control', 'userMatched');
    socketsByUserId[userWaitingForMatch].emit('control', 'userMatched');

    userWaitingForMatch = null;
  } else {
    socketsByUserId[thisUserId].emit('control', 'youAreKnowing');
    knowingUsers.push(thisUserId);
    
    userWaitingForMatch = thisUserId;
  }

  socket.on('chat message', function(msg){
    if (matchedUserId[thisUserId]) {
      if (shouldBeCensored(msg)) {
        socketsByUserId[thisUserId].emit('control', 'censored');
      } else {
        socketsByUserId[matchedUserId[thisUserId]].emit('chat message', msg);
        socketsByUserId[thisUserId].emit('chat message', msg);
      }
    } else {
      socketsByUserId[thisUserId].emit('control', 'noMatchYet');
    }
  });

  socket.on('riddle', function(msg){
    if (knowingUsers.indexOf(thisUserId) >= 0) {
      riddleForKnowingUser[thisUserId] = msg;
    } else {
      socketsByUserId[thisUserId].emit('control', 'guessingUserCantChooseRiddle');
    }
  });

  socket.on('solution', function(msg){
    if (guessingUsers.indexOf(thisUserId) >= 0) {
      var guessResult;
      if (riddleForKnowingUser[matchedUserId[thisUserId]] === msg) {
        guessResult = "guessedCorrectly";
      } else {
        guessResult = "guessedIncorrectly";
      }
      socketsByUserId[matchedUserId[thisUserId]].emit('control', guessResult);
      socketsByUserId[thisUserId].emit('control', guessResult);
      
    } else {
      socketsByUserId[thisUserId].emit('control', 'knowingUserCantSendRiddle');
    }
  });

  socket.on('disconnect', (reason) => {
    if (matchedUserId[thisUserId]) {
      socketsByUserId[matchedUserId[thisUserId]].emit('control', 'otherUserDisconnected');
      matchedUserId[matchedUserId[thisUserId]] = null;
    }
  });
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});
