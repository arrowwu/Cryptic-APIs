var mongoose = require('mongoose');
var uniqueValidator = require('mongoose-unique-validator');
var slug = require('slug');
var User = mongoose.model('User');

var OrderbookSchema = new mongoose.Schema({
  slug: {type: String, lowercase: true, unique: true},
  exchangeName: {type: String, lowercase: true, required: [true, "can't be blank"]},
  coinPair: {type: String, lowercase: true, required: [true, "can't be blank"]},
  action: String,
  price: Number,
  quantity: Number,
  total: Number,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {timestamps: true});

OrderbookSchema.plugin(uniqueValidator, {message: 'is already taken'});

OrderbookSchema.pre('validate', function(next){
  if(!this.slug)  {
    this.slugify();
  }

  next();
});

OrderbookSchema.methods.slugify = function() {
  this.slug = slug(this.exchangeName+this.coinPair) + '-' + (Math.random() * Math.pow(36, 6) | 0).toString(36);
};


OrderbookSchema.methods.toJSONFor = function(user){
  return {
    slug: this.slug,
    exchangeName: this.exchangeName,
    coinPair: this.coinPair,
    action: this.action,
    price: this.price,
    quantity: this.quantity,
    total: this.total,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    author: this.author.toProfileJSONFor(user)
  };
};




mongoose.model('Orderbook', OrderbookSchema);
