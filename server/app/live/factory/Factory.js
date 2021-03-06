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

var mongo = require('mongodb');
var ObjectId = mongo.ObjectId;
var _ = require('lodash');

var config = require('../../../config');

var Core = require('../../../Core');
var PacketType = require('../../realtime/PacketType');
var FactoryModel = require('../../model/factory/FactoryModel');
var CallbackLatch = require('../../util/CallbackLatch');

/**
 * Factory class.
 *
 * @param {FactoryModel|ObjectId|string} factory Factory model instance or the ID of a factory.
 * @param {Game} game Game instance.
 *
 * @class
 * @constructor
 */
var Factory = function(factory, game) {
    /**
     * ID of the factory this object corresponds to.
     * @type {ObjectId}
     */
    this._id = null;

    /**
     * Live game instance.
     * @type {Game} Game.
     * @private
     */
    this._game = game;

    /**
     * Array containing live users this factory is currently visible for.
     *
     * @type {Array} Array of live user objects.
     * @private
     */
    this._userVisibleMem = [];

    /**
     * Array containing live users this factory is in range for.
     *
     * @type {Array} Array of live user objects.
     * @private
     */
    this._userRangeMem = [];

    /**
     * Array containing live users this factory is pinged for.
     *
     * @type {Array} Array of live user objects.
     * @private
     */
    this._userPingMem = [];

    // Get and set the factory ID
    if(factory instanceof FactoryModel)
        this._id = factory.getId();
    else if(!(factory instanceof ObjectId) && ObjectId.isValid(factory))
        this._id = new ObjectId(factory);
    else if(!(factory instanceof ObjectId))
        throw new Error('Invalid factory instance or ID');
    else
        this._id = factory;
};

/**
 * Get the factory ID for this factory.
 *
 * @return {ObjectId} Factory ID.
 */
Factory.prototype.getId = function() {
    return this._id;
};

/**
 * Get the hexadecimal ID representation of the factory.
 *
 * @returns {string} Factory ID as hexadecimal string.
 */
Factory.prototype.getIdHex = function() {
    return this.getId().toString();
};

/**
 * Check whether the give factory instance or ID equals this factory.
 *
 * @param {FactoryModel|ObjectId|string} factory Factory instance or the factory ID.
 * @return {boolean} True if this factory equals the given factory instance.
 */
Factory.prototype.isFactory = function(factory) {
    // Get the factory ID as an ObjectId
    if(factory instanceof FactoryModel)
        factory = factory.getId();
    else if(!(factory instanceof ObjectId) && ObjectId.isValid(factory))
        factory = new ObjectId(factory);
    else if(!(factory instanceof ObjectId))
        throw Error('Invalid factory ID');

    // Compare the factory ID
    return this._id.equals(factory);
};

/**
 * Get the factory model.
 *
 * @return {FactoryModel} Factory model instance.
 */
Factory.prototype.getFactoryModel = function() {
    return Core.model.factoryModelManager._instanceManager.create(this._id);
};

/**
 * Get the factory name.
 *
 * @param {Factory~getNameCallback} callback Callback with the result.
 */
Factory.prototype.getName = function(callback) {
    this.getFactoryModel().getName(callback);
};

/**
 * @callback Factory~getNameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {string=} Factory name.
 */

/**
 * Get the live game instance.
 * @return {Game} Game.
 */
Factory.prototype.getGame = function() {
    return this._game;
};

/**
 * Unload this live factory instance.
 *
 * @param {Factory~loadCallback} callback Called on success or when an error occurred.
 */
Factory.prototype.load = function(callback) {
    callback(null);
};

/**
 * Called on success or when an error occurred.
 *
 * @callback Factory~loadCallback
 * @param {Error|null} Error instance if an error occurred, null on success.kk
 */

/**
 * Unload this live factory instance.
 */
Factory.prototype.unload = function() {};

/**
 * @callback Factory~calculateCostCallback
 * @param {Error|null} Error instance if an error occurred.
 * @param {Number=} Factory cost.
 */

/**
 * Send the factory data to the given user.
 *
 * @param {UserModel} user User to send the packet data to.
 * @param {Array|*|undefined} sockets A socket, or array of sockets to send the data to, or undefined.
 * @param callback
 */
