module.exports = {
    get: function ( req, callBack ) {
        callBack ( null, {
            resource: req.params.resourceId
        } );
    }
};
