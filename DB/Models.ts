import * as mongoose from 'mongoose';
import {Aggregate, Model, NativeError} from 'mongoose';

import {helpers} from '../helpers';
import {Gender, IComment, IReview, User, UserAuthData, UserType} from '../types';


// define a schema
// let Schema: any = mongoose.Schema;

class Schema extends mongoose.Schema {
  preAnyUpdate(func: mongoose.HookSyncCallback<mongoose.Query<any>>): void {
    this.pre('update', func);
    this.pre('updateOne', func);
    this.pre(
        'updateMany', func);  // not sure this will work well, since it's many
    this.pre('findOneAndUpdate', func)
  }
  postAnyFInd<T extends Document>(
      fn: (doc: mongoose.Document, next: (err?: NativeError) => void) => void):
      this {
    this.post('findOne', fn);
    this.post(
        'find',
        function(docs: mongoose.Document, next: (err?: NativeError) => void) {
          Array.prototype.forEach.call(
              docs, (doc: mongoose.Document) => fn(doc, () => {}));
          next();
        });
    return this;
  }
}



let userSchema: Schema = new Schema({
  _id: String,
  userType: {
    type: Number,
    required: function() {
      return this.userType in UserType;
    }
  },
  firstName: {type: String, required: true},
  lastName: {type: String, required: true},
  username: {
    type: String,
    required: [
      function() {
        // username must be at least 6 letters, and english alphabet, underscore
        // and number only
        return /^[a-zA-Z0-9_]{6,}$/.test(this.username);
      },
      'username must be at least 6 characters. English alphabet, underscore and numbers only'
    ]
  },  // key/id field
  email: {
    type: String,
    required: function() {
      return helpers.validateEmail(this.email)
    },
    unique: true
  },
  gender: {
    type: Number,
    required: function() {
      return this.gender in Gender;
    }
  },
  address: {type: String, required: true},
  imageURL: {
    type: String,
    required: function() {
      return helpers.isValidURL(this.imageURL)
    }
  },
  follows: [{type: String, required: true, ref: 'User'}],
});

let userDataSchema: Schema = new Schema({
  _id: String,
  username: {
    type: String,
    required: [
      function() {
        // username must be at least 6 letters, and english alphabet, underscore
        // and number only
        return /^[a-zA-Z0-9_]{6,}$/.test(this.username);
      },
      'username must be at least 6 characters. English alphabet, underscore and numbers only'
    ]
  },  // key/id field
  recoveryKey: String,
  recoveryCreationDate: Date,
  salt: {type: String, required: true},
  hashedPassword: {type: String, required: true},
});
userDataSchema.pre('save', function(next: Function): void {
  this._id = (<any>this).username.toLowerCase();
  next();
});
userSchema.pre('save', function(next: Function): void {
  this._id = (<any>this).username.toLowerCase();
  next();
});
userSchema.preAnyUpdate(function(next) {
  let update: any = this.getUpdate();
  delete update.username;
  next();
})



let productSchema: Schema = new Schema({
  creationDate: {type: Date, default: Date.now, index: true},
  title: {type: String, required: true, minlength: 6, maxlength: 140},
  subtitle: {type: String, required: true},
  username: {type: String, required: true, ref: 'User'},
  link: {
    type: String,
    required: function() {
      return !this.link || helpers.isValidURL(this.link)
    }
  },
});


let reviewSchema = new Schema({
  creationDate: {type: Date, default: Date.now, index: true},
  username: {type: String, required: true, ref: 'User'},
  productID: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },  // product._id
  title: {type: String, required: true, minlength: 5, maxlength: 140},
  fullReview: {type: String, required: true},
  rating: {type: Number, min: 1, max: 5},  // 1-5 stars
  likes: [{type: String, required: true, ref: 'User'}],

  // the count is for cases when the likes array is spliced (for optimization)
  // it isn't required for insertion, but supposed to created in the post find
  // hooks
  likesCount: Number,
  dislikes: [{type: String, required: true, ref: 'User'}],
  dislikesCount: Number,

});



let commentSchema = new Schema({
  username: {type: String, required: true, ref: 'User'},
  creationDate: {type: Date, default: Date.now, index: true},
  reviewID: {
    type: Schema.Types.ObjectId,
    ref: 'Review',
    required: true
  },  // review._id
  comment: {type: String, minlength: 1, required: true},
  likes: [{
    type: String,
    required: true,
    ref: 'User'
  }],  // array of usernames of those who liked the comment
  likesCount: Number,

  dislikes: [{
    type: String,
    required: true,
    ref: 'User'
  }],  // array of username of dislikes
  dislikesCount: Number,

})


//#region hooks
// productSchema.preAnyUpdate(function(next: Function) {
//   delete this.getUpdate().username;
//   next();
// });

// productSchema.postAnyFInd(function(
//     doc: mongoose.Document, next: Function): void {
//   console.log(doc);
//   next();
// });



// reviewSchema.preAnyUpdate(function(next: Function): void {
//   delete this.getUpdate().productID;  // don't change the product id
//   delete this.getUpdate().username;

//   next();
// });

reviewSchema.postAnyFInd(function(doc, next: Function): void {
  let d: mongoose.Document&IReview = <any>doc;
  if (d.likes && d.dislikes) {
    d.likesCount = d.likes.length;
    d.dislikesCount = d.dislikes.length;
  }
  next();
});



// commentSchema.preAnyUpdate(function(next: Function): void {
//   delete (<any>this).reviewID;  // prevent changing the review id
//   delete (<any>this).username;  // prevent changing the username
//   next();
// });

commentSchema.postAnyFInd(function(doc, next: Function): void {
  let d: mongoose.Document&IComment = <any>doc;
  if (d.likes && d.dislikes) {
    d.likesCount = d.likes.length;
    d.dislikesCount = d.dislikes.length;
  }
  next();
});

productSchema.preAnyUpdate(function(next: Function): void {
  let update: any = this.getUpdate();
  delete update.username;
  delete update.creationDate;

  next();
});
reviewSchema.preAnyUpdate(function(next: Function): void {
  let update: any = this.getUpdate();
  delete update.username;
  delete update.creationDate;
  delete update.productID;

  next();
});
commentSchema.preAnyUpdate(function(next: Function): void {
  let update: any = this.getUpdate();
  delete update.username;
  delete update.creationDate;
  delete update.reviewID;

  next();
});



//#endregion



export let userModel: mongoose.Model<any> = mongoose.model('User', userSchema);
export let userAuthDataModel: mongoose.Model<any> =
    mongoose.model('UserData', userDataSchema);

export let productModel = mongoose.model('Product', productSchema);
export let reviewModel = mongoose.model('Review', reviewSchema);
export let commentModel = mongoose.model('Comment', commentSchema);