Factory.prototype.sendData = function(user, sockets, callback) {
    // Create a data object to send back
    var factoryData = {};

    // Store this instance
    const self = this;

    // Make sure we only call back once
    var calledBack = false;

    // Create a function to send the factory data packet
    const sendFactoryData = function() {
        // Create a packet object
        const packetObject = {
            factory: self.getIdHex(),
            game: self.getGame().getIdHex(),
            data: factoryData
        };

        // Check whether we've any sockets to send the data directly to
        if(sockets.length > 0)
            sockets.forEach(function(socket) {
                Core.realTime.packetProcessor.sendPacket(PacketType.FACTORY_DATA, packetObject, socket);
            });

        else
            Core.realTime.packetProcessor.sendPacketUser(PacketType.FACTORY_DATA, packetObject, user);

        // Call back
        callback(null);
    };

    // Get the game
    const liveGame = this.getGame();
    const game = liveGame.getGameModel();

    // Get the factory model
    const factoryModel = this.getFactoryModel();

    // Create a callback latch
    var latch = new CallbackLatch();

    // Parse the sockets
    if(sockets === undefined)
        sockets = [];
    else if(!_.isArray(sockets))
        sockets = [sockets];

    // Get the game user
    latch.add();
    liveGame.getUser(user, function(err, liveUser) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Check whether this factory is visible for the given live user
        self.isVisibleFor(liveUser, function(err, visible) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Set the visibility status
            factoryData.visible = visible;

            // Resolve the latch
            latch.resolve();
        });
    });

    // Check whether the user has management permissions
    latch.add();
    game.hasManagePermission(user, function(err, canManage) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the can manage flag in the factory data
        factoryData.canManage = canManage;

        // Resolve the latch
        latch.resolve();
    });

    // Continue when we're done
    latch.then(function() {
        // Send the data if no visible
        if(!factoryData.visible) {
            sendFactoryData();
            return;
        }

        // Make sure the factory is part of this game
        factoryModel.getGame(function(err, result) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Compare the games
            if(!game.getId().equals(result.getId())) {
                if(!calledBack)
                    callback(new Error('The factory is not part of this game'));
                calledBack = true;
                return;
            }

            // Get the live factory
            factoryModel.getLiveFactory(function(err, liveFactory) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // TODO: Make sure the user has rights to view this factory!

                // Reset the latch
                latch.identity();

                // Get the factory name
                latch.add();
                factoryModel.getName(function(err, name) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the name
                    factoryData.name = name;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the factory level
                latch.add();
                factoryModel.getLevel(function(err, level) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the level
                    factoryData.level = level;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the defence value
                latch.add();
                factoryModel.getDefence(function(err, defence) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the defence
                    factoryData.defence = defence;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the factory conquer value
                latch.add();
                liveFactory.getConquer(function(err, conquerValue, userCount) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the conquer value and user count
                    factoryData.conquerValue = conquerValue;
                    factoryData.conquerUserCount = userCount;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the input
                latch.add();
                factoryModel.getIn(function(err, input) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the input
                    factoryData.in = input;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the output
                latch.add();
                factoryModel.getOut(function(err, output) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the defence
                    factoryData.out = output;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the creator
                latch.add();
                factoryModel.getUser(function(err, creator) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Get the display name of the user
                    latch.add();
                    creator.getDisplayName(function(err, displayName) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // Set the display name
                        factoryData.creatorName = displayName;

                        // Resolve the latch
                        latch.resolve();
                    });

                    // Get the team
                    latch.add();
                    factoryModel.getTeam(function(err, factoryTeam) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // Get the team name
                        factoryTeam.getName(function(err, teamName) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    callback(err);
                                calledBack = true;
                                return;
                            }

                            // Set the team name
                            factoryData.teamName = teamName;

                            // Resolve the latch
                            latch.resolve();
                        });
                    });

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the input production
                latch.add();
                self.getProductionIn(function(err, production) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the production
                    factoryData.productionIn = production;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the output production
                latch.add();
                self.getProductionOut(function(err, production) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the production
                    factoryData.productionOut = production;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the defence upgrades
                latch.add();
                self.getDefenceUpgrades(function(err, defenceUpgrades) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the production
                    factoryData.defenceUpgrades = defenceUpgrades;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the next level cost
                latch.add();
                self.getNextLevelCost(function(err, nextLevelCost) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the production
                    factoryData.nextLevelCost = nextLevelCost;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the live user this data is send to
                latch.add();
                self.getGame().getUser(user, function(err, liveUser) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Get the visibility state for the user
                    self.getVisibilityState(liveUser, function(err, visibilityState) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // Set the visibility, range and ally states
                        factoryData.inRange = visibilityState.inRange;
                        factoryData.ally = visibilityState.ally;

                        // Resolve the latch
                        latch.resolve();
                    });
                });

                // Send the factory data
                latch.then(function() {
                    sendFactoryData();
                });
            });
        });
    });
};

/**
 * Broadcast the factory data to all relevant users.
 *
 * @param {Factory~broadcastDataCallback} [callback] Called on success or when an error occurred.
 */
Factory.prototype.broadcastData = function(callback) {
    // Store the current instance
    const self = this;

    // Create a callback latch
    var latch = new CallbackLatch();

    // Only call back once
    var calledBack = false;

    // Loop through the list of live users for this factory
    this.getGame().userManager.users.forEach(function(liveUser) {
        // Make sure the factory is visible for the user
        latch.add();
        self.isVisibleFor(liveUser, function(err, visible) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    if(_.isFunction(callback))
                        callback(err);
                calledBack = true;
                return;
            }

            // Send the game data if the factory is visible for the current live user
            if(visible)
                // Send the data
                self.sendData(liveUser.getUserModel(), undefined, function(err) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            if(_.isFunction(callback))
                                callback(err);
                        calledBack = true;
                        return;
                    }

                    // Resolve the latch
                    latch.resolve();
                });

            else
                // Resolve the latch if the factory isn't visible
                latch.resolve();
        });
    });

    // Call back when we're done
    latch.then(() => {
        if(_.isFunction(callback))
            callback(null);
    });
};

/**
 * Called on success or when an error occurred.
 *
 * @callback Factory~broadcastDataCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Get the team of the factory.
 *
 * @param {function} callback callback(err, team)
 */
Factory.prototype.getTeam = function(callback) {
    this.getFactoryModel().getTeam(callback);
};

/**
 * Check whether this factory is visible for the given user.
 *
 * @param {User} liveUser Given user.
 * @param {function} callback callback(err, isVisible)
 */
Factory.prototype.isVisibleFor = function(liveUser, callback) {
    // Store this instance
    const self = this;

    // Get the game stage
    this.getGame().getGameModel().getStage(function(err, gameStage) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Call back true if the game is finished
        if(gameStage >= 2) {
            callback(null, true);
            return;
        }

        // Get the visibility state for the user
        self.getVisibilityState(liveUser, function(err, visibilityState) {
            // Call back errors
            if(err !== null) {
                callback(err);
                return;
            }

            // Call back with the result
            callback(null, visibilityState.visible);
        });
    });
};

