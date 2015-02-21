var restify = require ( 'restify' );
var path = require ( 'path' );
var packageJson = require ( path.resolve ( 'package.json' ) );
var recursive = require ( 'recursive-readdir' );
var hl = require ( 'highland' );
var R = require ( 'ramda' );
var redis = require ( 'redis' );

var methodHandlerFactory = R.curry ( function ( method, routeHandler ) {
    var successCode = {
        get: 200,
        post: 201,
        put: 200,
        delete: 200
    }[method] || 200;

    return function ( req, res, next ) {
        routeHandler ( req, function ( error, response ) {
            if ( error ) {
                console.error ( error );

                if ( error.type && R.compose ( R.eq ( 'Function' ), R.type )( restify[error.type] ) ) {
                    return next ( new restify[error.type] ( error.message ) );
                }

                return next ( new restify.InternalServerError ( error ) );
            }

            res.send ( successCode, response );
            return next();
        } );
    };
} );

var supportedMethods = [ 'get', 'put', 'post', 'del' ];

var setupRapidapi = function ( config, supportedMethods, server ) {
    if ( config && config.redis ) {
        var rH = require ( path.resolve ( 'rapidapiHandlers.js' ) );

        R.forEach ( function ( method ) {
            console.log ( 'registering ' + method );
            server[method] ( '.*', methodHandlerFactory ( method )( rH[method] ) );
        } )( supportedMethods );
    }

    return server;
};

module.exports = function ( routeRoot, config, callBack ) {
    var server = restify.createServer ( {
        name: packageJson.name,
        version: packageJson.version
    } );

    server.use ( restify.queryParser () );
    server.use ( restify.CORS () );
    server.use ( restify.jsonp () );

    server.use ( function ( req, res, next ) {
        if ( config && config.redis ) {
            req.redisClient = redis.createClient ( config.redis.port || 6379, config.redis.host || 'localhost' );
        }
        req.restify = restify;
        next ();
    } );

    server.use ( function ( req, res, next ) {
        res.setHeader ( 'Cache-Control', 'private, no-cache, no-store, must-revalidate' );
        res.setHeader ( 'Expires', '-1' );
        res.setHeader ( 'Pragma', 'no-cache' );

        next ();
    } );

    if ( routeRoot ) {
        return hl.wrapCallback ( recursive )( routeRoot )
            .flatMap ( hl )
            .flatMap ( function ( route ) {
                var getRoutePath = R.compose ( R.replace ( routeRoot, '' ), R.replace ( new RegExp ( path.sep + '[^' + path.sep + ']*$' ), '' ) );
                var getRouteAction = R.compose ( R.add ( path.sep + ':' ), R.invoker ( 1, 'join' )( path.sep + ':' ), R.filter ( R.not ( R.or ( R.eq ( 'js' ), R.eq ( 'index' ) ) ) ), R.flatten, R.map ( R.split ( '-' ) ), R.split ( '.' ), R.last, R.split ( path.sep ) );

                var routeName = R.compose ( R.replace ( /:$/, '' ), R.invoker ( 1, 'join' )( '' ), R.ap ( [ getRoutePath, getRouteAction ] ) );

                return hl ( [ route ] )
                    .map ( path.resolve )
                    .map ( require )
                    .pick ( supportedMethods )
                    .map ( R.toPairs )
                    .flatMap ( hl )
                    .filter ( R.compose ( R.eq ( 'Function' ), R.type, R.prop ( 1 ) ) )
                    .doto ( function ( routePair ) {
                        server[routePair[0]] ( routeName ( [ route ] ), methodHandlerFactory ( routePair[0] )( routePair[1] ) );
                    } );
            } )
            .collect ()
            .each ( function ( result ) {
                return callBack ( null, setupRapidapi ( config, supportedMethods, server ) );
            } );
    }

    return callBack ( null, setupRapidapi ( config, supportedMethods, server ) );
};

if ( ! module.parent ) {
    module.exports ( 'routes', { redis: {} }, function ( error, server ) {
        if ( error ) {
            console.error ( error );
            return;
        }

        server.listen ( process.env.PORT || 5000, function () {
            console.log ( '%s listening at %s', server.name, server.url );
        } );
    } );
}
