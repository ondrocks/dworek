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

var PacketType = require('../PacketType');
var Core = require('../../../Core');

/**
 * Type of packets to handle by this handler.
 * @type {number} Packet type.
 */
const HANDLER_PACKET_TYPE = PacketType.AUTH_REQUEST;

/**
 * Authentication request handler.
 *
 * @param {boolean=false} init True to initialize after constructing.
 *
 * @class
 * @constructor
 */
var AuthenticationRequestHandler = function(init) {
    // Initialize
    if(init)
        this.init();
};

/**
 * Initialize the handler.
 */
AuthenticationRequestHandler.prototype.init = function() {
    // Make sure the real time instance is initialized
    if(Core.realTime == null)
        throw new Error('Real time server not initialized yet');

    // Register the handler
    Core.realTime.getPacketProcessor().registerHandler(HANDLER_PACKET_TYPE, this.handler);
};

/**
 * Handle the packet.
 *
 * @param {Object} packet Packet object.
 */
AuthenticationRequestHandler.prototype.handler = function(packet) {
    // TODO: Create handler here!
    console.log('### CALLED AUTH HANDLER!');
};