/**
 * Update the visibility state for the given user.
 *
 * @param {User} liveUser User to update the visibility state for.
 * @param {Factory~updateVisibilityStateCallback} callback Called with the result or when an error occurred.
 */
Factory.prototype.updateVisibilityState = function(liveUser, callback) {
    // Store this instance
    const self = this;

    // Call back if the user is null
    if(liveUser === null) {
        callback(null);
        return;
    }

    // Get the visibility data for the given user
    this.getVisibilityState(liveUser, function(err, visibilityData) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Set whether the state changed
        var stateChanged = false;

        // Set the visibility and range state, remember whether any of these states changed
        if(self.setInVisibilityMemory(liveUser, visibilityData.visible))
            stateChanged = true;
        if(self.setInRangeMemory(liveUser, visibilityData.inRange))
            stateChanged = true;

        // Send the factory data if the state changed
        if(stateChanged)
            // Broadcast the factory data to all relevant user
            self.broadcastData(function(err) {
                // Call back errors
                if(err !== null) {
                    callback(err);
                    return;
                }

                // Call back
                callback(null, true);
            });

        else
            // Call back
            callback(null, false);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback Factory~updateVisibilityStateCallback
 * @param {Error|null} Error instance if an error occurred.
 * @param {boolean=} True if the state changed, false if not.
 */

/**
 * Check whether the given user is in the visibility memory.
 *
 * @param {User} liveUser User.
 */
Factory.prototype.isInVisibilityMemory = function(liveUser) {
    return this._userVisibleMem.indexOf(liveUser) >= 0;
};

/**
 * Set whether the given live user is in the visibility memory of the factory.
 *
 * @param {User} liveUser Live user instance to set the state for.
 * @param {boolean} visible True to set the visibility state to true, false otherwise.
 * @return {boolean} True if the state changed, false if not.
 */
Factory.prototype.setInVisibilityMemory = function(liveUser, visible) {
    // Get the memorized visibility state
    const lastState = this.isInVisibilityMemory(liveUser);

    // Return false if the state didn't change
    if(lastState === visible)
        return false;

    // Update the visibility array
    if(visible)
        this._userVisibleMem.push(liveUser);
    else
        this._userVisibleMem.splice(this._userVisibleMem.indexOf(liveUser), 1);

    // Return the result
    return true;
};

/**
 * Check whether the given user is in the range memory.
 *
 * @param {User} liveUser User.
 */
Factory.prototype.isInRangeMemory = function(liveUser) {
    return this._userRangeMem.indexOf(liveUser) >= 0;
};

/**
 * Set whether the given live user is in the range memory of the factory.
 *
 * @param {User} liveUser Live user instance to set the state for.
 * @param {boolean} inRange True to set the in range state to true, false otherwise.
 * @return {boolean} True if the state changed, false if not.
 */
Factory.prototype.setInRangeMemory = function(liveUser, inRange) {
    // Get the memorized range state
    const lastState = this.isInRangeMemory(liveUser);

    // Return false if the state didn't change
    if(lastState === inRange)
        return false;

    // Update the range array
    if(inRange)
        this._userRangeMem.push(liveUser);
    else
        this._userRangeMem.splice(this._userRangeMem.indexOf(liveUser), 1);

    // Return the result
    return true;
};

/**
 * Check whether the given user is in the pinged memory.
 *
 * @param {User} liveUser User.
 */
Factory.prototype.isInPingMemory = function(liveUser) {
    return this._userPingMem.indexOf(liveUser) >= 0;
};

/**
 * Set whether the given live user is in the ping memory of the factory.
 *
 * @param {User} liveUser Live user instance to set the state for.
 * @param {boolean} isPinged True to set the in ping state to true, false otherwise.
 * @param {boolean|undefined=true} sendLocationUpdate True to send new location data to the user, which shows the factory on the map.
 * @return {boolean} True if the state changed, false if not.
 */
Factory.prototype.setInPingMemory = function(liveUser, isPinged, sendLocationUpdate) {
    // Get the memorized ping state
    const lastState = this.isInPingMemory(liveUser);

    // Return false if the state didn't change
    if(lastState === isPinged)
        return false;

    // Update the ping array
    if(isPinged)
        this._userPingMem.push(liveUser);
    else
        this._userPingMem.splice(this._userPingMem.indexOf(liveUser), 1);

    // Update the location data for the live user
    if(sendLocationUpdate === undefined || sendLocationUpdate)
        Core.gameManager.broadcastLocationData(isPinged ? config.game.locationUpdateInterval : null, liveUser.getGame(), liveUser, undefined, function(err) {
            // Show errors
            if(err !== null) {
                console.error('Failed to broadcast location data to user, ignoring');
                console.error(err.stack || err);
            }
        });

    // Return the result
    return true;
};

/**
 * Ping this factory for the given user and the given duration.
 *
 * @param {User} liveUser User to ping the factory for.
 * @param {Number} pingDuration Duration of the ping in milliseconds.
 * @param {boolean|undefined=true} sendLocationUpdate True to send new location data to the user, which shows the factory on the map.
 * @param {Factory~pingForCallback} [callback] Called back when the ping decayed, or when an error occurred.
 */
Factory.prototype.pingFor = function (liveUser, pingDuration, sendLocationUpdate, callback) {
    // Make sure the user is valid, and that the ping duration is a positive number
    if(liveUser === null && pingDuration <= 0) {
        if(_.isFunction(callback))
            callback(new Error('Invalid live user instance or invalid ping duration.'));
        return;
    }

    // Add the live user to the ping memory
    this.setInPingMemory(liveUser, true, sendLocationUpdate );

    // Store this instance
    const self = this;

    // Create a timeout to remove the user from the ping memory
    setTimeout(function() {
        // Remove the user from the ping memory
        self.setInPingMemory(liveUser, false, true);

        // Call the callback
        if(_.isFunction(callback))
            callback(null);

    }, pingDuration);
};

/**
 * Called when the ping has decayed, or when an error occurred.
 *
 * @callback Factory~pingForCallback
 * @param {Error|null} Error instance if an error occurred.
 */

/**
 * Calculate the input production per tick.
 *
 * @param callback (err, productionValue)
 */
Factory.prototype.getProductionIn = function(callback) {
    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Get the game config and level
    var gameConfig = null;
    var level = null;

    // Get the game config
    latch.add();
    this.getGame().getConfig(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the game config
        gameConfig = result;

        // Resolve the latch
        latch.resolve();
    });

    // Get the factory level
    latch.add();
    this.getFactoryModel().getLevel(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the level
        level = result;

        // Resolve the latch
        latch.resolve();
    });

    // Calculate the production in
    latch.then(function() {
        callback(null, gameConfig.factory.getProductionIn(level));
    });
};

