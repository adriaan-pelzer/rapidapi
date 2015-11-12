module.exports = {
    get: function ( req, callBack ) {
        callBack ( { code: 500, message: 'yowza' }, { hello: 'world' } );
    },
    post: function ( req, callBack ) {
        callBack ( null, req.body );
    }
};
