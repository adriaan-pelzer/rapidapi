module.exports = {
    get: function ( req, callBack ) {
        callBack ( null, {
            oneThing: req.params.oneId,
            anotherThing: req.params.anotherId,
            yetAnotherThing: req.params.yetAnotherId
        } )
    }
};