/**
 * Calculate the output production per tick.
 *
 * @param callback (err, productionValue)
 */
Factory.prototype.getProductionOut = function(callback) {
    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Get the game config and level
    var gameConfig = null;
    var level = null;

    // Get the game config
    latch.add();
    this.getGame().getConfig(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the game config
        gameConfig = result;

        // Resolve the latch
        latch.resolve();
    });

    // Get the game level
    latch.add();
    this.getFactoryModel().getLevel(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the level
        level = result;

        // Resolve the latch
        latch.resolve();
    });

    // Calculate the production in
    latch.then(function() {
        callback(null, gameConfig.factory.getProductionOut(level));
    });
};

/**
 * Calculate the cost of the next level.
 *
 * @param callback (err, levelCost)
 */
Factory.prototype.getNextLevelCost = function(callback) {
    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Get the game config and level
    var gameConfig = null;
    var level = null;

    // Get the game config
    latch.add();
    this.getGame().getConfig(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the game config
        gameConfig = result;

        // Resolve the latch
        latch.resolve();
    });

    // Get the game level
    latch.add();
    this.getFactoryModel().getLevel(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the level
        level = result;

        // Resolve the latch
        latch.resolve();
    });

    // Calculate the production in
    latch.then(function() {
        callback(null, gameConfig.factory.getLevelCost(level + 1));
    });
};

/**
 * Get the defence value for this factory.
 *
 * @param {Factory~getDefenceCallback} callback Called back with the defence value or when an error occurred.
 * @param {Object} options Model options.
 */
Factory.prototype.getDefence = function(callback, options) {
    this.getFactoryModel().getDefence(callback, options);
};

/**
 * Called back with the defence value or when an error occurred.
 *
 * @callback Factory~getDefenceCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Number=} Defence value for this factory.
 */

/**
 * Get the level for this factory.
 *
 * @param {Factory~getLevelCallback} callback Called back with the level value or when an error occurred.
 * @param {Object} options Model options.
 */
Factory.prototype.getLevel = function(callback, options) {
    this.getFactoryModel().getLevel(callback, options);
};

/**
 * Called back with the level value or when an error occurred.
 *
 * @callback Factory~getLevelCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Number=} Level value for this factory.
 */

/**
 * Get the defence upgrades object.
 *
 * @param callback (err, upgradesObject)
 */
Factory.prototype.getDefenceUpgrades = function(callback) {
    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Get the game config and level
    var gameConfig = null;
    var defence = null;

    // Get the game config
    latch.add();
    this.getGame().getConfig(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the game config
        gameConfig = result;

        // Resolve the latch
        latch.resolve();
    });

    // Get the defence
    latch.add();
    this.getFactoryModel().getDefence(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the defence
        defence = result;

        // Resolve the latch
        latch.resolve();
    });

    // Get the upgrades
    latch.then(function() {
        callback(null, gameConfig.factory.getDefenceUpgrades(defence));
    });
};

/**
 * Check whether the given user can modify this factory.
 * @param {UserModel} user
 * @param callback callback(err, canModify)
 */
Factory.prototype.canModify = function(user, callback) {
    // Create a callback latch
    var latch = new CallbackLatch();

    // Store this instance
    const self = this;

    // Only call back once
    var calledBack = false;

    // Create a variable for the factory and user's team
    var factoryTeam = null;
    var userTeam = null;

    // Get the factory team
    latch.add();
    this.getTeam(function(err, team) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the factory team
        factoryTeam = team;

        // Resolve the latch
        latch.resolve();
    });

    // Get the game user instance for the given user
    latch.add();
    Core.model.gameUserModelManager.getGameUser(this.getGame().getGameModel(), user, function(err, gameUser) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Get team of the user
        gameUser.getTeam(function(err, team) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Set the user's team
            userTeam = team;

            // Resolve the latch
            latch.resolve();
        });
    });

    // Continue when we're done fetching both teams
    latch.then(function() {
        // Call back if any of the teams is null
        if(factoryTeam === null || userTeam === null) {
            callback(null, false);
            return;
        }

        // Call back if both teams aren't matching
        if(!factoryTeam.getId().equals(userTeam.getId())) {
            callback(null, false);
            return;
        }

        // Get the live user instance for the given user
        self.getGame().getUser(user, function(err, liveUser) {
            // Call back errors
            if(err !== null) {
                callback(err);
                return;
            }

            // Check whether the live user is in range
            self.isUserInRange(liveUser, function(err, inRange) {
                // Call back errors
                if(err !== null) {
                    callback(err);
                    return;
                }

                // Call back with the result
                callback(null, inRange);
            });
        });
    });
};

