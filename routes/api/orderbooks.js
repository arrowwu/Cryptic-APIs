var router = require('express').Router();
var passport = require('passport');
var mongoose = require('mongoose');
var Orderbook = mongoose.model('Orderbook');
var User = mongoose.model('User');
var auth = require('../auth');

// Preload orderbook objects on routes with ':orderbook'
router.param('orderbook', function(req, res, next, slug) {
  Orderbook.findOne({ slug: slug})
    .populate('author')
    .then(function (orderbook) {
      if (!orderbook) { return res.sendStatus(404); }

      req.orderbook = orderbook;

      return next();
    }).catch(next);
});

router.get('/', auth.required, function(req, res, next) {
  var query = {};
  var limit = 20;
  var offset = 0;

  if(typeof req.query.limit !== 'undefined'){
    limit = req.query.limit;
  }

  if(typeof req.query.offset !== 'undefined'){
    offset = req.query.offset;
  }

  if(typeof req.query.exchangeName !== 'undefined'){
    query.exchangeName = req.query.exchangeName;
  }

  if(req.query.author.toString() === req.payload.username.toString()){  //You can only get orderbooks created by yourself
                           //username is the one that is encoded in jwt token
    Promise.all([
      req.query.author ? User.findOne({username: req.query.author}) : null
    ]).then(function(results){
      var author = results[0];

      if(author){
        query.author = author._id;
      }

      return Promise.all([
        Orderbook.find(query)
          .limit(Number(limit))
          .skip(Number(offset))
          .sort({createdAt: 'desc'})
          .populate('author')
          .exec(),
        Orderbook.count(query).exec(),
        req.payload ? User.findById(req.payload.id) : null,
      ]).then(function(results){
        var orderbooks = results[0];
        var orderbooksCount = results[1];
        var user = results[2];

        return res.json({
          orderbooks: orderbooks.map(function(orderbook){
            return orderbook.toJSONFor(user);
          }),
          orderbooksCount: orderbooksCount
        });
      });
    }).catch(next);

  }else {
      return res.sendStatus(403);
  }
});

// Create a new orderbook
router.post('/', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }

    var orderbook = new Orderbook(req.body.orderbook);

    orderbook.author = user;

    return orderbook.save().then(function(){
      console.log(orderbook.author);
      return res.json({orderbook: orderbook.toJSONFor(user)});
    });
  }).catch(next);
});

// return a orderbook
router.get('/:orderbook', auth.required, function(req, res, next) {

  if(req.orderbook.author._id.toString() === req.payload.id.toString()){
      Promise.all([
        req.payload ? User.findById(req.payload.id) : null,
        req.orderbook.populate('author').execPopulate()
      ]).then(function(results){
        var user = results[0];

        return res.json({orderbook: req.orderbook.toJSONFor(user)});
      }).catch(next);
    } else {
      return res.sendStatus(403);
    }


  
});

// update orderbook
router.put('/:orderbook', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if(req.orderbook.author._id.toString() === req.payload.id.toString()){
      if(typeof req.body.orderbook.exchangeName !== 'undefined'){
        req.orderbook.exchangeName = req.body.orderbook.exchangeName;
      }

      if(typeof req.body.orderbook.coinPair !== 'undefined'){
        req.orderbook.coinPair = req.body.orderbook.coinPair;
      }

      if(typeof req.body.orderbook.action !== 'undefined'){
        req.orderbook.action = req.body.orderbook.action;
      }

      if(typeof req.body.orderbook.price !== 'undefined'){
        req.orderbook.price = req.body.orderbook.price;
      }

      if(typeof req.body.orderbook.quantity !== 'undefined'){
        req.orderbook.quantity = req.body.orderbook.quantity;
      }

      if(typeof req.body.orderbook.total !== 'undefined'){
        req.orderbook.total = req.body.orderbook.total;
      }

      req.orderbook.save().then(function(orderbook){
        return res.json({orderbook: orderbook.toJSONFor(user)});
      }).catch(next);
    } else {
      return res.sendStatus(403);
    }
  });
});

// delete orderbook
router.delete('/:orderbook', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }

    if(req.orderbook.author._id.toString() === req.payload.id.toString()){
      return req.orderbook.remove().then(function(){
        return res.sendStatus(204);
      });
    } else {
      return res.sendStatus(403);
    }
  }).catch(next);
});



module.exports = router;
