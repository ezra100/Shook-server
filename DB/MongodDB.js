"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// import the mongoose module
const mongoose = require("mongoose");
// set up default mongoose connection
var connectionString = 'mongodb://127.0.0.1/shook';
mongoose.connect(connectionString);
// get the default connection
var mdb = mongoose.connection;
//#region schema
// define a schema
let Schema = mongoose.Schema;
let userSchema = new Schema({
    _id: String,
    className: String,
    firstName: String,
    lastName: String,
    username: String,
    email: { type: String, index: { unique: true } },
    gender: Number,
    address: String,
    image: String,
});
let userDataSchema = new Schema({
    _id: String,
    username: String,
    recoveryKey: String,
    recoveryCreationDate: Date,
    salt: String,
    hashedPassword: String,
});
userDataSchema.pre('save', function (next) {
    this._id = this.username;
    next();
});
userSchema.pre('save', function (next) {
    this._id = this.username;
    next();
});
let userModel = mongoose.model('User', userSchema);
let userDataModel = mongoose.model('UserData', userDataSchema);
//#endregion
// bind connection to error event (to get notification of connection errors)
mdb.on('error', console.error.bind(console, 'MongoDB connection error:'));
class MongoDB {
    getUserAuthData(username) {
        return new Promise((resolve, reject) => {
            userDataModel.findById(username, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data);
            });
        });
    }
    updateUserAuthData(username, data) {
        return new Promise((resolve, reject) => {
            userDataModel.findByIdAndUpdate(username, data, { upsert: true }, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
    createUserAuthData(data) {
        return new Promise((resolve, reject) => {
            userDataModel.create(data, (err, rData) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
    findUserByEmail(email) {
        return new Promise((resolve, reject) => {
            userModel.findOne({ email: email }, (err, user) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(user);
            });
        });
    }
    //#region users
    // todo: update this
    getUsers(filter = {}) {
        for (const key of Object.keys(filter)) {
            if (filter[key] === '') {
                delete filter[key];
                continue;
            }
            switch (getUserKeyType(key)) {
                case 'string':
                    // replace it with a regex that will search for any one of the given
                    // words
                    filter[key] = new RegExp(filter[key]
                        .split(/\s+/)
                        // escape regex characters
                        .map((v) => v.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'))
                        .join('|'), 'gi');
                    break;
                case 'boolean':
                    if (typeof filter[key] === 'string') {
                        if (filter[key] === '') {
                            delete filter[key];
                        }
                        else {
                            filter[key] = (filter[key] === 'true');
                        }
                    }
                    break;
                case 'number':
                    // exception for 'gender' since it's an enum
                    if (typeof filter[key] === 'string' ||
                        filter[key] instanceof String) {
                        filter[key] = parseInt(filter[key], 10);
                    }
                    if (key === 'gender' && filter[key] === 0) {
                        delete filter[key];
                    }
            }
        }
        return new Promise((resolve, reject) => {
            userModel.find(filter, (err, users) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(users);
            });
        });
    }
    findUser(username) {
        return new Promise((resolve, reject) => {
            userModel.findById(username, (err, user) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(user);
            });
        });
    }
    updateUserById(username, user) {
        //prevent changing the username
        delete user.username;
        return new Promise((resolve, reject) => {
            userModel.findByIdAndUpdate(username, user, (err, oldUser) => {
                if (err) {
                    reject(err);
                    return;
                }
                // sending back the new one
                resolve(Object.assign([], oldUser, user));
            });
        });
    }
    addUser(user) {
        return new Promise((resolve, reject) => {
            let userDoc = new userModel(user);
            userDoc.save((err, user) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(user);
            });
        });
    }
    deleteUser(user) {
        return new Promise((resolve, reject) => {
            userModel.findByIdAndRemove(user.username, (err, user) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(user);
            });
        });
    }
}
function getUserKeyType(key) {
    return userModel.schema.paths[key].instance.toLowerCase();
}
exports.db = new MongoDB();
//# sourceMappingURL=MongodDB.js.map