/******************************************************************************
 * Copyright (c) Dworek 2016. All rights reserved.                            *
 *                                                                            *
 * @author Tim Visee                                                          *
 * @website http://timvisee.com/                                              *
 *                                                                            *
 * Open Source != No Copyright                                                *
 *                                                                            *
 * Permission is hereby granted, free of charge, to any person obtaining a    *
 * copy of this software and associated documentation files (the "Software"), *
 * to deal in the Software without restriction, including without limitation  *
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,   *
 * and/or sell copies of the Software, and to permit persons to whom the      *
 * Software is furnished to do so, subject to the following conditions:       *
 *                                                                            *
 * The above copyright notice and this permission notice shall be included    *
 * in all copies or substantial portions of the Software.                     *
 *                                                                            *
 * You should have received a copy of The MIT License (MIT) along with this   *
 * program. If not, see <http://opensource.org/licenses/MIT/>.                *
 ******************************************************************************/

var ObjectId = require('mongodb').ObjectId;

var config = require('../../../config');

var GameDatabase = require('./GameDatabase');
var GameModel = require('./GameModel');
var RedisUtils = require('../../redis/RedisUtils');
var ModelInstanceManager = require('../ModelInstanceManager');
var CallbackLatch = require('../../util/CallbackLatch');

/**
 * GameModelManager class.
 *
 * @class
 * @constructor
 */
var GameModelManager = function() {
    /**
     * Model instance manager.
     *
     * @type {ModelInstanceManager}
     */
    this._instanceManager = new ModelInstanceManager(GameModel);
};

/**
 * Check whether the given game ID is valid and exists.
 *
 * @param {ObjectId|string} id The game ID.
 * @param {GameModelManager~isValidGameIdCallback} callback Called with the result or when an error occurred.
 */
GameModelManager.prototype.isValidGameId = function(id, callback) {
    // Validate the object ID
    if(id === null || id === undefined || !ObjectId.isValid(id)) {
        // Call back
        callback(null, false);
        return;
    }

    // Create a callback latch
    var latch = new CallbackLatch();

    // Store the current instance
    const self = this;

    // Convert the ID to an ObjectID
    if(!(id instanceof ObjectId))
        id = new ObjectId(id);

    // TODO: Check an instance for this ID is already available?

    // Determine the Redis cache key
    var redisCacheKey = 'model:game:' + id.toString() + ':exists';

    // Check whether the game is valid through Redis if ready
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while checking game validity, falling back to MongoDB.')
                console.error(new Error(err));

                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Resolve the latch if the result is undefined, null or zero
            if(result === undefined || result === null || result == 0) {
                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // The game is valid, create an instance and call back
            //noinspection JSCheckFunctionSignatures
            callback(null, self._instanceManager.create(id));
        });
    }

    // Create a variable to store whether a game exists with the given ID
    var hasGame = false;

    // Query the database and check whether the game is valid
    GameDatabase.layerFetchFieldsFromDatabase({_id: id}, {_id: true}, function(err, data) {
        // Call back errors
        if(err !== null && err !== undefined) {
            // Encapsulate the error and call back
            callback(new Error(err), null);
            return;
        }

        // Determine whether a game exists for this ID
        hasGame = data.length > 0;

        // Call back with the result
        callback(null, hasGame);

        // Store the result in Redis if ready
        if(RedisUtils.isReady()) {
            // Store the results
            RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, hasGame ? 1 : 0, function(err) {
                // Show a warning on error
                if(err !== null && err !== undefined) {
                    console.error('A Redis error occurred when storing Game ID validity, ignoring.')
                    console.error(new Error(err));
                }
            });
        }
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback GameModelManager~isValidGameIdCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean} True if a game with this ID exists, false if not.
 */

/**
 * Get a game by it's game ID.
 *
 * @param {ObjectId|string} id The game ID.
 * @param {GameModelManager~getGameByIdCallback} callback Called with the game or when an error occurred.
 */
GameModelManager.prototype.getGameById = function(id, callback) {
    this.isValidGameId(id, function(err, result) {
        // Call back errors
        if(err !== null) {
            callback(err, null);
            return;
        }

        // Call back the result
        callback(null, result ? self._instanceManager.create(id) : null);
    })
};

/**
 * Called with the game or when an error occurred.
 *
 * @callback GameModelManager~getGameByIdCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Game|null} Game instance, or null if no game was found for the given ID.
 */

// Return the created class
module.exports = GameModelManager;
