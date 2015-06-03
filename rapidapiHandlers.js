var hl = require ( 'highland' );
var R = require ( 'ramda' );

var callSuccess = R.curry ( function ( callBack, data ) {
    return callBack ( null, data );
} );

var redisCommand = R.curry ( function ( redisClient, command, args ) {
    return hl.wrapCallback ( function ( args, callBack ) {
        redisClient[command] ( args, callBack );
    } )( args );
} );

var jsonParse = function ( redisContent ) {
    try {
        return hl ( [ JSON.parse ( redisContent ) ] );
    } catch ( error ) {
        return hl ( function ( push, next ) {
            push ( error );
        } );
    }
};

var errorStream = function ( error ) {
    return hl ( function ( push, next ) {
        return push ( error );
    } );
};

var jsonFromReq = function ( reqStream ) {
    return reqStream
        .map ( R.invoker ( 1, 'toString' )( 'utf8' ) )
        .reduce ( '', R.add )
        .flatMap ( jsonParse );
};

var redisKeyFromRequest = function ( reqStream ) {
    return reqStream
        .map ( R.invoker ( 0, 'path' ) )
        .map ( R.replace ( /^\//, '' ) )
        .map ( R.replace ( /\/$/, '' ) )
        .map ( R.replace ( /\//g, ':' ) );
};

var redisJsonFromKey = R.curry ( function ( redisClient, redisKey ) {
    return redisCommand ( redisClient, 'get', redisKey )
        .filter ( R.not ( R.isNil ) )
        .otherwise ( errorStream ( {
            type: 'NotFoundError',
            message: 'Object not found'
        } ) )
        .flatMap ( jsonParse );
} );

var redisSetObject = R.curry ( function ( redisClient, redisKey, newObjectJson ) {
    return hl ( [ newObjectJson ] )
        .map ( JSON.stringify )
        .map ( R.compose ( R.concat ( R.of ( redisKey ) ), R.of ) )
        .flatMap ( redisCommand ( redisClient, 'set' ) )
        .flatMap ( function ( setResult ) {
            if ( setResult !== 'OK' ) {
                return errorStream ( 'cannot save item in database' );
            }

            return hl ( [ newObjectJson ] );
        } );
} );

var redisAddListParms = R.curry ( function ( redisKey, oldObjectJson, newObjectJson ) {
    return hl ( R.differenceWith ( function ( a, b ) {
        return R.eq ( R.prop ( 'listKey', a ), R.prop ( 'listKey', b ) );
    }, R.prop ( 'lists', newObjectJson || { lists: [] } ), R.prop ( 'lists', oldObjectJson || { lists: [] } ) ) )
        .map ( R.compose ( R.ap ( [ R.prop ( 'listKey' ), R.prop ( 'indexKey' ) ] ), R.of ) )
        .map ( R.compose ( R.ap ( [ R.compose ( R.always, R.prop ( 0 ) ), R.compose ( R.prop, R.prop ( 1 ) ) ] ), R.of ) )
        .map ( R.flip ( R.concat )( [ R.always ( redisKey ) ] ) )
        .map ( R.flip ( R.ap )( R.of ( newObjectJson ) ) );
} );

var redisRemListParms = R.curry ( function ( redisKey, oldObjectJson, newObjectJson ) {
    return hl ( R.differenceWith ( function ( a, b ) {
        return R.eq ( R.prop ( 'listKey', a ), R.prop ( 'listKey', b ) );
    }, R.prop ( 'lists', oldObjectJson || { lists: [] } ), R.prop ( 'lists', newObjectJson || { lists: [] } ) ) )
        .map ( R.compose ( R.of, R.prop ( 'listKey' ) ) )
        .map ( R.flip ( R.concat )( [ redisKey ] ) );
} );

var errorStreams = function ( type ) {
    return {
        notfound: errorStream ( {
            type: 'NotFoundError',
            message: 'Object not found'
        } ),
        badrequest: errorStream ( {
            type: 'BadRequestError',
            message: 'Object already exists'
        } ),
    }[type];
};

module.exports = {
    get: function ( req, callBack ) {
        var streamsByType = R.curry ( function ( redisKey, type ) {
            return {
                none: errorStreams ( 'notfound' ),
                string: redisJsonFromKey ( req.redisClient, redisKey ),
                zset: redisCommand ( req.redisClient, 'zrange', [ redisKey, req.query.low || 0, req.query.high || -1 ] )
                    .flatMap ( hl )
                    .flatMap ( redisCommand ( req.redisClient, 'get' ) )
                    .filter ( R.not ( R.isNil ) )
                    .flatMap ( jsonParse )
                    .collect ()
            }[type] || errorStream ( 'Wrong resource type: ' + type );
        } );
                
        hl ( [ req ] )
            .through ( redisKeyFromRequest )
            .flatMap ( function ( redisKey ) {
                return redisCommand ( req.redisClient, 'type', redisKey )
                    .flatMap ( streamsByType ( redisKey ) )
            } )
            .stopOnError ( callBack )
            .each ( callSuccess ( callBack ) );
    },
    put: function ( req, callBack ) {
        var streamsByType = R.curry ( function ( redisKey, type ) {
            return {
                none: errorStreams ( 'notfound' ),
                string: redisJsonFromKey ( req.redisClient, redisKey ),
                zset: errorStream ( 'Lists are not directly writable' )
            }[type] || errorStream ( 'Wrong resource type: ' + type );
        } );

        hl ( req )
            .through ( jsonFromReq )
            .flatMap ( function ( newObjectJson ) {
                return hl ( [ req ] )
                    .through ( redisKeyFromRequest )
                    .flatMap ( function ( redisKey ) {
                        return redisCommand ( req.redisClient, 'type', redisKey )
                            .flatMap ( streamsByType ( redisKey ) )
                            .flatMap ( function ( oldObjectJson ) {
                                return hl ( [ newObjectJson ] )
                                    .flatMap ( redisSetObject ( req.redisClient, redisKey ) )
                                    .filter ( R.compose ( R.eq ( 'Array' ), R.type, R.prop ( 'lists' ) ) )
                                    .flatMap ( redisAddListParms ( redisKey, oldObjectJson ) )
                                    .flatMap ( redisCommand ( req.redisClient, 'zadd' ) )
                                    .collect ()
                                    .otherwise ( hl ( [ 'arbitrary' ] ) )
                                    .map ( R.always ( newObjectJson ) )
                                    .filter ( R.compose ( R.eq ( 'Array' ), R.type, R.prop ( 'lists' ) ) )
                                    .flatMap ( redisRemListParms ( redisKey, oldObjectJson ) )
                                    .flatMap ( redisCommand ( req.redisClient, 'zrem' ) )
                                    .collect ()
                                    .otherwise ( hl ( [ 'arbitrary' ] ) );
                            } );
                    } );
            } )
            .stopOnError ( callBack )
            .map ( R.always ( 'Object successfully updated' ) )
            .each ( callSuccess ( callBack ) );
    },
    post: function ( req, callBack ) {
        var streamsByType = R.curry ( function ( newObjectJson, type ) {
            return {
                none: hl ( [ newObjectJson ] ),
                zset: errorStream ( 'Lists are not directly writable' )
            }[type] || errorStreams ( 'badrequest' );
        } );

        hl ( req )
            .through ( jsonFromReq )
            .flatMap ( function ( newObjectJson ) {
                return hl ( [ req ] )
                    .through ( redisKeyFromRequest )
                    .flatMap ( function ( redisKey ) {
                        return redisCommand ( req.redisClient, 'type', redisKey )
                            .flatMap ( streamsByType ( newObjectJson ) )
                            .flatMap ( redisSetObject ( req.redisClient, redisKey ) )
                            .filter ( R.compose ( R.eq ( 'Array' ), R.type, R.prop ( 'lists' ) ) )
                            .flatMap ( redisAddListParms ( redisKey, null ) )
                            .flatMap ( redisCommand ( req.redisClient, 'zadd' ) )
                            .collect ()
                            .otherwise ( hl ( [ 'arbitrary' ] ) );
                    } );
            } )
            .stopOnError ( callBack )
            .map ( R.always ( 'Object successfully added' ) )
            .each ( callSuccess ( callBack ) );
    },
    del: function ( req, callBack ) {
        var streamsByType = R.curry ( function ( redisKey, type ) {
            return {
                none: errorStreams ( 'notfound' ),
                string: redisJsonFromKey ( req.redisClient, redisKey ),
                zset: errorStream ( 'Lists are not directly deletable' )
            }[type] || errorStream ( 'Wrong resource type: ' + type );
        } );

        hl ( [ req ] )
            .through ( redisKeyFromRequest )
            .flatMap ( function ( redisKey ) {
                return hl ( [
                    redisCommand ( req.redisClient, 'type', redisKey )
                        .flatMap ( streamsByType ( redisKey ) )
                        .filter ( R.compose ( R.eq ( 'Array' ), R.type, R.prop ( 'lists' ) ) )
                        .map ( redisRemListParms ( redisKey ) )
                        .flatMap ( function ( redisRemListParmsPartial ) {
                            return redisRemListParmsPartial ( null );
                        } )
                        .flatMap ( redisCommand ( req.redisClient, 'zrem' ) )
                        .collect ()
                        .otherwise ( hl ( [ 'arbitrary' ] ) ),
                    redisCommand ( req.redisClient, 'del', redisKey )
                ] );
            } )
            .series ()
            .collect ()
            .stopOnError ( callBack )
            .map ( R.always ( 'Object successfully deleted' ) )
            .each ( callSuccess ( callBack ) );
    }
};