/**
 * Check whether the given live user is in range.
 * @param liveUser Live user.
 * @param callback (err, inRange)
 */
Factory.prototype.isUserInRange = function(liveUser, callback) {
    // Make sure a proper live user is given, and that he has a recent location
    if(liveUser === null || !liveUser.hasRecentLocation()) {
        callback(null, false);
        return;
    }

    // Create a callback latch
    var latch = new CallbackLatch();

    // Call back only once
    var calledBack = false;

    // Store the factory range and location
    var factoryRange;
    var factoryLocation;

    // Get the range of the factory
    latch.add();
    this.getRange(liveUser, function(err, range) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Store the range
        factoryRange = range;

        // Resolve the latch
        latch.resolve();
    });

    // Get the factory location
    latch.add();
    this.getFactoryModel().getLocation(function(err, location) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Store the factory location
        factoryLocation = location;

        // Resolve the latch
        latch.resolve();
    });

    // Call back when we're done
    latch.then(() => callback(null, factoryLocation.isInRange(liveUser.getLocation(), factoryRange)));
};

/**
 * Invoke a tick for this factory.
 *
 * @param {Factory~tickCallback} callback Called on success or when an error occurred.
 */
Factory.prototype.tick = function(callback) {
    // Create a callback latch
    var latch = new CallbackLatch();

    // Only call back once
    var calledBack = false;

    // Store this instance
    const self = this;

    // Create a variable for the production and value in/out
    var productionIn,
        productionOut,
        valueIn;

    // Get the production in
    latch.add();
    this.getProductionIn(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the production in
        productionIn = result;

        // Resolve the latch
        latch.resolve();
    });

    // Get the production out
    latch.add();
    this.getProductionOut(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the production out
        productionOut = result;

        // Resolve the latch
        latch.resolve();
    });

    // Get the value in
    latch.add();
    this.getFactoryModel().getIn(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the value in
        valueIn = result;

        // Resolve the latch
        latch.resolve();
    }, {
        noCache: true
    });

    // Continue
    latch.then(function() {
        // Make sure we've enough in
        if(valueIn < productionIn) {
            callback(null);
            return;
        }

        // Reset the latch to it's identity
        latch.identity();

        // Subtract the in value
        latch.add();
        self.getFactoryModel().subtractIn(productionIn, function(err) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Resolve the latch
            latch.resolve();
        });

        // Add the out value
        latch.add();
        self.getFactoryModel().addOut(productionOut, function(err) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Resolve the latch
            latch.resolve();
        });

        // Broadcast the location data when we're done, an call back
        latch.then(function() {
            self.broadcastData(callback);
        });
    });
};

/**
 * Called on success or when an error occurred.
 *
 * @callback Factory~tickCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 */

/**
 * Get the range of the factory.
 *
 * @param {User|undefined} liveUser Live user instance to get the range for, or undefined to get the global factory range.
 * @param {Factory~getRangeCallback} callback Called back with the range or when an error occurred.
 */
Factory.prototype.getRange = function(liveUser, callback) {
    // Store this instance
    const self = this;

    // Create a callback latch
    var latch = new CallbackLatch();

    // Only call back once
    var calledBack = false;

    // Get the config and lab level
    var gameConfig = null;
    var level = null;

    // Get the game config
    latch.add();
    this.getGame().getConfig(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the config
        gameConfig = result;

        // Resolve the latch
        latch.resolve();
    });

    // Get the lab level
    latch.add();
    this.getLevel(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the lab level
        level = result;

        // Resolve the latch
        latch.resolve();
    });

    // Determine and call back the range when we fetched the required data
    latch.then(function() {
        // Check whether the active or global range should be used, call back the result
        if(self.isInRangeMemory(liveUser))
            callback(null, gameConfig.factory.getActiveRange(level));
        else
            callback(null, gameConfig.factory.getRange(level));
    });
};

/**
 * Called back with the range or when an error occurred.
 *
 * @callback Factory~getRangeCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 * @param {Number=} Factory range in meters.
 */

/**
 * Check whether this factory is visible for the given user.
 *
 * @param {User} liveUser Given user.
 * @param {Factory~getVisibilityStateCallback} callback Called with the result or when an error occurred.
 */
