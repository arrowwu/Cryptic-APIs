var router = require('express').Router();
var mongoose = require('mongoose');
var Message = mongoose.model('Message');
var User = mongoose.model('User');
var auth = require('../auth');

// Preload message objects on routes with ':message'
router.param('message', function(req, res, next, slug) {
  Message.findOne({ slug: slug})
    .populate('author')
    .then(function (message) {
      if (!message) { return res.sendStatus(404); }

      req.message = message;

      return next();
    }).catch(next);
});

//get all the messages sent by the current user, they are all messages in current user's outbox
router.get('/sent', auth.required, function(req, res, next) {
  var query = {};
  var limit = 20;
  var offset = 0;

  if(typeof req.query.author == 'undefined'){
    return res.sendStatus(400);
  }

  if(typeof req.query.limit !== 'undefined'){
    limit = req.query.limit;
  }

  if(typeof req.query.offset !== 'undefined'){
    offset = req.query.offset;
  }

  if( typeof req.query.tag !== 'undefined' ){
    query.tagList = {"$in" : [req.query.tag]};
  }

  if( req.query.author.toString() === req.payload.username.toString() ){   //You can only get the messages from youself.      

    Promise.all([
      req.query.author ? User.findOne({username: req.query.author}) : null,
      req.query.favorited ? User.findOne({username: req.query.favorited}) : null
    ]).then(function(results){
      var author = results[0];
      var favoriter = results[1];

      if(author){
        query.author = author._id;
      }

      if(favoriter){
        query._id = {$in: favoriter.favorites};
      } else if(req.query.favorited){
        query._id = {$in: []};
      }

      return Promise.all([
        Message.find(query)
          .limit(Number(limit))
          .skip(Number(offset))
          .sort({createdAt: 'desc'})
          .populate('author')          //each message has an author
          .populate('recipient')       //each message has a recipient
          .exec(),
        Message.count(query).exec(),
        req.payload ? User.findById(req.payload.id) : null,
      ]).then(function(results){
        var messages = results[0];
        var messagesCount = results[1];
        var user = results[2];

        return res.json({
          messages: messages.map(function(message){
            return message.toJSONFor(user);
          }),
          messagesCount: messagesCount
        });
      });
    }).catch(next);
  } else {
      return res.sendStatus(403);
  }
});

//get all the messages received by the currentUser, they are the current user's inbox
router.get('/received', auth.required, function(req, res, next) {
  var query = {};
  var limit = 20;
  var offset = 0;

  if(typeof req.query.recipient == 'undefined'){
    return res.sendStatus(400);
  }

  if(typeof req.query.limit !== 'undefined'){
    limit = req.query.limit;
  }

  if(typeof req.query.offset !== 'undefined'){
    offset = req.query.offset;
  }

  if( typeof req.query.tag !== 'undefined' ){
    query.tagList = {"$in" : [req.query.tag]};
  }

  if(req.query.recipient.toString() === req.payload.username.toString() ||
      req.query.recipient.toString() === req.payload.username.toString()){   //You can only get the messages from/for youself.      

    Promise.all([
      req.query.recipient ? User.findOne({username: req.query.recipient}) : null,
      req.query.favorited ? User.findOne({username: req.query.favorited}) : null
    ]).then(function(results){
      var recipient = results[0];
      var favoriter = results[1];

      if(recipient){
        query.recipient = recipient._id;
      }

      if(favoriter){
        query._id = {$in: favoriter.favorites};
      } else if(req.query.favorited){
        query._id = {$in: []};
      }

      return Promise.all([
        Message.find(query)
          .limit(Number(limit))
          .skip(Number(offset))
          .sort({createdAt: 'desc'})
          .populate('author')          //each message has an author
          .populate('recipient')       //each message has a recipient
          .exec(),
        Message.count(query).exec(),
        req.payload ? User.findById(req.payload.id) : null,
      ]).then(function(results){
        var messages = results[0];
        var messagesCount = results[1];
        var user = results[2];

        return res.json({
          messages: messages.map(function(message){
            return message.toJSONFor(user);
          }),
          messagesCount: messagesCount
        });
      });
    }).catch(next);
  } else {
      return res.sendStatus(403);
  }
});


// Create a message
router.post('/', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }

    var message = new Message(req.body.message);

    //Find the recipient based on the the username
    User.findOne({ username: req.body.message.recipient})
    .then(function (recipient) {

        if (!recipient) { return res.status(404).json({errors: {Recipient: "does not exist!"}}); }
        message.recipient = recipient;
        message.author = user;
        return message.save().then(function(){
          console.log(message.author);
          console.log(message.recipient);
          return res.json({message: message.toJSONFor(user)});
        });
    }).catch(next);
   
  }).catch(next);
});

// return a message
router.get('/:message', auth.optional, function(req, res, next) {
  Promise.all([
    req.payload ? User.findById(req.payload.id) : null,
    req.message.populate('author').execPopulate(),
    req.message.populate('recipient').execPopulate(),
  ]).then(function(results){
    var user = results[0];

    return res.json({message: req.message.toJSONFor(user)});
  }).catch(next);
});

// update a message
router.put('/:message', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if(req.message.author._id.toString() === req.payload.id.toString()){
      if(typeof req.body.message.title !== 'undefined'){
        req.message.title = req.body.message.title;
      }

      if(typeof req.body.message.description !== 'undefined'){
        req.message.description = req.body.message.description;
      }

      if(typeof req.body.message.body !== 'undefined'){
        req.message.body = req.body.message.body;
      }

      if(typeof req.body.message.tagList !== 'undefined'){
        req.message.tagList = req.body.message.tagList
      }

      req.message.save().then(function(message){
        return res.json({message: message.toJSONFor(user)});
      }).catch(next);
    } else {
      return res.sendStatus(403);
    }
  });
});

// delete a message
router.delete('/:message', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }

    if(req.message.author._id.toString() === req.payload.id.toString()){
      return req.message.remove().then(function(){
        return res.sendStatus(204);
      });
    } else {
      return res.sendStatus(403);
    }
  }).catch(next);
});

// Favorite an message
router.post('/:message/favorite', auth.required, function(req, res, next) {
  var messageId = req.message._id;

  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }

    return user.favorite(messageId).then(function(){
      return req.message.updateFavoriteCount().then(function(message){
        return res.json({message: message.toJSONFor(user)});
      });
    });
  }).catch(next);
});

// Unfavorite an message
router.delete('/:message/favorite', auth.required, function(req, res, next) {
  var messageId = req.message._id;

  User.findById(req.payload.id).then(function (user){
    if (!user) { return res.sendStatus(401); }

    return user.unfavorite(messageId).then(function(){
      return req.message.updateFavoriteCount().then(function(message){
        return res.json({message: message.toJSONFor(user)});
      });
    });
  }).catch(next);
});

module.exports = router;
