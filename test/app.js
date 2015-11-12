var rapidapi = require ( '../rapidapi.js' );

rapidapi ( {}, function ( error, server ) {
    if ( error ) {
        return console.error ( error );
    }

    console.log ( 'READY>' );
} );