Factory.prototype.getVisibilityState = function(liveUser, callback) {
    // Create a result object
    var resultObject = {
        ally: false,
        visible: false,
        inRange: false,
        pinged: false
    };

    // Make sure a valid user is given
    if(liveUser === null) {
        callback(null, resultObject);
        return;
    }

    // Get the factory model and make sure it's valid
    const factoryModel = this.getFactoryModel();
    if(factoryModel === null) {
        callback(null, resultObject);
        return;
    }

    // Get the user and game model
    const userModel = liveUser.getUserModel();
    const gameModel = this.getGame().getGameModel();

    // Define the current instance
    const self = this;

    // Create a callback latch
    var latch = new CallbackLatch();

    // Create a callback latch for the ally check
    var allyLatch = new CallbackLatch();

    // Only call back once
    var calledBack = false;

    // Create a variable for the factor and user team
    var factoryTeam = null;
    var userTeam = null;

    // Get the factory's team
    allyLatch.add();
    this.getTeam(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Store the factory team
        factoryTeam = result;

        // Resolve the latch
        allyLatch.resolve();
    });

    // Get the game user
    latch.add();
    allyLatch.add();
    Core.model.gameUserModelManager.getGameUser(gameModel, userModel, function(err, gameUser) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Resolve the latch if the game user is null
        if(gameUser === null) {
            latch.resolve();
            allyLatch.resolve();
            return;
        }

        // Get the user's team
        gameUser.getTeam(function(err, result) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Set the user
            userTeam = result;

            // Resolve the ally latch
            allyLatch.resolve();
        });

        // Resolve the latch
        latch.resolve();
    });

    // Get the game stage
    latch.add();
    gameModel.getStage(function(err, gameStage) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Get the user state
        gameModel.getUserState(userModel, function(err, userState) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Set the visibility state if the user is a spectator
            if(userState.spectator || gameStage >= 2) {
                resultObject.visible = true;
                resultObject.inRange = false;
            }

            // Set the visibility to true if the factory is pinged
            if(self.isInPingMemory(liveUser)) {
                resultObject.visible = true;
                resultObject.pinged = true;
            }

            // Determine whether the factory is ally when we fetched the team data
            latch.add();
            allyLatch.then(function() {
                // Make sure the user is a player
                if(!userState.player) {
                    latch.resolve();
                    return;
                }

                // Set the ally and visibility status if the teams equal and aren't null
            if(factoryTeam !== null && userTeam !== null && factoryTeam.getId().equals(userTeam.getId())) {
                    resultObject.ally = true;
                    resultObject.visible = true;
                }

                // Resolve the latch
                latch.resolve();
            });

            // If the user is a player or special player, check whether he's in range
            // Make sure the user has a recently known location
            if((userState.player || userState.special) && liveUser.hasRecentLocation() && gameStage < 2) {
                // Get the factory range
                latch.add();
                self.isUserInRange(liveUser, function(err, result) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set whether the user is in range
                    resultObject.inRange = result;

                    // Set the visibility state if the factory is in range
                    if(result)
                        resultObject.visible = true;

                    // Resolve the latch
                    latch.resolve();
                });
            }

            // Resolve the latch
            latch.resolve();
        });
    });

    // Call back the result object when we're done
    latch.then(function() {
        // Call back the results
        callback(null, resultObject);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback Factory~getVisibilityStateCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {VisibilityStateObject=} Object with the result.
 */

/**
 * @typedef {Object} VisibilityStateObject
 * @param {boolean} ally True if this factory is allied, false if not.
 * @param {boolean} visible True if the factory is visible for the user, false if not.
 * @param {boolean} inRange True if the factory is in the user's range, false if not.
 * @param {boolean} pinged True if the factory is pinged for the user, false if not.
 */

/**
 * Get the conquer value for this factory.
 * If this value is above zero, the factory may be taken over by an other team.
 *
 * @param {Factory~getConquerCallback} callback Called with the conquer value or when an error occurred.
 */
Factory.prototype.getConquer = function(callback) {
    // Create a variable to store the conquer value and the user count
    var conquerValue = 0;
    var userCount = 0;

    // Only call back once
    var calledBack = false;

    // Create a function to call back errors
    const callbackError = function(err) {
        if(!calledBack)
            callback(err);
        calledBack = true;
    };

    // Create a callback latch
    var latch = new CallbackLatch();

    // Store this instance
    const self = this;

    // Get the defence value of the lab
    latch.add();
    this.getDefence(function(err, defence) {
        // Call back errors
        if(err !== null) {
            callbackError(err);
            return;
        }

        // Subtract the defence value from the conquer value
        conquerValue -= defence;

        // Resolve the latch
        latch.resolve();
    });

    // Get factory team
    latch.add();
    this.getTeam(function(err, factoryTeam) {
        // Call back errors
        if(err !== null) {
            callbackError(err);
            return;
        }

        // Loop through the users that are in-range
        self._userRangeMem.forEach(function(liveUser) {
            // Make sure the user has a recently known location
            if(!liveUser.hasRecentLocation())
                return;

            // Create a callback latch for this user
            var userLatch = new CallbackLatch();

            // Create a variable to define the user strength and whether the user is in the ally team
            var ally = null;
            var userStrength = null;

            // Add a latch
            latch.add();

            // Check whether the user is ally
            userLatch.add();
            liveUser.isTeam(factoryTeam, function(err, result) {
                // Call back errors
                if(err !== null) {
                    callbackError(err);
                    return;
                }

                // Set the result
                ally = result;

                // Resolve the user latch
                userLatch.resolve();
            });

            // Get the user's strength
            userLatch.add();
            liveUser.getStrength(function(err, result) {
                // Call back errors
                if(err !== null) {
                    callbackError(err);
                    return;
                }

                // Set the team
                userStrength = result;

                // Resolve the user latch
                userLatch.resolve();
            });

            // Process the user's team and strength when fetched
            userLatch.then(function() {
                // Process the strength if valid
                if(userStrength !== null) {
                    // Add or subtract the user strength from the conquer value, depending if the user is an ally or not
                    conquerValue += ally ? -userStrength : userStrength;

                    // Increase the user count
                    userCount++;
                }

                // Resolve the latch
                latch.resolve();
            });
        });

        // Resolve the latch
        latch.resolve();
    });

    // Call back the conquer value when the latch is resolved
    latch.then(function() {
        callback(null, conquerValue, userCount);
    });
};

/**
 * Called with the conquer value or when an error occurred.
 *
 * @callback Factory~getConquerCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Number=} Current conquer value for this factory.
 * @param {Number=} Number of users that defined this conquer value.
 */

/**
 * Check whether this factory is owned by the given team.
 * Null is also called back if the team of the current factory is unknown and/or if the given team is null.
 *
 * @param {GameTeamModel} otherTeam Other team.
 * @param {Factory~isTeamCallback} callback Called back with the result or when an error occurred.
 */
Factory.prototype.isTeam = function(otherTeam, callback) {
    // Call back if the other team is null
    if(otherTeam === null) {
        callback(null, false);
        return;
    }

    // Get the team of the current user
    this.getTeam(function(err, team) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Call back false if the team is unknown
        if(team === null) {
            callback(null, false);
            return;
        }

        // Compare the teams and return the result
        callback(null, team.getId().equals(otherTeam.getId()));
    });
};

/**
 * Called back with the result or when an error occurred.
 *
 * @callback Factory~isTeamCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean=} True if the teams are the same, false if not.
 */

/**
 * Attack the factory.
 *
 * @param {User} user User that is attacking this factory.
 * @param {Factory~attackCallback} callback Called on success or when an error occurred.
 */
Factory.prototype.attack = function(user, callback) {
    // Create a callback latch
    var latch = new CallbackLatch();

    // Only call back once
    var calledBack = false;

    // Create a variable for the user's and factory's team
    var factoryTeam = null;
    var userTeam = null;
    
    // Store this instance
    const self = this;

    // Get the factory's team
    latch.add();
    self.getTeam(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the factory team
        factoryTeam = result;

        // Resolve the latch
        latch.resolve();
    });

    // Get the user's team
    latch.add();
    user.getTeam(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Make sure the user's team isn't null
        if(result === null) {
            if(!calledBack)
                callback(new Error('User doesn\'t have team'));
            calledBack = true;
            return;
        }

        // Set the user's team
        userTeam = result;

        // Resolve the latch
        latch.resolve();
    });

    // Make sure the conquer value is above zero
    latch.add();
    this.getConquer(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Make sure the value is above zero
        if(result <= 0) {
            if(!calledBack)
                callback(new Error('Conquer value must be above zero'));
            calledBack = true;
            return;
        }

        // Resolve the latch
        latch.resolve();
    });

    // Continue when the latch is resolved
    latch.then(function() {
        // Reset the latch
        latch.identity();
        
        // Make sure the user's team is different than the factories team
        if(factoryTeam !== null && factoryTeam.getId().equals(userTeam.getId())) {
            if(!calledBack)
                callback(new Error('User can\'t take over ally factory'));
            calledBack = true;
            return;
        }
        
        // Get the factory level
        self.getLevel(function(err, factoryLevel) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Destroy the factory if the level is one
            if(factoryLevel <= 1) {
                // Get the factory name, the name of the user and name of the team
                var factoryName = null;
                var userName = null;
                var userTeamName = null;

                // Get the factory name
                latch.add();
                self.getName(function(err, result) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the factory name
                    factoryName = result;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the user name
                latch.add();
                user.getName(function(err, result) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the user name
                    userName = result;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the team name
                latch.add();
                userTeam.getName(function(err, result) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the team name
                    userTeamName = result;

                    // Resolve the latch
                    latch.resolve();
                });

                // Send a broadcast to all relevant users when we fetched the data
                latch.then(function() {
                    // Destroy the factory
                    self.destroy(function() {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // Loop through the list of users
                        self.getGame().userManager.users.forEach(function(otherUser) {
                            // Get the user's team
                            otherUser.getTeam(function(err, otherTeam) {
                                // Handle errors
                                if(err !== null) {
                                    console.error('Failed to fetch user team, ignoring');
                                    console.error(err.stack || err);
                                }

                                // Make sure the user's team is known
                                if(otherTeam === null)
                                    return;

                                // Check whether this is the user itself
                                const isSelf = user.getId().equals(otherUser.getId());

                                // Determine whether the user is ally/enemy
                                const isAlly = userTeam.getId().equals(otherTeam.getId());
                                const isEnemy = factoryTeam.getId().equals(otherTeam.getId());

                                // The user must be in range if he isn't ally/enemy
                                if(!isAlly && !isEnemy && !self.isInRangeMemory(otherUser))
                                    return;

                                // Send a capture update
                                Core.realTime.packetProcessor.sendPacketUser(PacketType.FACTORY_DESTROYED, {
                                    factory: self.getId(),
                                    broadcast: true,
                                    factoryName,
                                    self: isSelf,
                                    userName,
                                    teamName: userTeamName,
                                    ally: isAlly,
                                    enemy: isEnemy
                                }, otherUser.getUserModel());

                                // Send an game data update
                                Core.gameManager.sendGameData(self.getGame().getGameModel(), otherUser.getUserModel(), undefined, function(err) {
                                    // Handle errors
                                    if(err !== null) {
                                        console.error('Failed to game data to user, ignoring');
                                        console.error(err.stack || err);
                                    }
                                });
                            });
                        });
                    });
                });

                return;
            }

            // Get the factory model
            const factoryModel = self.getFactoryModel();

            // Get the factory level, input, output and defence
            var factoryIn = 0;
            var factoryOut = 0;
            var factoryDefence = 0;

            // Get the factory in
            latch.add();
            factoryModel.getIn(function(err, result) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Set the factory in
                factoryIn = result;

                // Resolve the latch
                latch.resolve();
            });

            // Get the factory out
            latch.add();
            factoryModel.getOut(function(err, result) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Set the factory out
                factoryOut = result;

                // Resolve the latch
                latch.resolve();
            });

            // Get the factory defence
            latch.add();
            factoryModel.getDefence(function(err, result) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Set the factory defence
                factoryDefence = result;

                // Resolve the latch
                latch.resolve();
            });

            // Continue when the latch is complete
            latch.then(function() {
                // Reset the latch
                latch.identity();

                // Get the game configuration
                self.getGame().getConfig(function(err, gameConfig) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Process the factory in/out/defence values
                    factoryIn = gameConfig.factory.attackNewIn(factoryIn);
                    factoryOut = gameConfig.factory.attackNewOut(factoryOut);
                    factoryDefence = gameConfig.factory.attackNewDefence(factoryDefence);

                    // Set the factory team
                    latch.add();
                    factoryModel.setTeam(userTeam, function(err) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // Resolve the latch
                        latch.resolve();
                    });

                    // Set the factory level
                    latch.add();
                    factoryModel.setLevel(factoryLevel - 1, function(err) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // Resolve the latch
                        latch.resolve();
                    });

                    // Update the the in value
                    latch.add();
                    factoryModel.setIn(factoryIn, function(err) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // Resolve the latch
                        latch.resolve();
                    });

                    // Update the the out value
                    latch.add();
                    factoryModel.setOut(factoryOut, function(err) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // Resolve the latch
                        latch.resolve();
                    });

                    // Update the the defence value
                    latch.add();
                    factoryModel.setDefence(factoryDefence, function(err) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // Resolve the latch
                        latch.resolve();
                    });

                    // Continue when we're done
                    latch.then(function() {
                        // Reset the latch
                        latch.identity();

                        // Get the factory name, the name of the user and name of the team
                        var factoryName = null;
                        var userName = null;
                        var userTeamName = null;

                        // Get the factory name
                        latch.add();
                        self.getName(function(err, result) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    callback(err);
                                calledBack = true;
                                return;
                            }

                            // Set the factory name
                            factoryName = result;

                            // Resolve the latch
                            latch.resolve();
                        });

                        // Get the user name
                        latch.add();
                        user.getName(function(err, result) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    callback(err);
                                calledBack = true;
                                return;
                            }

                            // Set the user name
                            userName = result;

                            // Resolve the latch
                            latch.resolve();
                        });

                        // Get the team name
                        latch.add();
                        userTeam.getName(function(err, result) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    callback(err);
                                calledBack = true;
                                return;
                            }

                            // Set the team name
                            userTeamName = result;

                            // Resolve the latch
                            latch.resolve();
                        });

                        // Send a broadcast to all relevant users when we fetched the data
                        latch.then(function() {
                            // Loop through the list of users
                            self.getGame().userManager.users.forEach(function(otherUser) {
                                // Get the user's team
                                otherUser.getTeam(function(err, otherTeam) {
                                    // Handle errors
                                    if(err !== null) {
                                        console.error('Failed to fetch user team, ignoring');
                                        console.error(err.stack || err);
                                    }

                                    // Make sure the user's team is known
                                    if(otherTeam === null)
                                        return;

                                    // Check whether this is the user itself
                                    const isSelf = user.getId().equals(otherUser.getId());

                                    // Determine whether the user is ally/enemy
                                    const isAlly = userTeam.getId().equals(otherTeam.getId());
                                    const isEnemy = factoryTeam.getId().equals(otherTeam.getId());

                                    // The user must be in range if he isn't ally/enemy
                                    if(!isAlly && !isEnemy && !self.isInRangeMemory(otherUser))
                                        return;

                                    // Send a capture update
                                    Core.realTime.packetProcessor.sendPacketUser(PacketType.FACTORY_CAPTURED, {
                                        factory: self.getId(),
                                        factoryName,
                                        self: isSelf,
                                        userName,
                                        teamName: userTeamName,
                                        ally: isAlly,
                                        enemy: isEnemy
                                    }, otherUser.getUserModel());
                                });
                            });
                        });

                        // Broadcast the factory data
                        self.broadcastData(function(err) {
                            // Handle errors
                            if(err !== null) {
                                console.error('Failed to broadcast factory data to users, ignoring');
                                console.error(err.stack || err);
                            }
                        });

                        // Broadcast location data
                        Core.gameManager.broadcastLocationData(null, self.getGame(), undefined, undefined, function(err) {
                            // Handle errors
                            if(err !== null) {
                                console.error('Failed to broadcast updated location data to users, ignoring');
                                console.error(err.stack || err);
                            }
                        });

                        // Call back
                        if(!calledBack)
                            callback(null);
                    });
                });
            });
        });
    });
};

/**
 * Called when the factory has successfully been attacked or when an error occurred.
 *
 * @callback Factory~attackCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Destroy the factory.
 *
 * @param {Factory~destroyCallback} callback Called when the factory is destroyed, or when an error occurred.
 */
Factory.prototype.destroy = function(callback) {
    // Store this instance
    const self = this;

    // Delete the factory model
    this.getFactoryModel().delete(function(err) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Unload this factory and remove it from the manager
        self.getGame().factoryManager.unloadFactory(self);

        // TODO: Send an update to all clients because this factory has been destroyed. Clients should move from that page. Watch out, already done in some places!

        // We're done, call back
        callback(null);
    });
};

/**
 * Called when the factory is destroyed or when an error occurred.
 *
 * @callback Factory~destroyCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 */

/**
 * Get the factory as a string.
 *
 * @return {String} String representation.
 */
Factory.prototype.toString = function() {
    return '[Factory:' + this.getIdHex() + ']';
};

// Export the class
module.exports = Factory;