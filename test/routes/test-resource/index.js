module.exports = {
    get: function ( req, callBack ) {
        callBack ( null, {
            resource: 'something'
        } );
    },
    post: function ( req, callBack ) {
        callBack ( null, {
            saved: 'something'
        } );
    },
    del: function ( req, callBack ) {
        callBack ( null, {
            deleted: 'something'
        } );
    },
    put: function ( req, callBack ) {
        callBack ( null, {
            updated: 'something'
        } );
    }
};
