var config = require ( 'config' );
var cluster = require ( 'cluster' );
var path = require ( 'path' );
var rapidapi = require ( path.resolve ( 'rapidapi.js' ) );
var workers = {};
var count = require ( 'os' ).cpus ().length;

/* This function is NOT pure */
var spawn = function () {
    var worker = cluster.fork ();
    workers[worker.pid] = worker;
    return worker;
};

if ( cluster.isMaster ) {
    var i;

    for ( i = 0; i < count; i += 1 ) {
        spawn ();
    }

    cluster.on ( 'death', function ( worker ) {
        console.error ( 'worker ' + worker.pid + ' died. spawning a new process...' );
        delete workers[worker.pid];
        spawn ();
    } );
} else {
    rapidapi ( null, config, function ( error, server ) {
        if ( error ) {
            console.error ( error );
            return;
        }

        server.listen ( process.env.PORT || 5000, function () {
            console.log ( '%s listening at %s', server.name, server.url );
        } );
    } );
}
