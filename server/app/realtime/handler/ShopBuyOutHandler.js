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

var _ = require('lodash');

var Core = require('../../../Core');
var PacketType = require('../PacketType');
var Formatter = require("../../format/Formatter.js");

/**
 * Type of packets to handle by this handler.
 * @type {number} Packet type.
 */
const HANDLER_PACKET_TYPE = PacketType.SHOP_BUY_OUT;

/**
 * Location update handler.
 *
 * @param {boolean=false} init True to initialize after constructing.
 *
 * @class
 * @constructor
 */
var ShopBuyOutHandler = function(init) {
    // Initialize
    if(init)
        this.init();
};

/**
 * Initialize the handler.
 */
ShopBuyOutHandler.prototype.init = function() {
    // Make sure the real time instance is initialized
    if(Core.realTime === null)
        throw new Error('Real time server not initialized yet');

    // Register the handler
    Core.realTime.getPacketProcessor().registerHandler(HANDLER_PACKET_TYPE, this.handler);
};

/**
 * Handle the packet.
 *
 * @param {Object} packet Packet object.
 * @param socket SocketIO socket.
 */
ShopBuyOutHandler.prototype.handler = function(packet, socket) {
    // Make sure we only call back once
    var calledBack = false;

    // Create a function to call back an error
    const callbackError = function(err) {
        // Print the error
        console.error('An error occurred while buying out goods from a user');
        if(err !== null && err !== undefined)
            console.error(err.stack || err);

        // Only call back once
        if(calledBack)
            return;

        // Send a message to the user
        Core.realTime.packetProcessor.sendPacket(PacketType.MESSAGE_RESPONSE, {
            error: true,
            message: 'Failed to sell goods, a server error occurred.',
            dialog: true
        }, socket);

        // Set the called back flag
        calledBack = true;
    };

    // Make sure a session is given
    if(!packet.hasOwnProperty('shop') || (!packet.hasOwnProperty('amount') && !packet.hasOwnProperty('all'))) {
        console.log('Received malformed packet');
        callbackError(new Error('Malformed packet'));
        return;
    }

    // Get the raw parameters
    const rawShop = packet.shop;
    const rawOutAmount = packet.outAmount;
    const rawAll = packet.all;

    // Make sure the user is authenticated
    if(!_.has(socket, 'session.valid') || !socket.session.valid) {
        // Send a message response to the user
        Core.realTime.packetProcessor.sendPacket(PacketType.MESSAGE_RESPONSE, {
            error: true,
            message: 'Transaction failed, you\'re not authenticated.',
            dialog: true
        }, socket);
        return;
    }

    // Get the user
    const user = socket.session.user;

    // Create a found flag
    var foundShop = false;

    // Loop through the games and shops to find the correct shop
    Core.gameManager.games.forEach(function(liveGame) {
        // Loop through the shops
        liveGame.shopManager.shops.forEach(function(liveShop) {
            // Skip if we already found the shop
            if(foundShop)
                return;

            // Check whether this is the correct shop
            if(liveShop.getToken() !== rawShop)
                return;

            // Set the found flag
            foundShop = true;

            // Get the game user
            Core.model.gameUserModelManager.getGameUser(liveGame.getGameModel(), user, function(err, gameUser) {
                // Call back errors
                if(err !== null) {
                    callbackError(err);
                    return;
                }

                // Get the live user
                liveGame.getUser(user, function(err, liveUser) {
                    // Call back errors
                    if(err !== null || liveUser === null) {
                        callbackError(err);
                        return;
                    }

                    // Make sure the user is in range
                    liveShop.isUserInRange(liveUser, function(err, inRange) {
                        // Call back errors
                        if(err !== null || !inRange) {
                            callbackError(err);
                            return;
                        }

                        // Get the shop out buy price
                        liveShop.getOutBuyPriceForGameUser(gameUser, function(err, price) {
                            // Call back errors
                            if(err !== null) {
                                callbackError(err);
                                return;
                            }

                            // The the current amount of out the user has
                            gameUser.getOut(function(err, outCurrent) {
                                // Call back errors
                                if(err !== null) {
                                    callbackError(err);
                                    return;
                                }

                                // Get the current amount of money the user has
                                gameUser.getMoney(function(err, moneyCurrent) {
                                    // Call back errors
                                    if(err !== null) {
                                        callbackError(err);
                                        return;
                                    }

                                    // Determine the amount of out to deposit
                                    var outAmount = 0;

                                    // Check whether we should use the maximum possible amount
                                    if(rawAll === true)
                                        outAmount = outCurrent;
                                    else
                                        // Parse the raw amount
                                        outAmount = parseInt(rawOutAmount);

                                    // Make sure the amount isn't above the maximum
                                    if(outAmount > outCurrent) {
                                        Core.realTime.packetProcessor.sendPacket(PacketType.MESSAGE_RESPONSE, {
                                            error: true,
                                            message: 'Failed to sell, you don\'t have this much goods available.',
                                            dialog: true
                                        }, socket);
                                        return;
                                    }

                                    // Make sure the amount isn't below zero
                                    if(outAmount < 0) {
                                        callbackError(new Error('Amount is below zero'));
                                        return;
                                    }

                                    // Make the sure the amount isn't zero
                                    if(outAmount === 0) {
                                        Core.realTime.packetProcessor.sendPacket(PacketType.MESSAGE_RESPONSE, {
                                            error: true,
                                            message: '<i>You can\'t sell no nothin\'.</i>',
                                            dialog: true
                                        }, socket);
                                        return;
                                    }

                                    // Subtract the out from the user's out balance
                                    gameUser.subtractOut(outAmount, function(err) {
                                        // Call back errors
                                        if(err !== null) {
                                            callbackError(err);
                                            return;
                                        }

                                        // Calculate the income
                                        const moneyAmount = Math.round(outAmount * price);

                                        // Add the income to the user's money balance
                                        gameUser.addMoney(moneyAmount, function(err) {
                                            // Call back errors
                                            if(err !== null) {
                                                callbackError(err);
                                                return;
                                            }

                                            // Send updated game data to the user
                                            Core.gameManager.sendGameData(liveGame.getGameModel(), user, undefined, function(err) {
                                                // Handle errors
                                                if(err !== null) {
                                                    console.error(err.stack || err);
                                                    console.error('Failed to send game data, ignoring');
                                                }
                                            });

                                            // Get the user's balance table
                                            liveUser.getBalanceTable({
                                                previousMoney: moneyCurrent,
                                                previousOut: outCurrent,
                                            }, function(err, balanceTable) {
                                                // Handle errors
                                                if (balanceTable === null || balanceTable === undefined || err !== null) {
                                                    console.error(err.stack || err);
                                                    console.error('Failed to send transaction success message, ignoring');
                                                    return;
                                                }

                                                // Send a notification to the user
                                                // TODO: Get the in and money name from the name configuration of the current game
                                                Core.realTime.packetProcessor.sendPacket(PacketType.MESSAGE_RESPONSE, {
                                                    error: false,
                                                    message: 'Sold ' + Formatter.formatGoods(outAmount) + ' ' + liveGame.__('out.name' + (outAmount === 1 ? '' : 's')) + ' for ' + Formatter.formatMoney(moneyAmount) + '.<br><br>' + balanceTable,
                                                    dialog: false,
                                                    toast: true,
                                                    ttl: 10 * 1000
                                                }, socket);
                                            });
                                        });
                                    });
                                }, {
                                    noCache: true
                                });
                            }, {
                                noCache: true
                            });
                        });
                    });
                });
            });
        });
    });

    // Call back an error if the shop wasn't found
    if(!foundShop) {
        // Send a message response to the user
        Core.realTime.packetProcessor.sendPacket(PacketType.MESSAGE_RESPONSE, {
            error: true,
            message: 'The transaction failed, couldn\'t find shop. The shop you\'re trying to use might not be available anymore.',
            dialog: true
        }, socket);
    }
};

// Export the module
module.exports = ShopBuyOutHandler;
