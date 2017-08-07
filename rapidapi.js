const H = require ( 'highland' );
const R = require ( 'ramda' );
const r = require ( 'restify' );
const rr = require ( 'recursive-readdir' );
const P = require ( 'path' );
const p = require ( './package.json' );
const I = require ( 'inspect-log' );
const sessions = require ( "client-sessions" );


const handlerPathToApiPaths = handlerPath => {
    const handlerPathToApiPath = handlerPath => {
        return '/' + R.map ( ( partial ) => {
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

module.exports = ( config, callBack ) => {
    let S = r.createServer ( {
        name: p.name,
        version: p.version
    } );

    /** --------------- EXAMPLE CONFIG
     * var config = {
     *      bodyParser: true,
     *      sessions: {
     *          secret: 'SECRET_HERE'
     *      },
     *      docRoot: './routes'
     *  }
     * ---------------- EXAMPLE CONFIG
     */

    if ( config.bodyParser ) {
        S.use ( r.bodyParser () );
    }
    if ( config.sessions ) {
        S.use ( sessions ( {
            cookieName: 'session', // cookie name dictates the key name added to the request object
            secret: config.sessions.secret, // should be a large unguessable string
            duration: 24 * 60 * 60 * 1000 // how long the session will stay valid in ms
            // cookie: {
            //     path: '/api', // cookie will only be sent to requests under '/api'
            //     maxAge: 60000, // duration of the cookie in milliseconds, defaults to duration above
            //     ephemeral: false, // when true, cookie expires when the browser closes
            //     httpOnly: true, // when true, cookie is not accessible from javascript
            //     secure: false // when true, cookie will only be sent over SSL. use key 'secureProxy' instead if you handle SSL not in your node process
            // }
        } ) );
    }
    S.use ( r.queryParser () );
    S.use ( r.CORS () );

    S.use ( ( req, res, next ) => {
        res.setHeader ( 'Access-Control-Allow-Origin', '*' );
        res.setHeader ( 'Access-Control-Allow-Methods', '*' );
        res.setHeader ( 'Access-Control-Allow-Headers', '*' );
        res.setHeader ( 'Cache-Control', 'private, no-cache, no-store, must-revalidate' );
        res.setHeader ( 'Expires', '-1' );
        res.setHeader ( 'Pragma', 'no-cache' );

        next ();
    } );

    H.wrapCallback ( rr ) ( config.docRoot || 'routes' )
        .map ( R.compose ( R.reverse, R.sortBy ( R.compose ( R.length, R.split ( '/' ) ) ) ) )
        .sequence ()
        .map ( path => {
            return {
                handlers: require ( P.resolve ( path ) ),
                paths: handlerPathToApiPaths ( path )
            };
        } )
        .append ( 'OK' )
        .errors ( R.unary ( callBack ) )
        .each ( pathAttributes => {
            if ( pathAttributes === 'OK' ) {
                return S.listen ( process.env.PORT || 5000, () => {
                    console.log ( '%s listening at %s', S.name, S.url );
                    callBack ( null, S );
                } );
            }

            return R.mapObjIndexed ( ( handler, method, handlers ) => {
                return R.map ( path => {
                    console.log ( 'registering %s on %s', method, path );

                    return S[ method ] ( path, ( req, res, next ) => {
                        handler ( req, ( error, response ) => {
                            let successCode = { post: 201 }[ method ] || 200;

                            if ( error ) {
                                if ( error.type && R.compose ( R.equals ( 'Function' ), R.type ) ( r[ error.type ] ) ) {
                                    return next ( new r[ error.type ] ( error.message ) );
                                }

                                if ( error.code ) {
                                    res.writeHead ( error.code, {
                                        'Content-Type': 'application/json;charset=UTF-8',
                                        'Access-Control-Allow-Origin': '*',
                                        'Access-Control-Allow-Methods': '*',
                                        'Access-Control-Allow-Headers': '*',
                                        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                                        'Expires': '-1',
                                        'Pragma': 'no-cache'
                                    } );

                                    res.write ( error.message );
                                    return res.end ();
                                }

                                return next ( new r.InternalServerError ( JSON.stringify ( error ) ) );
                            }

                            res.writeHead ( successCode, {
                                'Content-Type': 'application/json;charset=UTF-8',
                                'Access-Control-Allow-Origin': '*',
                                'Access-Control-Allow-Methods': '*',
                                'Access-Control-Allow-Headers': '*',
                                'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                                'Expires': '-1',
                                'Pragma': 'no-cache'
                            } );

                            res.write ( JSON.stringify ( response ) );
                            return res.end ();
                        } );
                    } );
                }, pathAttributes.paths );
            }, pathAttributes.handlers );
        } );
};
