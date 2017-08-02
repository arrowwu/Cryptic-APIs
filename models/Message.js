var mongoose = require('mongoose');
var uniqueValidator = require('mongoose-unique-validator');
var slug = require('slug');
var User = mongoose.model('User');

var MessageSchema = new mongoose.Schema({
  slug: {type: String, lowercase: true, unique: true},
  category: {type: String, lowercase: true, required: [true, "can't be blank"]},
  title: String,
  description: String,
  body: String,
  favoritesCount: {type: Number, default: 0},
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {timestamps: true});

var deepPopulate = require('mongoose-deep-populate')(mongoose);
MessageSchema.plugin(deepPopulate, {
  whitelist: [
    'author',
    'recipient'
  ]
});

MessageSchema.plugin(uniqueValidator, {message: 'is already taken'});

MessageSchema.pre('validate', function(next){
  this.slugify();

  next();
});

MessageSchema.methods.slugify = function() {
  this.slug = slug(this.title);
};

MessageSchema.methods.updateFavoriteCount = function() {
  var message = this;

  return User.count({favorites: {$in: [message._id]}}).then(function(count){
    message.favoritesCount = count;

    return message.save();
  });
};

MessageSchema.methods.toJSONFor = function(user){
  return {
    slug: this.slug,
    category: this.category,
    title: this.title,
    description: this.description,
    body: this.body,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    favorited: user ? user.isFavorite(this._id) : false,
    favoritesCount: this.favoritesCount,
    author: this.author.toProfileJSONFor(user),
    recipient: this.recipient.toProfileJSONFor(user)
  };
};

mongoose.model('Message', MessageSchema);
