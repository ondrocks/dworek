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

/******************************************************************************
 * Configuration base.                                                        *
 ******************************************************************************/
var config = {};
config.debug = {};
config.db = {};
config.redis = {};
config.cache = {};
config.api = {};
config.realtime = {};
config.cluster = {};
config.web = {};
config.user = {};
config.security = {};
config.session = {};
config.validation = {};
config.game = {};
config.sentry = {};
config.lang = {};


/******************************************************************************
 * Application debug configuration.                                           *
 ******************************************************************************/

/**
 * NodeJS debug name for the server.
 * @type {string}
 */
config.debug.name = 'dworek:server';


/******************************************************************************
 * MongoDB database configuration.                                            *
 ******************************************************************************/

/**
 * MongoDB host.
 * @type {string}
 */
config.db.host = '127.0.0.1';

/**
 * MongoDB port.
 * @type {number}
 */
config.db.port = 27017;

/**
 * MongoDB database name.
 * @type {string}
 */
config.db.db = 'dworek';

/**
 * Maximum number of allowed connections in MongoDB connection pool.
 * @type {number}
 */
config.db.maxConnectionPoolSize = 20;

/**
 * MongoDB connection URL.
 * @type {string}
 */
config.db.url = 'mongodb://' + config.db.host + ':' + config.db.port + '/' + config.db.db + '?maxPoolSize=' + config.db.maxConnectionPoolSize;


/******************************************************************************
 * Redis cache configuration.                                                 *
 ******************************************************************************/

/**
 * Define whether to enable Redis usage.
 * @type {boolean}
 */
config.redis.enable = true;

/**
 * Redis host.
 * @type {string}
 */
config.redis.host = '127.0.0.1';

/**
 * Redis port.
 * @type {number}
 */
config.redis.port = 6379;

/**
 * Redis database number.
 * @type {number}
 */
config.redis.dbNumber = 1;

/**
 * Redis connection URL.
 * @type {string}
 */
config.redis.url = 'redis://' + config.redis.host + ':' + config.redis.port + '/' + config.redis.dbNumber;

/**
 * Default number of seconds it takes for cached values to expire.
 * @type {number}
 */
config.redis.cacheExpire = 60 * 5;

/**
 * Define whether to flush everything when the connection to Redis becomes ready.
 * @type {boolean}
 */
config.redis.flushWhenReady = true;


/******************************************************************************
 * Cache configuration.                                                       *
 ******************************************************************************/

/**
 * Define whether to enable internal cache.
 * @type {boolean}
 */
config.cache.enable = true;

/**
 * Internal cache section.
 * @type {Object}
 */
config.cache.internal = {};

/**
 * Interval in milliseconds to flush the internal cache.
 * @type {*|number}
 */
config.cache.internal.flushInterval = 5 * 60 * 1000;


/******************************************************************************
 * Cluster configuration.                                                     *
 ******************************************************************************/

/**
 * Maximum number of allowed worker threads.
 * Null or undefined to set it to unlimited.
 *
 * Warning: Multiple workers don't seem to work properly yet along with Socket.IO.
 *
 * @type {null|number}
 */
config.cluster.maxWorkerCount = 1;


/******************************************************************************
 * Web configuration.                                                         *
 ******************************************************************************/

/**
 * HTTP web server listening port.
 * Requests to this port will be redirected to HTTPS if SSL is enabled.
 * @type {*|number}
 */
config.web.port = process.env.WEB_PORT || 80;

/**
 * Define whether to automatically fix malformed URLs.
 * @type {boolean}
 */
config.web.fixUrl = true;

/**
 * Set whether to use an SSL certificate.
 * @type {boolean} True to use SSL.
 */
config.web.sslUse = false;

/**
 * HTTPS SSL web server listening port.
 * @type {*|number}
 */
config.web.sslPort = process.env.WEB_PORT_SSL || 443;

/**
 * SSL certificate private key file.
 * @type {string} File path.
 */
config.web.sslKeyFile = '';

/**
 * SSL certificate file.
 * @type {string} File path.
 */
config.web.sslCertFile = '';


/******************************************************************************
 * Real time configuration.                                                   *
 ******************************************************************************/

/**
 * Port that is used for the real time server.
 * Uses the same port as the web interface by default.
 * @type {*|number}
 */
config.realtime.port = config.web.port;

/**
 * The public path that is used for the real time server.
 * @type {string} Real time web path.
 */
config.realtime.path = '/realtime';

/**
 * The default room name for real time packets.
 * @type {string} Room name.
 */
