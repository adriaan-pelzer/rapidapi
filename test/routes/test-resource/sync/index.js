module.exports = {
    get: function ( req, callBack ) {
        callBack ( null, {
            result: 'synced'
        } );
    }
};
