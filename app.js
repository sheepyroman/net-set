var express = require('express');
var http = require('http');
var socketIO = require('socket.io');
var path = require('path');
var m = require('mori');
var game = require('./game.js');

var app = express();
var server = http.Server(app);
var io = socketIO(server);

app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'jade');

// app.use(express.static('public'));
app.use('/public', express.static('public'));
app.use('/public/mori.js', express.static(__dirname + '/node_modules/mori/mori.js'));


var gameState = game.getInitialState();

app.get('/', function(req, res) {
  // var stateObject = m.toJs(gameState);
  // console.log('gameState:', stateObject);
  // res.render('index', stateObject);
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
  // CONNECT
  console.log('CONNECT', socket.id);
  // console.log('LOAD GAME', "(socket", socket.id, ")")
  // socket.emit('load game', gameState); //doesn't work
  socket.emit('load game', m.toJs(gameState)); //works

  // LOG ON/OFF
  socket.on('log on', function(name, color){
    console.log('LOG ON', name);
    gameState = game.addPlayer(name, color, gameState);
    var players = m.get(gameState, 'players')
    console.log('gameState.players:', players);
    // socket.broadcast.emit('log on', name);
    io.emit('log on', name, color);
  });
  socket.on('log off', function(name) {
    console.log('LOG OFF', name);
    gameState = game.removePlayer(name, gameState);
    console.log('gameState.players:', m.get(gameState, 'players'));
    socket.broadcast.emit('log off', name);
  });

  // START GAME
  socket.on('start game', function() {
    console.log('START GAME');
    gameState = game.startBoard(gameState);
    console.log('gameState.board:', m.get(gameState, 'board'));
    io.emit('start game', m.toJs(gameState));
    // io.emit('start game', gameState);
  });

  // UPSIZE
  socket.on('request upsize', function(){
    console.log("REQUEST UPSIZE");
    // console.log("Board before:", game.sortBoard(m.get(gameState, 'board')));
    gameState = game.upsizeIfNeeded(gameState);
    // console.log("Board after:", game.sortBoard(m.get(gameState, 'board')));
    console.log("UPSIZE");
    io.emit('upsize', m.toJs(gameState));
  });

  // CARD CLICK
  socket.on('card click', function(click){
    console.log('CARD CLICK', click.user, click.card);
    gameState = game.toggleClaimed(click.user, click.card, gameState);
    console.log('gameState.players.' + click.user + '.claimed:', m.getIn(gameState, ['players', click.user, 'claimed']));

    // Emit card click event
    io.emit('card click', {'player':click.user,
                           'card': click.card,
                           'color': m.getIn(gameState, ['players', click.user, 'color']),
                           'claimed': game.isClaimed(click.card, click.user, gameState)}
    );

    // Emit set found/failed event if needed
    var hasCandidate = game.checkForCandidate(click.user, gameState);
    if (hasCandidate) {
        var setData = game.processCandidate(click.user, gameState);
        io.emit(m.get(setData, 'event'), m.toJs(setData));
    }

  });

  // DISCONNECT
  socket.on('disconnect', function(){
    console.log('DISCONNECT', socket.id);
  });
});

server.listen(3000, function() {
  console.log("listening on port 3000");
});