config.realtime.defaultRoom = 'default';


/******************************************************************************
 * Security configuration.                                                    *
 ******************************************************************************/

/**
 * Number of rounds to hash.
 * @type {string}
 */
config.security.hashRounds = 6;

/**
 * Global salt used with hashing.
 * @type {string}
 */
config.security.globalSalt = 'mKd5xolXY6JCnLUkRZjmgjHsdkVK9dSiUg0m69z4'; // Examples: https://goo.gl/iAzWfz

/**
 * Default length of tokens, such as session tokens.
 * @type {int}
 */
config.security.tokenLength = 64;


/******************************************************************************
 * Session configuration.                                                     *
 ******************************************************************************/

/**
 * Default token length in characters.
 * @type {int}
 */
config.session.tokenLength = config.security.tokenLength;

/**
 * Maximum lifetime in seconds of a session.
 * @type {int}
 */
config.session.expire = 60 * 60 * 24 * 365;

/**
 * Number of seconds a session expires after it has been unused.
 * @type {number}
 */
config.session.expireUnused = 60 * 60 * 24 * 16;

/**
 * Name of the session token cookie.
 * @type {string}
 */
config.session.cookieName = 'session_token';


/******************************************************************************
 * Validation configuration.                                                  *
 ******************************************************************************/

/**
 * Minimum number of password characters.
 * @type {int}
 */
config.validation.passwordMinLength = 4;

/**
 * Maximum number of password characters.
 * @type {int}
 */
config.validation.passwordMaxLength = 128;

/**
 * Minimum number of name characters.
 * @type {int}
 */
config.validation.nameMinLength = 2;

/**
 * Maximum number of name characters.
 * @type {int}
 */
config.validation.nameMaxLength = 128;

/**
 * Minimum number of nickname characters.
 * @type {int}
 */
config.validation.nicknameMinLength = 1;

/**
 * Maximum number of nickname characters.
 * @type {int}
 */
config.validation.nicknameMaxLength = 32;

/**
 * Minimum number of team name characters.
 * @type {int}
 */
config.validation.teamNameMinLength = 1;

/**
 * Maximum number of team name characters.
 * @type {int}
 */
config.validation.teamNameMaxLength = 64;

/**
 * Minimum number of factory name characters.
 * @type {int}
 */
config.validation.factoryNameMinLength = 1;

/**
 * Maximum number of factory name characters.
 * @type {int}
 */
config.validation.factoryNameMaxLength = 64;

/**
 * Minimum number of game name characters.
 * @type {int}
 */
config.validation.gameNameMinLength = 4;

/**
 * Maximum number of game name characters.
 * @type {int}
 */
config.validation.gameNameMaxLength = 64;


/******************************************************************************
 * Game configuration.                                                        *
 ******************************************************************************/

/**
 * Location decay time in milliseconds.
 * @type {number}
 */
config.game.locationDecayTime = 30 * 1000;

/**
 * Update interval in milliseconds to send new location updates.
 * @type {number}
 */
config.game.locationUpdateInterval = 5 * 1000;

/**
 * Define whether to spread all tasks that have to be invoked automatically over
 * their available time frame, instead of invoking them all at once.
 *
 * This will schedule factory tick processing, location updates and more.
 *
 * True to schedule and spread, false to invoke all at once.
 *
 * @type {boolean}
 */
config.game.spreadTicks = true;


/******************************************************************************
 * Sentry error monitoring configuration.                                     *
 ******************************************************************************/

/**
 * Define whether Sentry error monitoring is enabled.
 * @type {boolean}
 */
config.sentry.enable = false;

/**
 * The Sentry DSN to monitor to.
 *
 * The DSN can be found on the following page:
 * https://docs.sentry.io/quickstart/#configure-the-dsn
 *
 * @type {string|undefined}
 */
config.sentry.dsn = 'https://********:********@sentry.io/000000';


/******************************************************************************
 * Language configuration.                                                    *
 ******************************************************************************/

/**
 * The default language values to use.
 *
 * @type {object}
 */
config.lang.defaults = {
    app: {
        name: 'Dworek'
    },
    currency: {
        name: 'dollar',
        names: 'dollars',
        sign: '$'
    },
    factory: {
        name: 'lab',
        names: 'labs'
    },
    shop: {
        name: 'dealer',
        names: 'dealers'
    },
    in: {
        name: 'ingredient',
        names: 'ingredients'
    },
    out: {
        name: 'drug',
        names: 'drugs'
    }
};

// Export the configuration
module.exports = config;
