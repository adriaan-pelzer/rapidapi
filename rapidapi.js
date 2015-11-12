var H = require ( 'highland' );
var R = require ( 'ramda' );
var r = require ( 'restify' );
var rr = require ( 'recursive-readdir' );
var P = require ( 'path' );
var p = require ( './package.json' );
var I = require ( 'inspect-log' );

var handlerPathToApiPaths = function ( handlerPath ) {
    var handlerPathToApiPath = function ( handlerPath ) {
        return '/' + R.map ( function ( partial ) {
            if ( partial.match ( /.js$/ ) ) {
                return ':' + partial.replace ( '.js', '' ).replace ( /\-/g, '/:' );
            }

            return partial;
        }, R.reject ( R.equals ( 'index.js' ), R.tail ( handlerPath.split ( '/' ) ) ) ).join ( '/' );
    };

    return R.reject ( R.equals ( '' ), [
        handlerPathToApiPath ( handlerPath )
    ] );
};

module.exports = function ( config, callBack ) {
    var S = r.createServer ( {
        name: p.name,
        version: p.version
    } );

    S.use ( r.queryParser () );
    S.use ( r.bodyParser () );
    S.use ( r.CORS () );

    S.use ( function ( req, res, next ) {
        res.setHeader ( 'Access-Control-Allow-Origin', '*' );
        res.setHeader ( 'Access-Control-Allow-Methods', '*' );
        res.setHeader ( 'Access-Control-Allow-Headers', '*' );
        res.setHeader ( 'Cache-Control', 'private, no-cache, no-store, must-revalidate' );
        res.setHeader ( 'Expires', '-1' );
        res.setHeader ( 'Pragma', 'no-cache' );

        next ();
    } );

    H.wrapCallback ( rr )( config.docRoot || 'routes' )
        .map ( R.compose ( R.reverse, R.sortBy ( R.compose ( R.length, R.split ( '/' ) ) ) ) )
        .sequence ()
        .map ( function ( path ) {
            return {
                handlers: require ( P.resolve ( path ) ),
                paths: handlerPathToApiPaths ( path )
            };
        } )
        .append ( 'OK' )
        .errors ( R.unary ( callBack ) )
        .each ( function ( pathAttributes ) {
            if ( pathAttributes === 'OK' ) {
                return S.listen ( process.env.PORT || 5000, function () {
                    console.log ( '%s listening at %s', S.name, S.url );
                    callBack ( null, S );
                } );
            }

            return R.mapObjIndexed ( function ( handler, method, handlers ) {
                return R.map ( function ( path ) {
                    console.log ( 'registering %s on %s', method, path );

                    return S[method] ( path, function ( req, res, next ) {
                        handler ( req, function ( error, response ) {
                            var successCode = { post: 201 }[method] || 200;

                            if ( error ) {
                                if ( error.type && R.compose ( R.equals ( 'Function' ), R.type )( r[error.type] ) ) {
                                    return next ( new r[error.type] ( error.message ) );
                                }

                                if ( error.code ) {
                                    res.send ( error.code, error.message );
                                    return next ();
                                }

                                return next ( new r.InternalServerError ( JSON.stringify ( error ) ) );
                            }

                            res.send ( successCode, response );
                            return next();
                        } );
                    } );
                }, pathAttributes.paths );
            }, pathAttributes.handlers );
        } );
};
